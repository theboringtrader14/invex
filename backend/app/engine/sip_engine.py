"""
SIP Execution Engine — runs daily at 09:20 IST on weekdays.

Execution flow:
  1. Check market holiday (NSE API cache, fallback to hardcoded list)
  2. For each active SIP: check if should_execute_today()
  3. Fetch LTP from NSE public API
  4. Compute qty = floor(amount / ltp); skip if qty == 0
  5. Place market CNC order via correct broker
  6. Record SIPExecution row
  7. Update sip.total_invested, sip.total_units, sip.last_executed_at
"""
import math
import logging
from datetime import date, datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# ── NSE Holiday cache (populated at startup, used by is_market_holiday) ───────
_nse_holidays: set = set()

NSE_HOLIDAYS_2026 = {
    date(2026, 1, 26),  # Republic Day
    date(2026, 3, 25),  # Holi
    date(2026, 4, 2),   # Ram Navami / Good Friday
    date(2026, 4, 10),  # Good Friday
    date(2026, 4, 14),  # Dr. Ambedkar Jayanti
    date(2026, 5, 1),   # Maharashtra Day
    date(2026, 8, 15),  # Independence Day
    date(2026, 10, 2),  # Gandhi Jayanti
    date(2026, 10, 24), # Dussehra
    date(2026, 11, 14), # Diwali Laxmi Puja
    date(2026, 11, 15), # Diwali Balipratipada
    date(2026, 12, 25), # Christmas
}


async def refresh_nse_holidays() -> None:
    """Fetch NSE trading holiday list and cache in _nse_holidays. Falls back to hardcoded."""
    global _nse_holidays
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                "https://www.nseindia.com/api/holiday-master?type=trading",
                headers={
                    "User-Agent": "Mozilla/5.0",
                    "Referer": "https://www.nseindia.com/",
                    "Accept": "application/json",
                },
            )
            r.raise_for_status()
            data = r.json()
            holidays = set()
            for entry in data.get("CM", []):
                try:
                    holidays.add(datetime.strptime(entry["tradingDate"], "%d-%b-%Y").date())
                except Exception:
                    pass
            _nse_holidays = holidays
            logger.info(f"[SIP] NSE holiday cache refreshed — {len(_nse_holidays)} holidays loaded")
    except Exception as e:
        logger.warning(f"[SIP] NSE holiday fetch failed ({e}) — using hardcoded fallback")
        _nse_holidays = NSE_HOLIDAYS_2026


def is_market_holiday(today: date) -> bool:
    return today in (_nse_holidays or NSE_HOLIDAYS_2026)


def should_execute_today(sip, today: date) -> bool:
    """Return True if this SIP should execute today."""
    if sip.status != "active":
        return False
    if sip.start_date and today < sip.start_date:
        return False
    if sip.end_date and today > sip.end_date:
        return False
    if sip.last_executed_at and sip.last_executed_at.date() == today:
        return False  # already ran today

    freq = (sip.frequency or "daily").lower()
    if freq == "daily":
        return True
    if freq == "weekly":
        # frequency_day: 0=Mon ... 4=Fri
        target_day = sip.frequency_day if sip.frequency_day is not None else 0
        return today.weekday() == target_day
    if freq == "monthly":
        # frequency_date: 1–28
        target_date = sip.frequency_date if sip.frequency_date is not None else 1
        return today.day == target_date
    return False


