"""add last_executed_at to invex_sips

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-15
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column('invex_sips', sa.Column('last_executed_at', sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    op.drop_column('invex_sips', 'last_executed_at')
