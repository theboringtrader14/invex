"""
Angel One Holdings Loader — reads JWT from invex_accounts table (no fresh login needed).

Falls back to TOTP auto-login if totp_secret + password are available on the account.
"""
import logging
import uuid
from datetime import datetime, timezone

import httpx
import pyotp
from sqlalchemy import select, text, delete
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

ANGEL_BASE = "https://apiconnect.angelbroking.com"


async def angel_login_with_totp(client_id: str, password: str, api_key: str, totp_code: str) -> str:
    """Login to Angel One SmartAPI using a pre-computed 6-digit TOTP code."""
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
    payload = {"clientcode": client_id, "password": password, "totp": totp_code}
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{ANGEL_BASE}/rest/auth/angelbroking/user/v1/loginByPassword",
            json=payload, headers=headers
        )
        data = resp.json()
        if data.get("status") and data.get("data", {}).get("jwtToken"):
            token = data["data"]["jwtToken"]
            logger.info(f"[ANGEL] Login successful for {client_id} (user-supplied TOTP)")
            return token
        else:
            msg = data.get("message", "Unknown error")
            logger.error(f"[ANGEL] Login failed for {client_id}: {msg}")
            raise Exception(f"Angel One login failed: {msg}")


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


_JWT_ERROR_INDICATORS = (
    "invalid token",
    "token expired",
    "jwt",
    "unauthorized",
    "session expired",
    "not logged in",
    "authentication",
    "access denied",
    "ab1010",   # Angel One JWT-expired error code
    "ab1011",
)


async def fetch_angel_holdings(jwt_token: str, api_key: str) -> tuple[list, str | None]:
    """Fetch equity holdings from Angel One.

    Returns:
        (holdings_list, error_message_or_None)
        error_message is set when the API returned a failure; it will contain
        "JWT_EXPIRED" when Angel One indicates an auth/token problem.
    """
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
                return holdings.get("holdings", []) or [], None
            return holdings or [], None

        message = data.get("message") or data.get("errorcode") or "Unknown error"
        error_code = (data.get("errorcode") or "").lower()
        message_lower = message.lower()
        is_jwt_error = (
            resp.status_code == 401
            or any(kw in message_lower for kw in _JWT_ERROR_INDICATORS)
            or any(kw in error_code for kw in _JWT_ERROR_INDICATORS)
        )
        if is_jwt_error:
            logger.warning(f"[ANGEL] JWT/auth error — token likely expired: {message}")
            return [], f"JWT_EXPIRED: {message}"
        logger.warning(f"[ANGEL] Holdings fetch failed: {message}")
        return [], f"API_ERROR: {message}"


