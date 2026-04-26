from sqlalchemy import Column, String, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from app.core.database import Base


class User(Base):
    __tablename__ = "invex_users"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email          = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name      = Column(String, nullable=True)
    is_active      = Column(Boolean, default=True)
    is_verified    = Column(Boolean, default=False)
    plan           = Column(String, default="free")  # free | starter | pro | family
    created_at     = Column(DateTime, default=datetime.utcnow)
    last_login     = Column(DateTime, nullable=True)
