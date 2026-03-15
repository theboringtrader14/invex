"""Portfolio API — holdings, MF, summary."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.holdings import Holdings, MFHoldings, PortfolioSnapshot
import httpx

router = APIRouter()

@router.get("/holdings")
async def get_holdings(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(Holdings).order_by(Holdings.account_id, Holdings.symbol))
    rows = result.scalars().all()
    return [{
        "id": str(r.id), "account_id": r.account_id,
        "symbol": r.symbol, "exchange": r.exchange, "isin": r.isin,
        "qty": r.qty, "avg_price": r.avg_price, "ltp": r.ltp,
        "day_change": r.day_change,
        "pnl": round((r.ltp - r.avg_price) * r.qty, 2) if r.ltp else None,
        "pnl_pct": round(((r.ltp - r.avg_price) / r.avg_price) * 100, 2) if r.ltp else None,
        "current_value": round(r.ltp * r.qty, 2) if r.ltp else None,
        "invested_value": round(r.avg_price * r.qty, 2),
    } for r in rows]

@router.get("/mf")
async def get_mf(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
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
async def get_summary(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    holdings = (await db.execute(select(Holdings))).scalars().all()
    mf = (await db.execute(select(MFHoldings))).scalars().all()
    equity_current = sum((r.ltp or r.avg_price) * r.qty for r in holdings)
    equity_invested = sum(r.avg_price * r.qty for r in holdings)
    mf_current = sum(r.current_value or 0 for r in mf)
    mf_invested = sum(r.invested_amount or 0 for r in mf)
    total_current = equity_current + mf_current
    total_invested = equity_invested + mf_invested
    day_pnl = sum((r.day_change or 0) * r.qty for r in holdings)
    return {
        "total_portfolio_value": round(total_current, 2),
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_current - total_invested, 2),
        "total_pnl_pct": round(((total_current - total_invested) / total_invested * 100), 2) if total_invested else 0,
        "day_pnl": round(day_pnl, 2),
        "equity_value": round(equity_current, 2),
        "mf_value": round(mf_current, 2),
        "holdings_count": len(holdings),
        "mf_count": len(mf),
    }

@router.get("/snapshots")
async def get_snapshots(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(
        select(PortfolioSnapshot).order_by(PortfolioSnapshot.snapshot_date).limit(365)
    )
    rows = result.scalars().all()
    return [{"date": str(r.snapshot_date), "value": r.portfolio_value,
             "invested": r.invested_value, "pnl": r.day_pnl} for r in rows]

@router.post("/refresh")
async def refresh_holdings(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    """Trigger a full holdings refresh from all brokers."""
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
    return {"status": "refreshed", "results": results}
