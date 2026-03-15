"""SIPs API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, date
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.sips import SIP, SIPExecution
import uuid as uuid_lib

router = APIRouter()

class SIPCreate(BaseModel):
    account_id: str; symbol: str; exchange: str = "NSE"
    amount: float; frequency: str
    frequency_day: Optional[int] = None
    frequency_date: Optional[int] = None
    start_date: str; end_date: Optional[str] = None

def _sip_dict(s: SIP):
    return {
        "id": str(s.id), "account_id": s.account_id,
        "symbol": s.symbol, "exchange": s.exchange,
        "amount": s.amount, "frequency": s.frequency,
        "frequency_day": s.frequency_day, "frequency_date": s.frequency_date,
        "status": s.status, "start_date": str(s.start_date),
        "end_date": str(s.end_date) if s.end_date else None,
        "total_invested": s.total_invested or 0,
        "total_units": s.total_units or 0,
    }

@router.get("/")
async def list_sips(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(SIP).order_by(desc(SIP.created_at)))
    return [_sip_dict(s) for s in result.scalars().all()]

@router.post("/")
async def create_sip(body: SIPCreate, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    sip = SIP(id=uuid_lib.uuid4(), **body.model_dump(exclude={"start_date", "end_date"}),
              start_date=date.fromisoformat(body.start_date),
              end_date=date.fromisoformat(body.end_date) if body.end_date else None,
              created_at=datetime.now(timezone.utc))
    db.add(sip); await db.commit(); await db.refresh(sip)
    return _sip_dict(sip)

@router.patch("/{sip_id}")
async def update_sip(sip_id: str, body: dict, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(SIP).where(SIP.id == sip_id))
    sip = result.scalar_one_or_none()
    if not sip: raise HTTPException(404, "SIP not found")
    for k, v in body.items():
        if hasattr(sip, k): setattr(sip, k, v)
    await db.commit()
    return _sip_dict(sip)

@router.delete("/{sip_id}")
async def delete_sip(sip_id: str, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(SIP).where(SIP.id == sip_id))
    sip = result.scalar_one_or_none()
    if not sip: raise HTTPException(404, "SIP not found")
    await db.delete(sip); await db.commit()
    return {"status": "deleted"}

@router.get("/{sip_id}/executions")
async def sip_executions(sip_id: str, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(SIPExecution).where(SIPExecution.sip_id == sip_id).order_by(desc(SIPExecution.executed_at)))
    return [{"id": str(e.id), "executed_at": e.executed_at.isoformat() if e.executed_at else None,
             "shares": e.shares, "price": e.price, "amount": e.amount, "status": e.status} for e in result.scalars().all()]
