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
import uuid as uuid_lib

router = APIRouter()

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
