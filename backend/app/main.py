"""INVEX Backend — FastAPI app."""
import logging
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.models import holdings, sips, ipo_bots, watchlist  # noqa
from app.api.v1 import portfolio, sips as sips_api, ipo_bots as ipo_api, watchlist as watchlist_api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def _startup_refresh() -> None:
    """Auto-load all holdings at startup so the portfolio page is never blank."""
    from app.data_ingestion.zerodha_loader import load_zerodha_holdings
    from app.data_ingestion.angel_loader import load_angel_holdings
    from app.api.v1.portfolio import _write_snapshot, HOLDINGS_CACHE_KEY
    from app.core.redis_client import redis_client

    async with AsyncSessionLocal() as db:
        try:
            z = await load_zerodha_holdings(db, settings.zerodha_api_key)
            logger.info(f"[STARTUP] Zerodha: {z}")
        except Exception as e:
            logger.warning(f"[STARTUP] Zerodha load failed: {e}")

        try:
            a = await load_angel_holdings(db)
            logger.info(f"[STARTUP] Angel One: {a}")
        except Exception as e:
            logger.warning(f"[STARTUP] Angel One load failed: {e}")

        try:
            await _write_snapshot(db)
            logger.info("[STARTUP] Portfolio snapshot written")
        except Exception as e:
            logger.warning(f"[STARTUP] Snapshot write failed: {e}")

    # Bust stale cache — next /holdings call will rebuild from fresh DB data
    await redis_client.delete(HOLDINGS_CACHE_KEY)
    logger.info("[STARTUP] Holdings cache invalidated")

async def _scheduled_snapshot() -> None:
    """Called by APScheduler at 15:35 IST on weekdays — writes daily equity curve snapshot."""
    from app.api.v1.portfolio import _write_snapshot
    async with AsyncSessionLocal() as db:
        try:
            await _write_snapshot(db)
            logger.info("[SCHEDULER] Daily snapshot written at 15:35 IST")
        except Exception as e:
            logger.warning(f"[SCHEDULER] Daily snapshot failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("INVEX starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tables ready — loading holdings from brokers...")
    await _startup_refresh()

    # Fetch NSE sector map and cache on app.state
    try:
        from app.core.nse_sector_fetcher import get_sector_map
        sector_map = await get_sector_map()
        app.state.sector_map = sector_map
        logger.info(f"[STARTUP] NSE sectors loaded: {len(sector_map)} symbols")
    except Exception as e:
        app.state.sector_map = {}
        logger.warning(f"[STARTUP] NSE sector fetch failed: {e}")

    # Schedule daily portfolio snapshot at 15:35 IST, Mon–Fri
    _IST = ZoneInfo("Asia/Kolkata")
    scheduler = AsyncIOScheduler(timezone=_IST)
    scheduler.add_job(
        _scheduled_snapshot, "cron",
        day_of_week="mon-fri", hour=15, minute=35,
        id="daily_snapshot",
    )
    scheduler.start()
    logger.info("✅ INVEX ready on port 8001 — daily snapshot scheduled at 15:35 IST")

    yield

    scheduler.shutdown(wait=False)
    from app.core.redis_client import redis_client
    await redis_client.aclose()
    logger.info("INVEX shutting down")

app = FastAPI(title="INVEX API", version="1.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=[
        "http://localhost:3001",
        "http://localhost:3000",
        "https://invex.lifexos.co.in",
        "https://staax.lifexos.co.in",
        "https://lifexos.co.in",
    ],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(portfolio.router,     prefix="/api/v1/portfolio",  tags=["portfolio"])
app.include_router(sips_api.router,      prefix="/api/v1/sips",       tags=["sips"])
app.include_router(ipo_api.router,       prefix="/api/v1/ipo-bots",   tags=["ipo-bots"])
app.include_router(watchlist_api.router, prefix="/api/v1/watchlist",  tags=["watchlist"])

@app.get("/health")
async def health(): return {"status": "ok", "service": "invex"}
