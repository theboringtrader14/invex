"""add invex_accounts table

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'invex_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('nickname', sa.String(50), nullable=False),
        sa.Column('broker', sa.String(20), nullable=False),
        sa.Column('client_id', sa.String(50), nullable=False),
        sa.Column('api_key', sa.String(255), nullable=True),
        sa.Column('totp_secret', sa.String(255), nullable=True),
        sa.Column('password', sa.String(255), nullable=True),
        sa.Column('jwt_token', sa.Text, nullable=True),
        sa.Column('feed_token', sa.String(255), nullable=True),
        sa.Column('refresh_token', sa.String(255), nullable=True),
        sa.Column('token_expiry', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('holdings_count', sa.Integer, default=0),
        sa.Column('sync_error', sa.Text, nullable=True),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('invex_accounts')
