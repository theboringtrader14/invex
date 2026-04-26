from sqlalchemy import Column, String, Integer, Float, Date, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.core.database import Base

class Holdings(Base):
    __tablename__ = "invex_holdings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("invex_users.id", ondelete="CASCADE"), nullable=True, index=True)
    account_id = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False)
    exchange = Column(String(10), nullable=False)
    isin = Column(String(20), nullable=True)
    qty = Column(Integer, nullable=False)
    avg_price = Column(Float, nullable=False)
    ltp = Column(Float, nullable=True)
    day_change = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

class MFHoldings(Base):
    __tablename__ = "invex_mf_holdings"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("invex_users.id", ondelete="CASCADE"), nullable=True, index=True)
    account_id = Column(String(50), nullable=False)
    fund_name = Column(String(200), nullable=False)
    isin = Column(String(20), nullable=True)
    units = Column(Float, nullable=False)
    nav = Column(Float, nullable=True)
    invested_amount = Column(Float, nullable=True)
    current_value = Column(Float, nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

class EquityTransaction(Base):
    __tablename__ = "invex_equity_transactions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("invex_users.id", ondelete="CASCADE"), nullable=True, index=True)
    account_id = Column(String(50), nullable=False)
    symbol = Column(String(20), nullable=False)
    trade_date = Column(Date, nullable=False)
    direction = Column(String(5), nullable=False)
    qty = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    broker_order_id = Column(String(50), nullable=True)
    source = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)

class PortfolioSnapshot(Base):
    __tablename__ = "invex_portfolio_snapshots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("invex_users.id", ondelete="CASCADE"), nullable=True, index=True)
    snapshot_date = Column(Date, nullable=False)
    account_id = Column(String(50), nullable=False)
    portfolio_value = Column(Float, nullable=False)
    invested_value = Column(Float, nullable=False)
    cash_balance = Column(Float, nullable=True)
    day_pnl = Column(Float, nullable=True)
    total_pnl = Column(Float, nullable=True)
