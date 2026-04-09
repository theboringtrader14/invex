"""Portfolio API — holdings, MF, summary."""
import json
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.nse_sector_fetcher import get_sector_from_map
from app.core.redis_client import redis_client
from app.models.holdings import Holdings, MFHoldings, PortfolioSnapshot
import uuid
from datetime import date

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
async def get_holdings(request: Request, db: AsyncSession = Depends(get_db)):
    # 1. Cache hit — return instantly
    cached = await redis_client.get(HOLDINGS_CACHE_KEY)
    if cached:
        return json.loads(cached)

    # 2. Cache miss — query DB
    sector_map: dict = getattr(request.app.state, "sector_map", {})
    result = await db.execute(select(Holdings).order_by(Holdings.account_id, Holdings.symbol))
    rows = result.scalars().all()
    data = [_build_holding(r, sector_map) for r in rows]

    # 3. Populate cache
    await redis_client.setex(HOLDINGS_CACHE_KEY, CACHE_TTL, json.dumps(data))
    return data

@router.get("/mf")
async def get_mf(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MFHoldings).order_by(MFHoldings.fund_name))
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
async def get_summary(db: AsyncSession = Depends(get_db)):
    holdings = (await db.execute(select(Holdings))).scalars().all()
    mf = (await db.execute(select(MFHoldings))).scalars().all()
    equity_current  = sum((r.ltp or r.avg_price) * r.qty for r in holdings)
    equity_invested = sum(r.avg_price * r.qty for r in holdings)
    mf_current      = sum(r.current_value or 0 for r in mf)
    mf_invested     = sum(r.invested_amount or 0 for r in mf)
    total_current   = equity_current + mf_current
    total_invested  = equity_invested + mf_invested
    # day_change on holdings is already (ltp - prev_close) * qty from loaders
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
async def get_snapshots(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date).limit(365)
    )
    rows = result.scalars().all()
    return [{"date": str(r.snapshot_date), "total_value": r.portfolio_value,
             "invested": r.invested_value, "pnl": r.day_pnl} for r in rows]

@router.post("/refresh")
async def refresh_holdings(db: AsyncSession = Depends(get_db)):
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

    # Write today's portfolio snapshot for the equity curve
    try:
        await _write_snapshot(db)
        results["snapshot"] = "written"
    except Exception as e:
        results["snapshot"] = {"error": str(e)}

    # Invalidate holdings cache so next /holdings call returns fresh DB data
    await redis_client.delete(HOLDINGS_CACHE_KEY)

    return {"status": "refreshed", "results": results}

async def _write_snapshot(db: AsyncSession) -> None:
    """Compute total portfolio value and upsert a snapshot row for today."""
    from sqlalchemy import delete as sa_delete
    holdings = (await db.execute(select(Holdings))).scalars().all()
    mf       = (await db.execute(select(MFHoldings))).scalars().all()

    equity_current  = sum((r.ltp or r.avg_price) * r.qty for r in holdings)
    equity_invested = sum(r.avg_price * r.qty for r in holdings)
    mf_current      = sum(r.current_value or 0 for r in mf)
    mf_invested     = sum(r.invested_amount or 0 for r in mf)
    total_current   = equity_current + mf_current
    total_invested  = equity_invested + mf_invested
    day_pnl         = sum((r.day_change or 0) for r in holdings)

    today = date.today()
    # Remove existing row for today (upsert via delete + insert)
    await db.execute(
        sa_delete(PortfolioSnapshot).where(PortfolioSnapshot.snapshot_date == today)
    )
    snap = PortfolioSnapshot(
        id=uuid.uuid4(),
        snapshot_date=today,
        account_id="all",          # aggregate row
        portfolio_value=round(total_current, 2),
        invested_value=round(total_invested, 2),
        day_pnl=round(day_pnl, 2),
        total_pnl=round(total_current - total_invested, 2),
    )
    db.add(snap)
    await db.commit()
