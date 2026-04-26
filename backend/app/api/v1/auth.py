"""Auth endpoints — register, login, me."""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.auth import verify_password, hash_password, create_access_token, get_current_user
from app.models.user import User
import uuid

logger = logging.getLogger(__name__)
router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str = ""


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check duplicate email
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        id=uuid.uuid4(),
        email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name or "",
        is_active=True,
        plan="free",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id))
    logger.info(f"[AUTH] Registered {user.email}")
    return {"access_token": token, "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(
        select(User).where(User.email == form.username.lower().strip())
    )).scalar_one_or_none()

    if not user or not verify_password(form.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account inactive")

    user.last_login = datetime.utcnow()
    await db.commit()

    token = create_access_token(str(user.id))
    logger.info(f"[AUTH] Login {user.email}")
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "full_name": current_user.full_name,
        "plan": current_user.plan,
        "is_verified": current_user.is_verified,
    }
