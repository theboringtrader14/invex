"""Initial INVEX tables

Revision ID: 0001
Revises:
Create Date: 2026-03-15
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('invex_holdings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('exchange', sa.String(10), nullable=False),
        sa.Column('isin', sa.String(20), nullable=True),
        sa.Column('qty', sa.Integer(), nullable=False),
        sa.Column('avg_price', sa.Float(), nullable=False),
        sa.Column('ltp', sa.Float(), nullable=True),
        sa.Column('day_change', sa.Float(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table('invex_mf_holdings',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('fund_name', sa.String(200), nullable=False),
        sa.Column('isin', sa.String(20), nullable=True),
        sa.Column('units', sa.Float(), nullable=False),
        sa.Column('nav', sa.Float(), nullable=True),
        sa.Column('invested_amount', sa.Float(), nullable=True),
        sa.Column('current_value', sa.Float(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table('invex_equity_transactions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('trade_date', sa.Date(), nullable=False),
        sa.Column('direction', sa.String(5), nullable=False),
        sa.Column('qty', sa.Integer(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('broker_order_id', sa.String(50), nullable=True),
        sa.Column('source', sa.String(20), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_invex_transactions_account', 'invex_equity_transactions', ['account_id'])
    op.create_index('ix_invex_transactions_symbol', 'invex_equity_transactions', ['symbol'])
    op.create_table('invex_portfolio_snapshots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('snapshot_date', sa.Date(), nullable=False),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('portfolio_value', sa.Float(), nullable=False),
        sa.Column('invested_value', sa.Float(), nullable=False),
        sa.Column('cash_balance', sa.Float(), nullable=True),
        sa.Column('day_pnl', sa.Float(), nullable=True),
        sa.Column('total_pnl', sa.Float(), nullable=True),
    )
    op.create_index('ix_invex_snapshots_date', 'invex_portfolio_snapshots', ['snapshot_date'])
    op.create_table('invex_sips',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('exchange', sa.String(10), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('frequency', sa.String(20), nullable=False),
        sa.Column('frequency_day', sa.Integer(), nullable=True),
        sa.Column('frequency_date', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('total_invested', sa.Float(), server_default='0'),
        sa.Column('total_units', sa.Float(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table('invex_sip_executions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('sip_id', UUID(as_uuid=True), nullable=False),
        sa.Column('executed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('shares', sa.Integer(), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('broker_order_id', sa.String(50), nullable=True),
        sa.Column('status', sa.String(20), server_default='placed'),
    )
    op.create_table('invex_ipo_bots',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('exchange', sa.String(10), nullable=False),
        sa.Column('token', sa.Integer(), nullable=True),
        sa.Column('listing_date', sa.Date(), nullable=True),
        sa.Column('yearly_open', sa.Float(), nullable=True),
        sa.Column('prev_year_high', sa.Float(), nullable=True),
        sa.Column('prev_year_low', sa.Float(), nullable=True),
        sa.Column('upp1', sa.Float(), nullable=True),
        sa.Column('lpp1', sa.Float(), nullable=True),
        sa.Column('trade_amount', sa.Float(), server_default='10000'),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('status', sa.String(20), server_default='watching'),
        sa.Column('is_practix', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table('invex_ipo_orders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('bot_id', UUID(as_uuid=True), nullable=False),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('direction', sa.String(5), nullable=False),
        sa.Column('qty', sa.Integer(), nullable=False),
        sa.Column('entry_price', sa.Float(), nullable=True),
        sa.Column('exit_price', sa.Float(), nullable=True),
        sa.Column('entry_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('exit_time', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pnl', sa.Float(), nullable=True),
        sa.Column('status', sa.String(20), server_default='open'),
        sa.Column('broker_order_id', sa.String(50), nullable=True),
        sa.Column('signal_type', sa.String(20), nullable=True),
    )
    op.create_table('invex_watchlist',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', sa.String(50), nullable=False),
        sa.Column('symbol', sa.String(20), nullable=False),
        sa.Column('exchange', sa.String(10), nullable=False),
        sa.Column('added_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('price_alert_above', sa.Float(), nullable=True),
        sa.Column('price_alert_below', sa.Float(), nullable=True),
        sa.Column('rsi_alert_threshold', sa.Integer(), nullable=True),
        sa.Column('earnings_alert', sa.Boolean(), server_default='false'),
    )
    op.create_table('invex_sectors',
        sa.Column('symbol', sa.String(20), primary_key=True),
        sa.Column('sector', sa.String(50), nullable=False),
        sa.Column('industry', sa.String(50), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

def downgrade():
    for t in ['invex_sectors','invex_watchlist','invex_ipo_orders','invex_ipo_bots',
              'invex_sip_executions','invex_sips','invex_portfolio_snapshots',
              'invex_equity_transactions','invex_mf_holdings','invex_holdings']:
        op.drop_table(t)
