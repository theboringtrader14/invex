"""INVEX Backend — FastAPI app."""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine, Base
from app.models import holdings, sips, ipo_bots, watchlist  # noqa
from app.api.v1 import portfolio, sips as sips_api, ipo_bots as ipo_api, watchlist as watchlist_api

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("INVEX starting up...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("✅ INVEX ready on port 8001")
    yield
    logger.info("INVEX shutting down")

app = FastAPI(title="INVEX API", version="1.0.0", lifespan=lifespan)

app.add_middleware(CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://localhost:3000"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(portfolio.router,     prefix="/api/v1/portfolio",  tags=["portfolio"])
app.include_router(sips_api.router,      prefix="/api/v1/sips",       tags=["sips"])
app.include_router(ipo_api.router,       prefix="/api/v1/ipo-bots",   tags=["ipo-bots"])
app.include_router(watchlist_api.router, prefix="/api/v1/watchlist",  tags=["watchlist"])

@app.get("/health")
async def health(): return {"status": "ok", "service": "invex"}
