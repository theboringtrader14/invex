"""
Zerodha Holdings Loader — reads equity + MF holdings from Zerodha KiteConnect.
Reuses the access token already stored in STAAX DB (accounts table).
"""
import logging
from datetime import datetime, timezone
from typing import List, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select

logger = logging.getLogger(__name__)

KITE_BASE = "https://api.kite.trade"

async def get_zerodha_token(_db: AsyncSession = None) -> Optional[dict]:
    """Fetch Zerodha account + access token from STAAX DB (staax_db.accounts table).

    INVEX's own DB (invex_db) has no accounts table — tokens live in STAAX DB.
    Opens a separate short-lived connection to staax_db for this lookup.
    """
    from app.core.config import settings
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as _AS
    from sqlalchemy.orm import sessionmaker

    # Derive STAAX DB URL: same host/user/pass but database=staax_db
    staax_url = settings.database_url.replace("/invex_db", "/staax_db")
    engine = create_async_engine(staax_url, pool_pre_ping=True, pool_size=1, max_overflow=0)
    async_session = sessionmaker(engine, class_=_AS, expire_on_commit=False)
    try:
        async with async_session() as session:
            result = await session.execute(text(
                "SELECT id, api_key, access_token, client_id FROM accounts WHERE broker='zerodha' LIMIT 1"
            ))
            row = result.fetchone()
    finally:
        await engine.dispose()

    if not row or not row[2]:
        logger.warning("[ZERODHA] No active token found in STAAX DB")
        return None
    api_key = row[1] or settings.zerodha_api_key
    return {"staax_account_id": str(row[0]), "client_id": str(row[3]), "api_key": api_key, "token": row[2]}

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
    from app.core.sector_map import get_sector
    from sqlalchemy import select, delete
    import uuid

    account_info = await get_zerodha_token()
    if not account_info:
        return {"error": "No Zerodha token available"}

    token = account_info["token"]

    # ── Resolve INVEX account UUID via client_id ────────────────────────────
    from app.models.invex_account import InvexAccount
    client_id = account_info["client_id"]
    invex_result = await db.execute(
        select(InvexAccount).where(
            InvexAccount.client_id == client_id,
            InvexAccount.broker == "zerodha",
        )
    )
    invex_acc = invex_result.scalar_one_or_none()
    if invex_acc:
        account_id = str(invex_acc.id)
    else:
        # Fallback to STAAX UUID (shouldn't happen if bootstrap ran)
        account_id = account_info["staax_account_id"]
        logger.warning(f"[ZERODHA] invex_account not found for client_id={client_id}, using STAAX UUID")

    # Clean up any orphaned holdings written under the old STAAX UUID
    staax_uuid = account_info["staax_account_id"]
    if staax_uuid != account_id:
        await db.execute(delete(Holdings).where(Holdings.account_id == staax_uuid))
        from app.models.holdings import MFHoldings as _MF
        await db.execute(delete(_MF).where(_MF.account_id == staax_uuid))

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
            symbol = h.get("tradingsymbol", "")
            holding = Holdings(
                id=uuid.uuid4(),
                user_id=invex_acc.user_id if invex_acc else None,
                account_id=account_id,
                symbol=symbol,
                exchange=h.get("exchange", "NSE"),
                isin=h.get("isin"),
                qty=qty,
                avg_price=h.get("average_price", 0),
                ltp=h.get("last_price"),
                day_change=(h.get("last_price", 0) - h.get("close_price", 0)) * qty
                          if h.get("close_price") else None,
                updated_at=now,
            )
            holding.sector = get_sector(symbol)
            db.add(holding)
        logger.info(f"[ZERODHA] Loaded {len(raw_holdings)} equity holdings")

    # ── MF holdings ────────────────────────────────────────────────────────────
    raw_mf = await fetch_mf_holdings(account_info["api_key"] or api_key, token)
    if raw_mf:
        # Capture existing NAVs before delete so we can compute day_change
        prev_nav_result = await db.execute(text(
            'SELECT isin, nav FROM invex_mf_holdings WHERE account_id = :aid AND isin IS NOT NULL'
        ), {'aid': account_id})
        prev_nav_map = {row[0]: float(row[1]) for row in prev_nav_result.fetchall() if row[1] is not None}

        await db.execute(delete(MFHoldings).where(MFHoldings.account_id == account_id))
        now = datetime.now(timezone.utc)
        for f in raw_mf:
            units = f.get("quantity", 0)
            if units <= 0:
                continue
            isin = f.get("isin")
            nav = f.get("last_price", 0)
            invested = f.get("average_price", 0) * units

            # Compute day change vs previous NAV
            previous_nav = prev_nav_map.get(isin) if isin else None
            current_nav = float(nav)
            day_change = 0.0
            day_change_pct = 0.0
            if previous_nav and previous_nav != current_nav:
                day_change = round((current_nav - previous_nav) * float(units), 2)
                day_change_pct = round((current_nav - previous_nav) / previous_nav * 100, 4)

            mf = MFHoldings(
                id=uuid.uuid4(),
                user_id=invex_acc.user_id if invex_acc else None,
                account_id=account_id,
                fund_name=(f.get("fund", "") or f.get("tradingsymbol", "")).replace('\\u0026', '&').replace('u0026', '&'),
                isin=isin,
                units=units,
                nav=nav,
                previous_nav=previous_nav,
                day_change=day_change,
                day_change_pct=day_change_pct,
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
