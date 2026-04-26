"""INVEX Backend — FastAPI app."""
import logging
from contextlib import asynccontextmanager
from zoneinfo import ZoneInfo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.database import engine, Base, AsyncSessionLocal
from app.models import holdings, sips, ipo_bots, watchlist, invex_account, user, stock_notes  # noqa
from app.api.v1 import portfolio, sips as sips_api, ipo_bots as ipo_api, watchlist as watchlist_api
from app.api.v1 import analysis as analysis_api
from app.api.v1 import accounts as accounts_api
from app.api.v1 import auth as auth_api
from app.api.v1 import stocks as stocks_api
from app.engine.sip_engine import run_sip_engine, refresh_nse_holidays

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def bootstrap_accounts() -> None:
    """
    Seed invex_accounts from STAAX DB at startup.
    Upserts by client_id — copies jwt_token, api_key, feed_token from accounts table.
    """
    import os
    import uuid
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as _AS
    from sqlalchemy.ext.asyncio import async_sessionmaker
    from sqlalchemy import text, select
    from app.models.invex_account import InvexAccount

    STAAX_URL = os.getenv(
        "STAAX_DATABASE_URL",
        "postgresql+asyncpg://staax:staax_password@127.0.0.1:5432/staax_db"
    )
    _engine = create_async_engine(STAAX_URL, pool_pre_ping=True, pool_size=1, max_overflow=0)
    _session = async_sessionmaker(_engine, class_=_AS, expire_on_commit=False)

    try:
        async with _session() as staax:
            rows = await staax.execute(text(
                "SELECT client_id, nickname, broker, api_key, "
                "access_token, feed_token, is_active "
                "FROM accounts ORDER BY nickname"
            ))
            staax_accounts = rows.fetchall()
    finally:
        await _engine.dispose()

    if not staax_accounts:
        logger.warning("[BOOTSTRAP] No accounts found in STAAX DB")
        return

    async with AsyncSessionLocal() as db:
        for row in staax_accounts:
            client_id, nickname, broker, api_key, access_token, feed_token, is_active = row
            # Check if already exists
            result = await db.execute(
                select(InvexAccount).where(InvexAccount.client_id == client_id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                # Only update the JWT/feed tokens — don't overwrite user-configured fields
                if access_token:
                    existing.jwt_token  = access_token
                if feed_token:
                    existing.feed_token = feed_token
                logger.info(f"[BOOTSTRAP] Updated tokens for {existing.nickname} ({client_id})")
            else:
                acc = InvexAccount(
                    id=uuid.uuid4(),
                    nickname=nickname or client_id,
                    broker=broker or "angelone",
                    client_id=client_id,
                    api_key=api_key,
                    jwt_token=access_token,
                    feed_token=feed_token,
                    is_active=bool(is_active),
                )
                db.add(acc)
                logger.info(f"[BOOTSTRAP] Seeded account {acc.nickname} ({client_id})")
        await db.commit()
    logger.info(f"[BOOTSTRAP] accounts synced from STAAX DB: {len(staax_accounts)} rows")


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


async def _scheduled_sip_run() -> None:
    """Called by APScheduler at 09:20 IST on weekdays — executes due SIPs."""
    async with AsyncSessionLocal() as db:
        try:
            summary = await run_sip_engine(db)
            logger.info(f"[SCHEDULER] SIP engine complete: {summary}")
        except Exception as e:
            logger.warning(f"[SCHEDULER] SIP engine failed: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("INVEX starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tables ready — bootstrapping accounts from STAAX DB...")
    await bootstrap_accounts()
    logger.info("Accounts ready — loading holdings from brokers...")
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

    # Warm up NSE holiday cache for SIP engine
    try:
        await refresh_nse_holidays()
    except Exception as e:
        logger.warning(f"[STARTUP] NSE holiday refresh failed: {e}")

    # Schedule daily portfolio snapshot at 15:35 IST, Mon–Fri
    _IST = ZoneInfo("Asia/Kolkata")
    scheduler = AsyncIOScheduler(timezone=_IST)
    scheduler.add_job(
        _scheduled_snapshot, "cron",
        day_of_week="mon-fri", hour=15, minute=35,
        id="daily_snapshot",
    )
    # Schedule SIP engine at 09:20 IST, Mon–Fri
    scheduler.add_job(
        _scheduled_sip_run, "cron",
        day_of_week="mon-fri", hour=9, minute=20,
        id="sip_engine",
    )
    scheduler.start()
    logger.info("✅ INVEX ready on port 8001 — daily snapshot @ 15:35 IST, SIP engine @ 09:20 IST")

    # Kick off non-blocking price history backfill for all portfolio symbols + Nifty
    async def _run_backfill():
        from app.services.price_history_service import backfill_all
        async with AsyncSessionLocal() as db:
            try:
                await backfill_all(db)
            except Exception as e:
                logger.warning(f"[STARTUP] Price history backfill failed: {e}")

    import asyncio as _asyncio
    _asyncio.create_task(_run_backfill())

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

app.include_router(auth_api.router,      prefix="/api/v1/auth",       tags=["auth"])
app.include_router(portfolio.router,     prefix="/api/v1/portfolio",  tags=["portfolio"])
app.include_router(sips_api.router,      prefix="/api/v1/sips",       tags=["sips"])
app.include_router(ipo_api.router,       prefix="/api/v1/ipo-bots",   tags=["ipo-bots"])
app.include_router(watchlist_api.router, prefix="/api/v1/watchlist",  tags=["watchlist"])
app.include_router(analysis_api.router,  prefix="/api/v1/analysis",   tags=["analysis"])
app.include_router(accounts_api.router,  prefix="/api/v1/accounts",   tags=["accounts"])
app.include_router(stocks_api.router,    prefix="/api/v1/stocks",      tags=["stocks"])

@app.get("/health")
async def health(): return {"status": "ok", "service": "invex"}
