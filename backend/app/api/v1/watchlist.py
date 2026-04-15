"""Watchlist API."""
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.watchlist import Watchlist
from app.core.redis_client import redis_client
import uuid as uuid_lib
import json
import httpx
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# ── NSE price cache (in-process fallback, 30 s TTL) ──────────────────────────
_PRICES_CACHE_KEY = "invex:watchlist:prices"
_PRICES_CACHE_TTL = 30  # seconds

NSE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}


async def _fetch_nse_ltp(symbol: str, client: httpx.AsyncClient) -> dict | None:
    """
    Fetch LTP, day-change and pct-change for one NSE symbol.
    Returns None if the request fails or the symbol isn't found.

    NSE India requires a valid session cookie obtained by hitting the
    homepage first.  We reuse the same httpx.AsyncClient across all symbols
    so that cookies persist for the whole batch.

    TODO: If NSE tightens anti-scraping further (e.g. Cloudflare), replace
    this with a paid data provider or broker WebSocket feed.
    """
    url = f"https://www.nseindia.com/api/quote-equity?symbol={symbol}"
    try:
        r = await client.get(url, timeout=10)
        if r.status_code != 200:
            logger.warning(f"[NSE] {symbol} → HTTP {r.status_code}")
            return None
        data = r.json()
        pd = data.get("priceInfo", {})
        ltp = pd.get("lastPrice")
        change = pd.get("change")
        pct = pd.get("pChange")
        if ltp is None:
            return None
        return {
            "ltp": round(float(ltp), 2),
            "change": round(float(change), 2) if change is not None else 0.0,
            "pct_change": round(float(pct), 2) if pct is not None else 0.0,
        }
    except Exception as e:
        logger.warning(f"[NSE] {symbol} fetch error: {e}")
        return None

class WatchlistAdd(BaseModel):
    account_id: str = "default"; symbol: str; exchange: str = "NSE"
    notes: Optional[str] = None
    price_alert_above: Optional[float] = None
    price_alert_below: Optional[float] = None

def _w_dict(w: Watchlist):
    return {"id": str(w.id), "account_id": w.account_id,
            "symbol": w.symbol, "exchange": w.exchange,
            "notes": w.notes, "price_alert_above": w.price_alert_above,
            "price_alert_below": w.price_alert_below,
            "rsi_alert_threshold": w.rsi_alert_threshold,
            "earnings_alert": w.earnings_alert,
            "added_at": w.added_at.isoformat() if w.added_at else None}


@router.get("/prices")
async def get_watchlist_prices(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    """
    Return current LTP, change, and pct_change for every symbol in the watchlist.

    Results are cached in Redis for 30 seconds to avoid hammering NSE India.
    If a symbol fails to fetch (network error, unknown symbol, etc.) its value
    is null — the rest of the batch still succeeds.

    Response:
        { "prices": { "RELIANCE": { "ltp": 1234.5, "change": 12.3, "pct_change": 1.01 }, ... } }
    """
    # 1. Redis cache hit
    cached = await redis_client.get(_PRICES_CACHE_KEY)
    if cached:
        return {"prices": json.loads(cached)}

    # 2. Fetch all watchlist symbols from DB
    result = await db.execute(select(Watchlist))
    items = result.scalars().all()
    symbols = list({w.symbol.upper() for w in items})

    if not symbols:
        return {"prices": {}}

    # 3. Fetch live prices from NSE India
    #    Seed session by hitting the homepage first so NSE cookies are valid.
    prices: dict[str, dict | None] = {}
    try:
        async with httpx.AsyncClient(
            headers=NSE_HEADERS,
            follow_redirects=True,
            timeout=15,
        ) as client:
            # Seed NSE session cookie
            try:
                await client.get("https://www.nseindia.com", timeout=10)
            except Exception as e:
                logger.warning(f"[NSE] Homepage seed failed: {e}")

            for symbol in symbols:
                prices[symbol] = await _fetch_nse_ltp(symbol, client)
    except Exception as e:
        logger.error(f"[NSE] httpx client creation failed: {e}")
        # Return stub null prices so the frontend doesn't error
        return {"prices": {sym: None for sym in symbols}}

    # 4. Cache the result in Redis for 30 s
    try:
        await redis_client.setex(_PRICES_CACHE_KEY, _PRICES_CACHE_TTL, json.dumps(prices))
    except Exception as e:
        logger.warning(f"[NSE] Redis cache write failed: {e}")

    return {"prices": prices}


@router.get("/")
async def list_watchlist(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(Watchlist))
    return [_w_dict(w) for w in result.scalars().all()]

@router.post("/")
async def add_to_watchlist(body: WatchlistAdd, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    w = Watchlist(id=uuid_lib.uuid4(), **body.model_dump(), added_at=datetime.now(timezone.utc))
    db.add(w); await db.commit(); await db.refresh(w)
    return _w_dict(w)

@router.patch("/{wid}")
async def update_watchlist(wid: str, body: dict = Body(...), db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == wid))
    w = result.scalar_one_or_none()
    if not w: raise HTTPException(404)
    for k, v in body.items():
        if hasattr(w, k): setattr(w, k, v)
    await db.commit(); return _w_dict(w)

@router.delete("/{wid}")
async def remove_watchlist(wid: str, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(Watchlist).where(Watchlist.id == wid))
    w = result.scalar_one_or_none()
    if not w: raise HTTPException(404)
    await db.delete(w); await db.commit()
    return {"status": "removed"}
