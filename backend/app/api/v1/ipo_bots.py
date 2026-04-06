"""IPO Bots API."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.ipo_bots import IPOBot, IPOOrder
from app.engine.ipo_engine import get_ytr_for_symbol
import uuid as uuid_lib

router = APIRouter()

class IPOBotCreate(BaseModel):
    symbol: str; exchange: str = "NSE"; account_id: str
    trade_amount: float = 10000
    listing_date: Optional[str] = None

def _bot_dict(b: IPOBot):
    return {
        "id": str(b.id), "symbol": b.symbol, "exchange": b.exchange,
        "listing_date": str(b.listing_date) if b.listing_date else None,
        "yearly_open": b.yearly_open, "upp1": b.upp1, "lpp1": b.lpp1,
        "trade_amount": b.trade_amount, "account_id": b.account_id,
        "status": b.status, "is_practix": b.is_practix,
    }

@router.get("/")
async def list_bots(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(IPOBot).order_by(desc(IPOBot.created_at)))
    return [_bot_dict(b) for b in result.scalars().all()]

@router.post("/")
async def create_bot(body: IPOBotCreate, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    from datetime import date
    bot = IPOBot(id=uuid_lib.uuid4(), symbol=body.symbol, exchange=body.exchange,
                 account_id=body.account_id, trade_amount=body.trade_amount,
                 listing_date=date.fromisoformat(body.listing_date) if body.listing_date else None,
                 status="watching", is_practix=True, created_at=datetime.now(timezone.utc))
    db.add(bot); await db.commit(); await db.refresh(bot)
    return _bot_dict(bot)

@router.patch("/{bot_id}")
async def update_bot(bot_id: str, body: dict, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(IPOBot).where(IPOBot.id == bot_id))
    bot = result.scalar_one_or_none()
    if not bot: raise HTTPException(404, "Bot not found")
    for k, v in body.items():
        if hasattr(bot, k): setattr(bot, k, v)
    await db.commit()
    return _bot_dict(bot)

@router.get("/ytr/{symbol}")
async def get_ytr_levels(symbol: str, user = Depends(get_current_user)):
    """Compute YTR levels for a symbol via NSE public API."""
    result = await get_ytr_for_symbol(symbol.upper())
    if 'error' in result:
        raise HTTPException(422, result['error'])
    return result

@router.post("/scan")
async def scan_ipo_watchlist(db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    """Scan all watching bots for YTR signals. Returns signal for each bot's symbol."""
    result = await db.execute(select(IPOBot).where(IPOBot.status == "watching"))
    bots = result.scalars().all()
    signals = []
    for bot in bots:
        ytr = await get_ytr_for_symbol(bot.symbol)
        signals.append({
            'bot_id': str(bot.id),
            'symbol': bot.symbol,
            **ytr,
        })
    return {'signals': signals}

@router.get("/{bot_id}/orders")
async def bot_orders(bot_id: str, db: AsyncSession = Depends(get_db), user = Depends(get_current_user)):
    result = await db.execute(select(IPOOrder).where(IPOOrder.bot_id == bot_id).order_by(desc(IPOOrder.entry_time)))
    return [{"id": str(o.id), "direction": o.direction, "qty": o.qty,
             "entry_price": o.entry_price, "exit_price": o.exit_price,
             "pnl": o.pnl, "status": o.status,
             "entry_time": o.entry_time.isoformat() if o.entry_time else None} for o in result.scalars().all()]
