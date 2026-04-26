"""Portfolio API — holdings, MF, summary."""
import asyncio
import json
import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.core.database import get_db
from app.core.auth import get_current_user
from app.core.nse_sector_fetcher import get_sector_from_map
from app.core.redis_client import redis_client
from app.models.holdings import Holdings, MFHoldings, PortfolioSnapshot
from app.models.user import User
import uuid
from datetime import date, timedelta as _timedelta

logger = logging.getLogger(__name__)

router = APIRouter()

HOLDINGS_CACHE_KEY = "invex:holdings:all"
CACHE_TTL = 300  # 5 minutes


def _build_holding(r: Holdings, sector_map: dict) -> dict:
    return {
        "id": str(r.id), "account_id": r.account_id,
        "symbol": r.symbol, "exchange": r.exchange, "isin": r.isin,
        "sector": get_sector_from_map(r.symbol, sector_map),
        "qty": r.qty, "avg_price": r.avg_price, "ltp": r.ltp,
        "day_change": r.day_change,
        "pnl": round((r.ltp - r.avg_price) * r.qty, 2) if r.ltp else None,
        "pnl_pct": round(((r.ltp - r.avg_price) / r.avg_price) * 100, 2) if r.ltp else None,
        "current_value": round(r.ltp * r.qty, 2) if r.ltp else None,
        "invested_value": round(r.avg_price * r.qty, 2),
    }


@router.get("/holdings")
async def get_holdings(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cache_key = f"invex:holdings:{current_user.id}"

    cached = await redis_client.get(cache_key)
    if cached:
        return json.loads(cached)

    sector_map: dict = getattr(request.app.state, "sector_map", {})
    result = await db.execute(
        select(Holdings)
        .where(Holdings.user_id == current_user.id)
        .order_by(Holdings.account_id, Holdings.symbol)
    )
    rows = result.scalars().all()
    data = [_build_holding(r, sector_map) for r in rows]

    await redis_client.setex(cache_key, CACHE_TTL, json.dumps(data))
    return data


@router.get("/mf")
async def get_mf(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(MFHoldings)
        .where(MFHoldings.user_id == current_user.id)
        .order_by(MFHoldings.fund_name)
    )
    rows = result.scalars().all()
    return [{
        "id": str(r.id), "account_id": r.account_id,
        "fund_name": r.fund_name, "isin": r.isin,
        "units": r.units, "nav": r.nav,
        "invested_amount": r.invested_amount,
        "current_value": r.current_value,
        "pnl": round(r.current_value - r.invested_amount, 2) if r.current_value and r.invested_amount else None,
    } for r in rows]


@router.get("/summary")
async def get_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    holdings = (await db.execute(
        select(Holdings).where(Holdings.user_id == current_user.id)
    )).scalars().all()
    mf = (await db.execute(
        select(MFHoldings).where(MFHoldings.user_id == current_user.id)
    )).scalars().all()

    equity_current  = sum((r.ltp or r.avg_price) * r.qty for r in holdings)
    equity_invested = sum(r.avg_price * r.qty for r in holdings)
    mf_current      = sum(r.current_value or 0 for r in mf)
    mf_invested     = sum(r.invested_amount or 0 for r in mf)
    total_current   = equity_current + mf_current
    total_invested  = equity_invested + mf_invested
    day_pnl = sum((r.day_change or 0) for r in holdings)
    total_value = round(total_current, 2)
    day_change = round(day_pnl, 2)
    day_change_pct = round(day_change / total_value * 100, 2) if total_value else 0.0
    return {
        "total_portfolio_value": total_value,
        "total_value": total_value,
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_current - total_invested, 2),
        "total_pnl_pct": round((total_current - total_invested) / total_invested * 100, 2) if total_invested else 0,
        "day_pnl": day_change,
        "day_change": day_change,
        "day_change_pct": day_change_pct,
        "day_pnl_pct": day_change_pct,
        "equity_value": round(equity_current, 2),
        "mf_value": round(mf_current, 2),
        "holdings_count": len(holdings),
        "mf_count": len(mf),
    }


@router.get("/snapshots")
async def get_snapshots(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PortfolioSnapshot)
        .where(PortfolioSnapshot.user_id == current_user.id)
        .order_by(PortfolioSnapshot.snapshot_date)
        .limit(365)
    )
    rows = result.scalars().all()
    return [{"date": str(r.snapshot_date), "total_value": r.portfolio_value,
             "invested": r.invested_value, "pnl": r.day_pnl} for r in rows]


