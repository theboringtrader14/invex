"""
Zerodha Holdings Loader — reads equity + MF holdings from Zerodha KiteConnect.
Reuses the access token already stored in STAAX DB (accounts table).
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)

KITE_BASE = "https://api.kite.trade"

async def get_zerodha_token(db: AsyncSession) -> Optional[dict]:
    """Fetch Zerodha account + access token from STAAX accounts table."""
    result = await db.execute(text(
        "SELECT id, api_key, access_token FROM accounts WHERE broker='zerodha' LIMIT 1"
    ))
    row = result.fetchone()
    if not row or not row[2]:
        logger.warning("[ZERODHA] No active token found")
        return None
    # Use api_key from .env if DB has null api_key
    from app.core.config import settings
    api_key = row[1] or settings.zerodha_api_key
    return {"account_id": str(row[0]), "api_key": api_key, "token": row[2]}

async def fetch_holdings(api_key: str, access_token: str) -> List[dict]:
    """Fetch equity holdings from Zerodha API."""
    headers = {
        "X-Kite-Version": "3",
        "Authorization": f"token {api_key}:{access_token}",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{KITE_BASE}/portfolio/holdings", headers=headers)
        if resp.status_code != 200:
            logger.error(f"[ZERODHA] Holdings fetch failed: {resp.status_code} {resp.text[:100]}")
            return []
        data = resp.json()
        return data.get("data", [])

async def fetch_mf_holdings(api_key: str, access_token: str) -> List[dict]:
    """Fetch MF holdings from Zerodha Coin API."""
    headers = {
        "X-Kite-Version": "3",
        "Authorization": f"token {api_key}:{access_token}",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(f"{KITE_BASE}/mf/holdings", headers=headers)
        if resp.status_code != 200:
            logger.warning(f"[ZERODHA] MF holdings fetch failed: {resp.status_code}")
            return []
        data = resp.json()
        return data.get("data", [])

async def load_zerodha_holdings(db: AsyncSession, api_key: str) -> dict:
    """
    Full load: fetch equity + MF holdings and upsert to invex_holdings tables.
    Returns summary of what was loaded.
    """
    from app.models.holdings import Holdings, MFHoldings
    from sqlalchemy import select, delete
    import uuid

    account_info = await get_zerodha_token(db)
    if not account_info:
        return {"error": "No Zerodha token available"}

    token = account_info["token"]
    account_id = account_info["account_id"]

    # ── Equity holdings ────────────────────────────────────────────────────────
    raw_holdings = await fetch_holdings(account_info["api_key"] or api_key, token)
    if raw_holdings:
        # Clear existing holdings for this account
        await db.execute(
            delete(Holdings).where(Holdings.account_id == account_id)
        )
        now = datetime.now(timezone.utc)
        for h in raw_holdings:
            qty = h.get("quantity", 0) + h.get("t1_quantity", 0)
            if qty <= 0:
                continue
            holding = Holdings(
                id=uuid.uuid4(),
                account_id=account_id,
                symbol=h.get("tradingsymbol", ""),
                exchange=h.get("exchange", "NSE"),
                isin=h.get("isin"),
                qty=qty,
                avg_price=h.get("average_price", 0),
                ltp=h.get("last_price"),
                day_change=(h.get("last_price", 0) - h.get("close_price", 0)) * qty
                          if h.get("close_price") else None,
                updated_at=now,
            )
            db.add(holding)
        logger.info(f"[ZERODHA] Loaded {len(raw_holdings)} equity holdings")

    # ── MF holdings ────────────────────────────────────────────────────────────
    raw_mf = await fetch_mf_holdings(account_info["api_key"] or api_key, token)
    if raw_mf:
        await db.execute(delete(MFHoldings).where(MFHoldings.account_id == account_id))
        now = datetime.now(timezone.utc)
        for f in raw_mf:
            units = f.get("quantity", 0)
            if units <= 0:
                continue
            nav = f.get("last_price", 0)
            invested = f.get("average_price", 0) * units
            mf = MFHoldings(
                id=uuid.uuid4(),
                account_id=account_id,
                fund_name=f.get("fund", "") or f.get("tradingsymbol", ""),
                isin=f.get("isin"),
                units=units,
                nav=nav,
                invested_amount=invested,
                current_value=nav * units,
                updated_at=now,
            )
            db.add(mf)
        logger.info(f"[ZERODHA] Loaded {len(raw_mf)} MF holdings")

    await db.commit()
    return {
        "equity": len(raw_holdings),
        "mf": len(raw_mf),
        "account_id": account_id,
    }
