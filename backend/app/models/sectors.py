from sqlalchemy import Column, String, DateTime
from app.core.database import Base

class Sector(Base):
    __tablename__ = "invex_sectors"
    symbol = Column(String(20), primary_key=True)
    sector = Column(String(50), nullable=False)
    industry = Column(String(50), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)