@router.post("/refresh")
async def refresh_holdings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a full holdings refresh from all brokers, then write today's snapshot."""
    from app.data_ingestion.zerodha_loader import load_zerodha_holdings
    from app.data_ingestion.angel_loader import load_angel_holdings
    from app.core.config import settings
    results = {}

    try:
        z = await load_zerodha_holdings(db, settings.zerodha_api_key)
        results["zerodha"] = z
    except Exception as e:
        results["zerodha"] = {"error": str(e)}

    try:
        a = await load_angel_holdings(db)
        results["angel"] = a
    except Exception as e:
        results["angel"] = {"error": str(e)}

    try:
        await _write_snapshot(db, current_user.id)
        results["snapshot"] = "written"
    except Exception as e:
        results["snapshot"] = {"error": str(e)}

    cache_key = f"invex:holdings:{current_user.id}"
    await redis_client.delete(cache_key)
    await redis_client.delete(HOLDINGS_CACHE_KEY)  # legacy key

    try:
        from app.adapters.market_data_adapter import market_data
        all_holdings = (await db.execute(
            select(Holdings).where(Holdings.user_id == current_user.id)
        )).scalars().all()
        equity_symbols = list({
            h.symbol.replace('-EQ', '').replace('-BE', '')
            for h in all_holdings
            if not (h.isin or '').startswith('INF')
        })
        asyncio.create_task(market_data.prefetch_portfolio(equity_symbols))
        logger.info(f"[PORTFOLIO] Triggered prefetch for {len(equity_symbols)} symbols")
    except Exception as e:
        logger.warning(f"[PORTFOLIO] Prefetch setup failed: {e}")

    return {"status": "refreshed", "results": results}


@router.get("/price-history")
async def get_price_history_endpoint(
    symbol: str,
    period: str = "1y",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date as date_type
    periods = {
        'ytd': date_type(date_type.today().year, 1, 1),
        '1y': date_type.today() - _timedelta(days=365),
        '3y': date_type.today() - _timedelta(days=1095),
    }
    start = periods.get(period, periods['1y'])
    clean_sym = symbol.replace('-EQ', '').replace('-BE', '').replace('.NS', '').strip()

    stock_rows = []
    if clean_sym != 'NIFTY50':
        result = await db.execute(text('''
            SELECT date, close FROM invex_price_history
            WHERE symbol = :sym AND date >= :start ORDER BY date ASC
        '''), {'sym': clean_sym, 'start': start})
        stock_rows = [{'date': str(r[0]), 'close': float(r[1])} for r in result.fetchall()]

    nifty_result = await db.execute(text('''
        SELECT date, close FROM invex_price_history
        WHERE symbol = 'NIFTY50' AND date >= :start ORDER BY date ASC
    '''), {'start': start})
    nifty_rows = [{'date': str(r[0]), 'close': float(r[1])} for r in nifty_result.fetchall()]

    def normalize(rows):
        if not rows:
            return []
        base = rows[0]['close']
        return [{'date': r['date'], 'value': round(r['close'] / base * 100, 2)} for r in rows]

    return {
        'symbol': clean_sym,
        'period': period,
        'stock': normalize(stock_rows),
        'nifty': normalize(nifty_rows),
    }


async def _write_snapshot(db: AsyncSession, user_id=None) -> None:
    """Compute total portfolio value and upsert a snapshot row for today."""
    from sqlalchemy import delete as sa_delete

    q_holdings = select(Holdings)
    q_mf = select(MFHoldings)
    if user_id:
        q_holdings = q_holdings.where(Holdings.user_id == user_id)
        q_mf = q_mf.where(MFHoldings.user_id == user_id)

    holdings = (await db.execute(q_holdings)).scalars().all()
    mf       = (await db.execute(q_mf)).scalars().all()

    equity_current  = sum((r.ltp or r.avg_price) * r.qty for r in holdings)
    equity_invested = sum(r.avg_price * r.qty for r in holdings)
    mf_current      = sum(r.current_value or 0 for r in mf)
    mf_invested     = sum(r.invested_amount or 0 for r in mf)
    total_current   = equity_current + mf_current
    total_invested  = equity_invested + mf_invested
    day_pnl         = sum((r.day_change or 0) for r in holdings)

    if total_current == 0:
        return

    today = date.today()
    del_q = sa_delete(PortfolioSnapshot).where(PortfolioSnapshot.snapshot_date == today)
    if user_id:
        del_q = del_q.where(PortfolioSnapshot.user_id == user_id)
    await db.execute(del_q)

    snap = PortfolioSnapshot(
        id=uuid.uuid4(),
        user_id=user_id,
        snapshot_date=today,
        account_id="all",
        portfolio_value=round(total_current, 2),
        invested_value=round(total_invested, 2),
        day_pnl=round(day_pnl, 2),
        total_pnl=round(total_current - total_invested, 2),
    )
    db.add(snap)
    await db.commit()
