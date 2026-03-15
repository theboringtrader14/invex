from sqlalchemy import Column, String, Integer, Float, Date, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base

class IPOBot(Base):
    __tablename__ = "invex_ipo_bots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(10), nullable=False)
    token = Column(Integer, nullable=True)
    listing_date = Column(Date, nullable=True)
    yearly_open = Column(Float, nullable=True)
    prev_year_high = Column(Float, nullable=True)
    prev_year_low = Column(Float, nullable=True)
    upp1 = Column(Float, nullable=True)
    lpp1 = Column(Float, nullable=True)
    trade_amount = Column(Float, server_default="10000")
    account_id = Column(String(50), nullable=False)
    status = Column(String(20), server_default="watching")
    is_practix = Column(Boolean, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=True)

class IPOOrder(Base):
    __tablename__ = "invex_ipo_orders"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bot_id = Column(UUID(as_uuid=True), nullable=False)
    account_id = Column(String(50), nullable=False)
    direction = Column(String(5), nullable=False)
    qty = Column(Integer, nullable=False)
    entry_price = Column(Float, nullable=True)
    exit_price = Column(Float, nullable=True)
    entry_time = Column(DateTime(timezone=True), nullable=True)
    exit_time = Column(DateTime(timezone=True), nullable=True)
    pnl = Column(Float, nullable=True)
    status = Column(String(20), server_default="open")
    broker_order_id = Column(String(50), nullable=True)
    signal_type = Column(String(20), nullable=True)