async def get_ltp(symbol: str, exchange: str = "NSE") -> Optional[float]:
    """Fetch last traded price from NSE public API."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            # Warm up NSE session (cookie required)
            await client.get(
                "https://www.nseindia.com",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "text/html,application/xhtml+xml",
                },
                timeout=10,
            )
            r = await client.get(
                f"https://www.nseindia.com/api/quote-equity?symbol={symbol.upper()}",
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://www.nseindia.com/",
                    "Accept": "application/json",
                },
            )
            r.raise_for_status()
            data = r.json()
            ltp = data.get("priceInfo", {}).get("lastPrice")
            return float(ltp) if ltp else None
    except Exception as e:
        logger.warning(f"[SIP] LTP fetch failed for {symbol}: {e}")
        return None


async def _get_broker_info_for_account(account_id: str) -> Optional[dict]:
    """
    Look up broker type and credentials for a given account_id from STAAX DB.
    Returns a dict with keys: broker, api_key, access_token (for Zerodha)
    or broker, api_key, client_id, password, totp_secret (for Angel).
    """
    from app.core.config import settings
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as _AS
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import text

    staax_url = settings.database_url.replace("/invex_db", "/staax_db")
    engine = create_async_engine(staax_url, pool_pre_ping=True, pool_size=1, max_overflow=0)
    async_session = sessionmaker(engine, class_=_AS, expire_on_commit=False)
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT id, broker, api_key, access_token, nickname FROM accounts WHERE id=:id LIMIT 1"),
                {"id": account_id},
            )
            row = result.fetchone()
    finally:
        await engine.dispose()

    if not row:
        return None

    acct_id, broker, api_key, access_token, nickname = row
    broker = (broker or "").lower()

    if broker == "zerodha":
        return {
            "broker": "zerodha",
            "api_key": api_key or settings.zerodha_api_key,
            "access_token": access_token,
        }
    elif broker == "angelone":
        # Credentials live in settings, keyed by nickname
        from app.data_ingestion.angel_loader import ANGEL_ACCOUNTS
        acct_conf = next((a for a in ANGEL_ACCOUNTS if a["nickname"] == nickname), None)
        if not acct_conf:
            logger.warning(f"[SIP] Angel account '{nickname}' not found in ANGEL_ACCOUNTS config")
            return None
        return {
            "broker": "angelone",
            "api_key": acct_conf["api_key"](),
            "client_id": acct_conf["client_id"](),
            "password": acct_conf["password"](),
            "totp_secret": acct_conf["totp_secret"](),
        }
    return None


async def place_order_zerodha(
    symbol: str, exchange: str, qty: int,
    api_key: str, access_token: str,
    account_id: str,
) -> str:
    """Place a market CNC buy order via Kite REST API. Returns order_id."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://api.kite.trade/orders/regular",
            headers={
                "X-Kite-Version": "3",
                "Authorization": f"token {api_key}:{access_token}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={
                "tradingsymbol": symbol.upper(),
                "exchange": exchange.upper(),
                "transaction_type": "BUY",
                "order_type": "MARKET",
                "product": "CNC",
                "quantity": str(qty),
                "validity": "DAY",
                "tag": "INVEX_SIP",
            },
        )
        r.raise_for_status()
        order_id = r.json().get("data", {}).get("order_id", "")
        logger.info(f"[SIP] Zerodha order placed: {symbol} qty={qty} order_id={order_id} account={account_id}")
        return str(order_id)


async def place_order_angel(
    symbol: str, exchange: str, qty: int,
    api_key: str, client_id: str, password: str, totp_secret: str,
    account_id: str,
) -> str:
    """
    Login to Angel One (fresh TOTP), then place a market DELIVERY buy order.
    Returns order_id.
    """
    from app.data_ingestion.angel_loader import angel_login

    jwt_token = await angel_login(client_id, password, api_key, totp_secret)

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            "https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/placeOrder",
            headers={
                "Authorization": f"Bearer {jwt_token}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "X-UserType": "USER",
                "X-SourceID": "WEB",
                "X-ClientLocalIP": "127.0.0.1",
                "X-ClientPublicIP": "127.0.0.1",
                "X-MACAddress": "00:00:00:00:00:00",
                "X-PrivateKey": api_key,
            },
            json={
                "variety": "NORMAL",
                "tradingsymbol": symbol.upper(),
                "symboltoken": "",
                "transactiontype": "BUY",
                "exchange": exchange.upper(),
                "ordertype": "MARKET",
                "producttype": "DELIVERY",
                "duration": "DAY",
                "quantity": str(qty),
                "squareoff": "0",
                "stoploss": "0",
            },
        )
        r.raise_for_status()
        order_id = r.json().get("data", {}).get("orderid", "")
        logger.info(f"[SIP] Angel order placed: {symbol} qty={qty} order_id={order_id} account={account_id}")
        return str(order_id)


