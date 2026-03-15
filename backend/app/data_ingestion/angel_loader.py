"""
Angel One Holdings Loader — reads equity holdings from Angel One SmartAPI.
"""
import logging
from datetime import datetime, timezone
from typing import List
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)

async def get_angel_accounts(db: AsyncSession) -> List[dict]:
    """Fetch all Angel One accounts + tokens from STAAX accounts table."""
    result = await db.execute(text(
        "SELECT id, nickname, access_token FROM accounts WHERE broker='angelone' AND is_active=true"
    ))
    rows = result.fetchall()
    return [{"account_id": str(r[0]), "nickname": r[1], "token": r[2]} for r in rows if r[2]]

async def fetch_angel_holdings(auth_token: str) -> List[dict]:
    """Fetch holdings from Angel One SmartAPI."""
    headers = {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://apiconnect.angelbroking.com/rest/secure/angelbroking/portfolio/v1/getAllHolding",
            headers=headers
        )
        if resp.status_code != 200:
            logger.warning(f"[ANGEL] Holdings fetch failed: {resp.status_code}")
            return []
        data = resp.json()
        return data.get("data", {}).get("holdings", []) or []

async def load_angel_holdings(db: AsyncSession) -> dict:
    """Load equity holdings for all Angel One accounts."""
    from app.models.holdings import Holdings
    from sqlalchemy import delete
    import uuid

    accounts = await get_angel_accounts(db)
    if not accounts:
        return {"error": "No Angel One tokens available"}

    total = 0
    now = datetime.now(timezone.utc)
    for acc in accounts:
        raw = await fetch_angel_holdings(acc["token"])
        if not raw:
            continue
        await db.execute(delete(Holdings).where(Holdings.account_id == acc["account_id"]))
        for h in raw:
            qty = int(h.get("quantity", 0) or 0)
            if qty <= 0:
                continue
            holding = Holdings(
                id=uuid.uuid4(),
                account_id=acc["account_id"],
                symbol=h.get("tradingsymbol", "") or h.get("symbol", ""),
                exchange=h.get("exchange", "NSE"),
                isin=h.get("isin"),
                qty=qty,
                avg_price=float(h.get("averageprice", 0) or 0),
                ltp=float(h.get("ltp", 0) or 0),
                day_change=None,
                updated_at=now,
            )
            db.add(holding)
            total += 1
        logger.info(f"[ANGEL] {acc['nickname']}: loaded {len(raw)} holdings")

    await db.commit()
    return {"total": total, "accounts": len(accounts)}