async def load_angel_holdings(db: AsyncSession) -> dict:
    """
    Load holdings for all active Angel One accounts registered in invex_accounts.

    Token priority:
      1. Use stored jwt_token from invex_accounts (set at bootstrap / refresh-token endpoint).
      2. Fall back to TOTP auto-login if totp_secret + password are stored.

    After loading, updates last_synced_at + holdings_count on the account row.
    """
    from app.models.holdings import Holdings
    from app.models.invex_account import InvexAccount
    from app.core.sector_map import get_sector

    # Fetch all active Angel One accounts
    result = await db.execute(
        select(InvexAccount).where(
            InvexAccount.broker == "angelone",
            InvexAccount.is_active == True,  # noqa: E712
        ).order_by(InvexAccount.nickname)
    )
    accounts = result.scalars().all()

    if not accounts:
        logger.warning("[ANGEL] No active Angel One accounts in invex_accounts — skipping")
        return {"total": 0, "accounts": {}}

    total = 0
    results = {}
    now = datetime.now(timezone.utc)

    for acc in accounts:
        nickname  = acc.nickname
        client_id = acc.client_id
        jwt_token = acc.jwt_token
        api_key   = acc.api_key or ""

        # ── Resolve JWT ──────────────────────────────────────────────────────
        if not jwt_token:
            # Attempt TOTP auto-login if credentials stored
            if acc.totp_secret and acc.password and api_key:
                try:
                    jwt_token = await angel_login(client_id, acc.password, api_key, acc.totp_secret)
                    acc.jwt_token  = jwt_token
                    acc.sync_error = None
                    await db.flush()   # persist new JWT to DB immediately (within this transaction)
                    logger.info(f"[ANGEL] {nickname}: obtained JWT via TOTP login")
                except Exception as e:
                    err = f"TOTP login failed: {e}"
                    logger.error(f"[ANGEL] {nickname}: {err}")
                    acc.sync_error = err
                    results[nickname] = {"error": err}
                    continue
            else:
                err = "No JWT and no TOTP credentials — run refresh-token first"
                logger.warning(f"[ANGEL] {nickname}: {err}")
                acc.sync_error = err
                results[nickname] = {"error": err}
                continue

        if not api_key:
            err = "No api_key stored — cannot fetch holdings"
            logger.warning(f"[ANGEL] {nickname}: {err}")
            acc.sync_error = err
            results[nickname] = {"error": err}
            continue

        # ── Fetch Holdings ───────────────────────────────────────────────────
        try:
            raw, fetch_error = await fetch_angel_holdings(jwt_token, api_key)
        except Exception as e:
            err = f"Holdings fetch error: {e}"
            logger.error(f"[ANGEL] {nickname}: {err}")
            acc.sync_error = err
            results[nickname] = {"error": err}
            continue

        # ── Auto-retry with TOTP re-login on JWT expiry ───────────────────
        if fetch_error and fetch_error.startswith("JWT_EXPIRED") and acc.totp_secret and acc.password and api_key:
            logger.info(f"[ANGEL] {nickname}: JWT expired — attempting TOTP re-login")
            try:
                jwt_token = await angel_login(client_id, acc.password, api_key, acc.totp_secret)
                acc.jwt_token  = jwt_token
                acc.sync_error = None
                await db.flush()   # persist refreshed JWT to DB immediately (within this transaction)
                raw, fetch_error = await fetch_angel_holdings(jwt_token, api_key)
                logger.info(f"[ANGEL] {nickname}: re-login succeeded, fetched {len(raw)} holdings")
            except Exception as e:
                err = f"JWT expired and TOTP re-login failed: {e}"
                logger.error(f"[ANGEL] {nickname}: {err}")
                acc.sync_error = err
                results[nickname] = {"error": err, "total": 0}
                continue

        # ── If still an auth error after retry (or no TOTP creds), bail without
        #    touching the DB so stale-but-valid holdings are preserved ─────────
        if fetch_error and fetch_error.startswith("JWT_EXPIRED"):
            err = fetch_error
            logger.error(f"[ANGEL] {nickname}: {err} — skipping DB write to preserve existing holdings")
            acc.sync_error = err
            results[nickname] = {"error": err, "total": 0}
            continue

        # account_id used for holdings table (keyed by client_id in STAAX convention)
        # We use the invex_account.id as the account_id FK in holdings
        account_id = str(acc.id)

        # Build new holding objects first — only replace DB rows if we have data
        new_holdings = []
        for h in raw:
            qty = int(float(h.get("quantity", 0) or 0))
            if qty <= 0:
                continue
            symbol    = h.get("tradingsymbol", "") or h.get("symbol", "")
            avg_price = float(h.get("averageprice", 0) or h.get("average_price", 0) or 0)
            ltp       = float(h.get("ltp", 0) or 0)
            close     = float(h.get("close", 0) or h.get("close_price", 0) or 0)
            day_change = round((ltp - close) * qty, 2) if ltp > 0 and close > 0 else None
            holding = Holdings(
                id=uuid.uuid4(),
                user_id=acc.user_id,
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
            new_holdings.append(holding)

        count = len(new_holdings)

        if new_holdings:
            # Safe swap: delete stale rows only after confirming we have fresh data
            await db.execute(delete(Holdings).where(Holdings.account_id == account_id))
            for holding in new_holdings:
                db.add(holding)
        else:
            # No holdings returned — leave existing DB rows intact
            logger.warning(f"[ANGEL] {nickname}: API returned 0 holdings — preserving existing DB rows")

        total += count
        acc.last_synced_at = now
        acc.holdings_count = count
        acc.sync_error     = fetch_error  # None on success, "API_ERROR: ..." on non-JWT failures
        if fetch_error:
            results[nickname] = {"error": fetch_error, "loaded": count}
            logger.warning(f"[ANGEL] {nickname}: loaded {count} holdings but API reported: {fetch_error}")
        else:
            results[nickname] = {"loaded": count}
            logger.info(f"[ANGEL] {nickname}: loaded {count} holdings")

    await db.commit()
    return {"total": total, "accounts": results}
