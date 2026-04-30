"""
InvexAccounts API — broker account management for INVEX.

GET  /api/v1/accounts/                  — list all accounts (no secrets)
POST /api/v1/accounts/                  — add new account
PATCH /api/v1/accounts/{id}             — update api_key, totp_secret, nickname
POST /api/v1/accounts/{id}/refresh-token — re-login Angel One, store new JWT
"""
import logging
from datetime import datetime, timezone
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.auth import get_current_user
from app.models.invex_account import InvexAccount
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class AccountResponse(BaseModel):
    id: str
    nickname: str
    broker: str
    client_id: str
    is_active: bool
    has_jwt: bool
    last_synced_at: Optional[datetime]
    holdings_count: int
    sync_error: Optional[str]


class AccountCreate(BaseModel):
    nickname: str
    broker: str
    client_id: str
    api_key: Optional[str] = None
    totp_secret: Optional[str] = None
    password: Optional[str] = None


class AccountUpdate(BaseModel):
    nickname: Optional[str] = None
    api_key: Optional[str] = None
    totp_secret: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_response(acc: InvexAccount) -> dict:
    return {
        "id":             str(acc.id),
        "nickname":       acc.nickname,
        "broker":         acc.broker,
        "client_id":      acc.client_id,
        "is_active":      acc.is_active,
        "has_jwt":        acc.jwt_token is not None,
        "last_synced_at": acc.last_synced_at.isoformat() if acc.last_synced_at else None,
        "holdings_count": acc.holdings_count or 0,
        "sync_error":     acc.sync_error,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_accounts(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List broker accounts for the authenticated user."""
    result = await db.execute(
        select(InvexAccount)
        .where(InvexAccount.user_id == current_user.id)
        .order_by(InvexAccount.nickname)
    )
    accounts = result.scalars().all()
    return [_to_response(a) for a in accounts]


@router.post("/")
async def create_account(
    body: AccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Add a new broker account."""
    account = InvexAccount(
        id=uuid.uuid4(),
        user_id=current_user.id,
        nickname=body.nickname,
        broker=body.broker,
        client_id=body.client_id,
        api_key=body.api_key,
        totp_secret=body.totp_secret,
        password=body.password,
        is_active=True,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return _to_response(account)


@router.patch("/{account_id}")
async def update_account(
    account_id: str,
    body: AccountUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update nickname, api_key, totp_secret, password, or is_active."""
    result = await db.execute(
        select(InvexAccount).where(InvexAccount.id == account_id, InvexAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if body.nickname   is not None: account.nickname    = body.nickname
    if body.api_key    is not None: account.api_key     = body.api_key
    if body.totp_secret is not None: account.totp_secret = body.totp_secret
    if body.password   is not None: account.password    = body.password
    if body.is_active  is not None: account.is_active   = body.is_active

    await db.commit()
    return _to_response(account)


class RefreshTokenBody(BaseModel):
    totp: Optional[str] = None


@router.post("/{account_id}/refresh-token")
async def refresh_token(
    account_id: str,
    body: RefreshTokenBody = RefreshTokenBody(),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Re-authenticate with broker and store fresh JWT.

    Angel One: if a 6-digit TOTP code is supplied in the request body it is used
               directly (user copied it from their authenticator app).
               Otherwise falls back to auto-generating TOTP from stored totp_secret,
               then to pulling the latest token from STAAX DB.
    Zerodha:   Returns the Kite Connect OAuth URL (manual browser flow required).
    """
    result = await db.execute(
        select(InvexAccount).where(InvexAccount.id == account_id, InvexAccount.user_id == current_user.id)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.broker == "angelone":
        # ── Path 1: user-supplied 6-digit TOTP code ───────────────────────────
        user_totp = (body.totp or "").strip()
        if user_totp:
            if not account.api_key or not account.password:
                raise HTTPException(
                    status_code=400,
                    detail="api_key and password must be saved before using TOTP refresh"
                )
            try:
                from app.data_ingestion.angel_loader import angel_login_with_totp
                new_jwt = await angel_login_with_totp(
                    client_id=account.client_id,
                    password=account.password,
                    api_key=account.api_key,
                    totp_code=user_totp,
                )
                account.jwt_token = new_jwt
                account.sync_error = None
                await db.commit()
                logger.info(f"[ACCOUNTS] Refreshed JWT for {account.nickname} via user-supplied TOTP")
                # Trigger holdings sync and return count
                try:
                    from app.data_ingestion.angel_loader import load_angel_holdings
                    sync_result = await load_angel_holdings(db)
                    holdings_loaded = sync_result.get("total", 0)
                except Exception as sync_err:
                    logger.warning(f"[ACCOUNTS] Holdings sync after TOTP refresh failed: {sync_err}")
                    holdings_loaded = 0
                return {"success": True, "holdings_loaded": holdings_loaded, "nickname": account.nickname}
            except Exception as e:
                logger.warning(f"[ACCOUNTS] User-TOTP login failed for {account.nickname}: {e}")
                raise HTTPException(status_code=400, detail=str(e))

        # ── Path 2: auto-generate TOTP from stored secret ─────────────────────
        if account.api_key and account.password and account.totp_secret:
            try:
                from app.data_ingestion.angel_loader import angel_login
                new_jwt = await angel_login(
                    client_id=account.client_id,
                    password=account.password,
                    api_key=account.api_key,
                    totp_secret=account.totp_secret,
                )
                account.jwt_token = new_jwt
                account.sync_error = None
                await db.commit()
                logger.info(f"[ACCOUNTS] Refreshed JWT for {account.nickname} via TOTP")
                return {"status": "refreshed", "nickname": account.nickname}
            except Exception as e:
                logger.warning(f"[ACCOUNTS] TOTP login failed for {account.nickname}: {e}")

        # ── Fallback: pull latest access_token from STAAX DB ─────────────────
        try:
            from app.core.config import settings
            from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession as _AS
            from sqlalchemy.orm import sessionmaker
            from sqlalchemy import text

            staax_url = settings.database_url.replace("/invex_db", "/staax_db")
            _engine = create_async_engine(staax_url, pool_pre_ping=True, pool_size=1, max_overflow=0)
            _session = sessionmaker(_engine, class_=_AS, expire_on_commit=False)
            try:
                async with _session() as s:
                    row = await s.execute(
                        text("SELECT access_token, feed_token FROM accounts "
                             "WHERE client_id=:cid AND broker='angelone' LIMIT 1"),
                        {"cid": account.client_id}
                    )
                    staax_row = row.fetchone()
            finally:
                await _engine.dispose()

            if staax_row and staax_row[0]:
                account.jwt_token   = staax_row[0]
                account.feed_token  = staax_row[1]
                account.sync_error  = None
                await db.commit()
                logger.info(f"[ACCOUNTS] Pulled JWT from STAAX DB for {account.nickname}")
                return {"status": "refreshed_from_staax", "nickname": account.nickname}
        except Exception as e:
            logger.error(f"[ACCOUNTS] STAAX DB fallback failed: {e}")

        raise HTTPException(
            status_code=400,
            detail=f"Cannot refresh token for {account.nickname} — "
                   f"no totp_secret+password and STAAX DB pull failed"
        )

    elif account.broker == "zerodha":
        from app.core.config import settings
        api_key = account.api_key or settings.zerodha_api_key
        login_url = (
            f"https://kite.zerodha.com/connect/login?api_key={api_key}&v=3"
        )
        return {"status": "oauth_required", "login_url": login_url, "nickname": account.nickname}

    raise HTTPException(status_code=400, detail=f"Unknown broker: {account.broker}")
