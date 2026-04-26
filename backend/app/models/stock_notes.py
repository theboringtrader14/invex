from sqlalchemy import Column, String, Integer, Text, DateTime, UniqueConstraint, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import uuid
from app.core.database import Base

class InvexStockNote(Base):
    __tablename__ = "invex_stock_notes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("invex_users.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(30), nullable=False)
    account_id = Column(String(50), nullable=False)
    story = Column(Text, nullable=True)
    purchase_reason = Column(String(50), nullable=True)
    conviction_level = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('user_id', 'symbol', 'account_id', name='uq_stock_note_user_symbol_account'),
    )
