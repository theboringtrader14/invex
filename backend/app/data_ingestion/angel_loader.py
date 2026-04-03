"""
Angel One Holdings Loader — direct login with client ID + password + auto-TOTP.
No OAuth redirect needed. Fully automated with pyotp.
"""
import logging
import pyotp
import httpx
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, delete
from app.core.config import settings

logger = logging.getLogger(__name__)

ANGEL_BASE = "https://apiconnect.angelbroking.com"

ANGEL_ACCOUNTS = [
    {
        "nickname": "Karthik AO",
        "client_id": lambda: settings.angelone_karthik_client_id,
        "password":  lambda: settings.angelone_karthik_password,
        "api_key":   lambda: settings.angelone_karthik_api_key,
        "totp_secret": lambda: settings.angelone_karthik_totp_secret,
    },
    {
        "nickname": "Mom",
        "client_id": lambda: settings.angelone_mom_client_id,
        "password":  lambda: settings.angelone_mom_password,
        "api_key":   lambda: settings.angelone_mom_api_key,
        "totp_secret": lambda: settings.angelone_mom_totp_secret,
    },
    {
        "nickname": "Wife",
        "client_id": lambda: settings.angelone_wife_client_id,
        "password":  lambda: settings.angelone_wife_password,
        "api_key":   lambda: settings.angelone_wife_api_key,
        "totp_secret": lambda: settings.angelone_wife_totp_secret,
    },
]

async def angel_login(client_id: str, password: str, api_key: str, totp_secret: str) -> str:
    """Login to Angel One SmartAPI and return JWT token."""
    totp = pyotp.TOTP(totp_secret).now()
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": "127.0.0.1",
        "X-MACAddress": "00:00:00:00:00:00",
        "X-PrivateKey": api_key,
    }
    payload = {"clientcode": client_id, "password": password, "totp": totp}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword",
            json=payload, headers=headers
        )
        data = resp.json()
        if data.get("status") and data.get("data", {}).get("jwtToken"):
            token = data["data"]["jwtToken"]
            logger.info(f"[ANGEL] Login successful for {client_id}")
            return token
        else:
            logger.error(f"[ANGEL] Login failed for {client_id}: {data.get('message', 'Unknown error')}")
            raise Exception(f"Angel One login failed: {data.get('message', 'Unknown')}")

async def fetch_angel_holdings(jwt_token: str, api_key: str) -> list:
    """Fetch equity holdings from Angel One."""
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": "127.0.0.1",
        "X-MACAddress": "00:00:00:00:00:00",
        "X-PrivateKey": api_key,
    }
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{ANGEL_BASE}/rest/secure/angelbroking/portfolio/v1/getAllHolding",
            headers=headers
        )
        data = resp.json()
        if data.get("status"):
            holdings = data.get("data", {})
            if isinstance(holdings, dict):
                return holdings.get("holdings", []) or []
            return holdings or []
        logger.warning(f"[ANGEL] Holdings fetch failed: {data.get('message')}")
        return []

async def load_angel_holdings(db: AsyncSession) -> dict:
    """
    Auto-login to all Angel One accounts and load their holdings.
    Uses pyotp for automatic TOTP generation — fully headless.
    """
    from app.models.holdings import Holdings
    from app.core.sector_map import get_sector
    import uuid

    total = 0
    results = {}
    now = datetime.now(timezone.utc)

    for acc in ANGEL_ACCOUNTS:
        nickname = acc["nickname"]
        client_id = acc["client_id"]()
        password = acc["password"]()
        api_key = acc["api_key"]()
        totp_secret = acc["totp_secret"]()

        if not all([client_id, password, api_key, totp_secret]):
            logger.warning(f"[ANGEL] {nickname}: missing credentials — skipping")
            results[nickname] = {"error": "Missing credentials"}
            continue

        try:
            # Auto-login with TOTP
            jwt_token = await angel_login(client_id, password, api_key, totp_secret)

            # Get account_id from STAAX accounts table
            result = await db.execute(text(
                f"SELECT id FROM accounts WHERE nickname='{nickname}' AND broker='angelone' LIMIT 1"
            ))
            row = result.fetchone()
            if not row:
                logger.warning(f"[ANGEL] {nickname}: account not found in DB")
                results[nickname] = {"error": "Account not in DB"}
                continue
            account_id = str(row[0])

            # Also store token back to accounts table for reference
            await db.execute(text(
                f"UPDATE accounts SET access_token='{jwt_token}', status='active' WHERE id='{account_id}'"
            ))

            # Fetch holdings
            raw = await fetch_angel_holdings(jwt_token, api_key)
            if not raw:
                results[nickname] = {"loaded": 0}
                continue

            # Clear old holdings and insert fresh
            await db.execute(delete(Holdings).where(Holdings.account_id == account_id))
            count = 0
            for h in raw:
                qty = int(float(h.get("quantity", 0) or 0))
                if qty <= 0:
                    continue
                symbol     = h.get("tradingsymbol", "") or h.get("symbol", "")
                avg_price  = float(h.get("averageprice", 0) or h.get("average_price", 0) or 0)
                ltp        = float(h.get("ltp", 0) or 0)
                close      = float(h.get("close", 0) or h.get("close_price", 0) or 0)
                # day_change = (LTP − prev_close) × qty, same formula as Zerodha loader
                day_change = round((ltp - close) * qty, 2) if ltp > 0 and close > 0 else None
                holding = Holdings(
                    id=uuid.uuid4(),
                    account_id=account_id,
                    symbol=symbol,
                    exchange=h.get("exchange", "NSE"),
                    isin=h.get("isin"),
                    qty=qty,
                    avg_price=avg_price,
                    ltp=ltp if ltp > 0 else None,
                    day_change=day_change,
                    updated_at=now,
                )
                holding.sector = get_sector(symbol)
                db.add(holding)
                count += 1
            total += count
            results[nickname] = {"loaded": count}
            logger.info(f"[ANGEL] {nickname}: loaded {count} holdings")

        except Exception as e:
            logger.error(f"[ANGEL] {nickname}: {e}")
            results[nickname] = {"error": str(e)}

    await db.commit()
    return {"total": total, "accounts": results}
