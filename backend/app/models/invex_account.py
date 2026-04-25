"""
InvexAccount — broker account registry for INVEX portfolio tracker.
Stores credentials and sync state for each brokerage account.
Bootstrapped at startup from STAAX DB (accounts table).
"""
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class InvexAccount(Base):
    __tablename__ = "invex_accounts"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nickname       = Column(String(50), nullable=False)         # "Mom", "Karthik"
    broker         = Column(String(20), nullable=False)         # "angelone", "zerodha"
    client_id      = Column(String(50), nullable=False)         # KRAH1029
    api_key        = Column(String(255), nullable=True)         # Angel One API key
    totp_secret    = Column(String(255), nullable=True)         # auto-TOTP login
    password       = Column(String(255), nullable=True)         # broker password (for re-login)
    jwt_token      = Column(Text, nullable=True)                # current session token
    feed_token     = Column(String(255), nullable=True)         # Angel One SmartStream
    refresh_token  = Column(String(255), nullable=True)         # Zerodha refresh token
    token_expiry   = Column(DateTime(timezone=True), nullable=True)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    holdings_count = Column(Integer, default=0)
    sync_error     = Column(Text, nullable=True)                # last sync error
    is_active      = Column(Boolean, default=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
