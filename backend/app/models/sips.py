from sqlalchemy import Column, String, Integer, Float, Date, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base

class SIP(Base):
    __tablename__ = "invex_sips"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(10), nullable=False)
    amount = Column(Float, nullable=False)
    frequency = Column(String(20), nullable=False)
    frequency_day = Column(Integer, nullable=True)
    frequency_date = Column(Integer, nullable=True)
    status = Column(String(20), server_default="active")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=True)
    total_invested = Column(Float, server_default="0")
    total_units = Column(Float, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=True)
    last_executed_at = Column(DateTime(timezone=True), nullable=True)

class SIPExecution(Base):
    __tablename__ = "invex_sip_executions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sip_id = Column(UUID(as_uuid=True), nullable=False)
    executed_at = Column(DateTime(timezone=True), nullable=False)
    shares = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    amount = Column(Float, nullable=False)
    broker_order_id = Column(String(50), nullable=True)
    status = Column(String(20), server_default="placed")