async def execute_sip(db: AsyncSession, sip) -> dict:
    """
    Execute a single SIP: fetch LTP, compute qty, place order, record execution.
    Returns a dict with status and details.
    """
    from app.models.sips import SIPExecution

    symbol = sip.symbol
    exchange = sip.exchange or "NSE"
    amount = float(sip.amount)
    account_id = str(sip.account_id)

    # Step 1: Get LTP
    ltp = await get_ltp(symbol, exchange)
    if not ltp or ltp <= 0:
        msg = f"LTP unavailable for {symbol}"
        logger.warning(f"[SIP] Skipping SIP {sip.id} ({symbol}): {msg}")
        return {"status": "skipped", "reason": msg, "sip_id": str(sip.id), "symbol": symbol}

    # Step 2: Compute qty
    qty = math.floor(amount / ltp)
    if qty <= 0:
        msg = f"Computed qty=0 for {symbol} (amount={amount}, ltp={ltp})"
        logger.warning(f"[SIP] Skipping SIP {sip.id}: {msg}")
        return {"status": "skipped", "reason": msg, "sip_id": str(sip.id), "symbol": symbol}

    # Step 3: Look up broker credentials
    broker_info = await _get_broker_info_for_account(account_id)
    if not broker_info:
        msg = f"No broker credentials found for account {account_id}"
        logger.error(f"[SIP] {msg}")
        return {"status": "error", "reason": msg, "sip_id": str(sip.id), "symbol": symbol}

    broker = broker_info.get("broker", "")

    # Step 4: Place order
    broker_order_id = ""
    try:
        if broker == "zerodha":
            broker_order_id = await place_order_zerodha(
                symbol=symbol, exchange=exchange, qty=qty,
                api_key=broker_info["api_key"],
                access_token=broker_info["access_token"],
                account_id=account_id,
            )
        elif broker == "angelone":
            broker_order_id = await place_order_angel(
                symbol=symbol, exchange=exchange, qty=qty,
                api_key=broker_info["api_key"],
                client_id=broker_info["client_id"],
                password=broker_info["password"],
                totp_secret=broker_info["totp_secret"],
                account_id=account_id,
            )
        else:
            msg = f"Unsupported broker '{broker}' for account {account_id}"
            logger.error(f"[SIP] {msg}")
            return {"status": "error", "reason": msg, "sip_id": str(sip.id), "symbol": symbol}

    except Exception as e:
        msg = f"Order placement failed: {e}"
        logger.error(f"[SIP] SIP {sip.id} ({symbol}): {msg}")
        # Record failed execution
        exec_row = SIPExecution(
            sip_id=sip.id,
            executed_at=datetime.now(timezone.utc),
            shares=0,
            price=ltp,
            amount=0,
            broker_order_id="",
            status="failed",
        )
        db.add(exec_row)
        await db.commit()
        return {"status": "error", "reason": msg, "sip_id": str(sip.id), "symbol": symbol}

    # Step 5: Record successful execution
    actual_amount = round(qty * ltp, 2)
    now = datetime.now(timezone.utc)
    exec_row = SIPExecution(
        sip_id=sip.id,
        executed_at=now,
        shares=qty,
        price=ltp,
        amount=actual_amount,
        broker_order_id=broker_order_id,
        status="executed",
    )
    db.add(exec_row)

    # Step 6: Update SIP totals
    sip.total_invested = (sip.total_invested or 0) + actual_amount
    sip.total_units = (sip.total_units or 0) + qty
    sip.last_executed_at = now

    await db.commit()
    logger.info(
        f"[SIP] Executed SIP {sip.id} ({symbol}): qty={qty} @ {ltp:.2f} = {actual_amount:.2f} order={broker_order_id}"
    )
    return {
        "status": "executed",
        "sip_id": str(sip.id),
        "symbol": symbol,
        "qty": qty,
        "ltp": ltp,
        "amount": actual_amount,
        "broker_order_id": broker_order_id,
    }


async def run_sip_engine(db: AsyncSession) -> dict:
    """
    Main entry point called by scheduler at 09:20 IST, or by the execute-now endpoint.
    Returns summary dict with counts.
    """
    from app.models.sips import SIP

    today = date.today()
    logger.info(f"[SIP] Engine starting for {today}")

    if today.weekday() >= 5:
        logger.info(f"[SIP] Weekend ({today}) — skipping all SIPs")
        return {"executed": 0, "skipped": 0, "errors": 0, "reason": "weekend", "date": str(today)}

    if is_market_holiday(today):
        logger.info(f"[SIP] Market holiday on {today} — skipping all SIPs")
        return {"executed": 0, "skipped": 0, "errors": 0, "reason": "market_holiday", "date": str(today)}

    result = await db.execute(select(SIP).where(SIP.status == "active"))
    sips = result.scalars().all()
    logger.info(f"[SIP] {len(sips)} active SIP(s) found")

    executed = 0
    skipped = 0
    errors = 0
    details = []

    for sip in sips:
        if not should_execute_today(sip, today):
            skipped += 1
            details.append({
                "sip_id": str(sip.id), "symbol": sip.symbol,
                "status": "skipped", "reason": "not_due_today",
            })
            continue
        try:
            r = await execute_sip(db, sip)
            if r["status"] == "executed":
                executed += 1
            elif r["status"] == "skipped":
                skipped += 1
            else:
                errors += 1
            details.append(r)
        except Exception as e:
            errors += 1
            logger.error(f"[SIP] Unexpected error for SIP {sip.id}: {e}")
            details.append({
                "sip_id": str(sip.id), "symbol": sip.symbol,
                "status": "error", "reason": str(e),
            })

    logger.info(f"[SIP] Engine complete — {executed} executed, {skipped} skipped, {errors} errors")

    return {
        "executed": executed,
        "skipped": skipped,
        "errors": errors,
        "date": str(today),
        "details": details,
    }
