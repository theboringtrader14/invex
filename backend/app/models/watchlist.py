from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base

class Watchlist(Base):
    __tablename__ = "invex_watchlist"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("invex_users.id", ondelete="CASCADE"), nullable=True, index=True)
    account_id = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(10), nullable=False)
    added_at = Column(DateTime(timezone=True), nullable=True)
    notes = Column(String(500), nullable=True)
    price_alert_above = Column(Float, nullable=True)
    price_alert_below = Column(Float, nullable=True)
    rsi_alert_threshold = Column(Integer, nullable=True)
    earnings_alert = Column(Boolean, server_default="false")
