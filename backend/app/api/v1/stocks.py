"""Stock notes, history, and AI analysis endpoints."""
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.redis_client import redis_client
from app.models.holdings import Holdings
from app.models.stock_notes import InvexStockNote
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Notes ──────────────────────────────────────────────────────────────────

class NoteBody(BaseModel):
    account_id: str
    story: Optional[str] = None
    purchase_reason: Optional[str] = None
    conviction_level: Optional[int] = None


@router.get("/{symbol}/notes")
async def get_notes(
    symbol: str,
    account_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InvexStockNote).where(
            InvexStockNote.user_id == current_user.id,
            InvexStockNote.symbol == symbol.upper(),
            InvexStockNote.account_id == account_id,
        )
    )
    note = result.scalar_one_or_none()
    if not note:
        return {"story": None, "purchase_reason": None, "conviction_level": None, "created_at": None}
    return {
        "story": note.story,
        "purchase_reason": note.purchase_reason,
        "conviction_level": note.conviction_level,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }


@router.put("/{symbol}/notes")
async def upsert_notes(
    symbol: str,
    body: NoteBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InvexStockNote).where(
            InvexStockNote.user_id == current_user.id,
            InvexStockNote.symbol == symbol.upper(),
            InvexStockNote.account_id == body.account_id,
        )
    )
    note = result.scalar_one_or_none()
    if note:
        note.story = body.story
        note.purchase_reason = body.purchase_reason
        note.conviction_level = body.conviction_level
        note.updated_at = datetime.utcnow()
    else:
        note = InvexStockNote(
            user_id=current_user.id,
            symbol=symbol.upper(),
            account_id=body.account_id,
            story=body.story,
            purchase_reason=body.purchase_reason,
            conviction_level=body.conviction_level,
        )
        db.add(note)
    await db.commit()
    await db.refresh(note)
    return {
        "story": note.story,
        "purchase_reason": note.purchase_reason,
        "conviction_level": note.conviction_level,
    }


# ── History ─────────────────────────────────────────────────────────────────

@router.get("/{symbol}/history")
async def get_history(
    symbol: str,
    account_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Holdings).where(
            Holdings.user_id == current_user.id,
            Holdings.symbol.ilike(f"{symbol}%"),
            Holdings.account_id == account_id,
        )
    )
    h = result.scalar_one_or_none()
    if not h:
        return {
            "trade_history_available": False,
            "note": "Holding not found in INVEX database",
        }
    return {
        "symbol": symbol.upper(),
        "account_id": account_id,
        "current_qty": h.qty,
        "avg_buy_price": h.avg_price,
        "approx_invested": round(h.avg_price * h.qty, 2),
        "trade_history_available": False,
        "note": "Full trade history requires broker statement upload",
    }


# ── AI Analysis ─────────────────────────────────────────────────────────────

class AnalyseBody(BaseModel):
    account_id: str
    story: Optional[str] = None
    purchase_reason: Optional[str] = None
    conviction_level: Optional[int] = None
    sector: Optional[str] = None
    avg_price: Optional[float] = None
    ltp: Optional[float] = None
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    grade: Optional[str] = None
    signal: Optional[str] = None
    pe: Optional[float] = None
    force: bool = False


@router.post("/{symbol}/analyse")
async def analyse_stock(
    symbol: str,
    body: AnalyseBody,
    current_user: User = Depends(get_current_user),
):
    if not settings.anthropic_api_key:
        return {
            "analysis": None,
            "error": "AI analysis not configured. Add ANTHROPIC_API_KEY to backend .env",
        }

    cache_key = f"invex:analysis:{current_user.id}:{symbol.upper()}:{body.account_id}"
    if not body.force:
        cached = await redis_client.get(cache_key)
        if cached:
            return json.loads(cached)

    pnl_sign = "+" if (body.pnl or 0) >= 0 else ""
    pe_str = f"{body.pe:.1f}" if body.pe else "N/A"

    system = (
        "You are an unbiased investment analyst. Analyze this stock position and the investor's "
        "reasoning. Be honest, not encouraging. Point out if the reasoning is weak. "
        "Keep response under 150 words."
    )
    user_msg = (
        f"Stock: {symbol.upper()}\n"
        f"Sector: {body.sector or 'Unknown'}\n"
        f"Purchase reason: {body.purchase_reason or 'Not specified'}\n"
        f"Investor's story: {body.story or 'Not provided'}\n"
        f"Conviction level: {body.conviction_level or 3}/5\n\n"
        f"Current performance:\n"
        f"- Avg buy price: ₹{body.avg_price or 0:,.2f}\n"
        f"- Current price: ₹{body.ltp or 0:,.2f}\n"
        f"- P&L: {body.pnl_pct or 0:.1f}% ({pnl_sign}₹{abs(body.pnl or 0):,.0f})\n"
        f"- Grade: {body.grade or '?'}\n"
        f"- Signal: {body.signal or '?'}\n"
        f"- PE: {pe_str}\n\n"
        "Provide a brief, honest analysis of:\n"
        "1. Whether the purchase reasoning was sound\n"
        "2. What the current data says about this position\n"
        "3. One clear recommendation (hold/exit/average-down) with reasoning"
    )

    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        msg = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=300,
            system=system,
            messages=[{"role": "user", "content": user_msg}],
        )
        result = {"analysis": msg.content[0].text}
        await redis_client.setex(cache_key, 3600, json.dumps(result))
        return result
    except Exception as e:
        logger.error(f"AI analyse error: {e}")
        return {"analysis": None, "error": str(e)}
