"""add affiliate tables

Revision ID: 7af520d0f608
Revises: b2c3d4e5f6g7
Create Date: 2026-01-21 15:37:37.861804

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7af520d0f608'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6g7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create affiliate tables for partner tracking and commission management."""

    # Affiliates table
    op.create_table(
        'affiliates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('discount_percent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('commission_percent', sa.Integer(), nullable=False, server_default='20'),
        sa.Column('trailing_months', sa.Integer(), nullable=True),
        sa.Column('payout_method', sa.String(20), nullable=True),
        sa.Column('payout_details', sa.String(500), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.String(50), nullable=False)
    )
    op.create_index('ix_affiliates_code', 'affiliates', ['code'])

    # Commissions table
    op.create_table(
        'commissions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('affiliate_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('sub_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.String(50), nullable=False),
        sa.Column('available_at', sa.String(50), nullable=True),
        sa.Column('paid_at', sa.String(50), nullable=True)
    )
    op.create_index('ix_commissions_affiliate_id', 'commissions', ['affiliate_id'])
    op.create_index('ix_commissions_status', 'commissions', ['status'])
    op.create_index('ix_commissions_account_id', 'commissions', ['account_id'])

    # Affiliate attributions table
    op.create_table(
        'affiliate_attributions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('affiliate_id', sa.Integer(), nullable=False),
        sa.Column('account_id', sa.Integer(), nullable=False, unique=True),
        sa.Column('order_id', sa.Integer(), nullable=False),
        sa.Column('sub_id', sa.String(100), nullable=True),
        sa.Column('trailing_expires_at', sa.String(50), nullable=True),
        sa.Column('created_at', sa.String(50), nullable=False)
    )
    op.create_index('ix_affiliate_attributions_account_id', 'affiliate_attributions', ['account_id'])
    op.create_index('ix_affiliate_attributions_affiliate_id', 'affiliate_attributions', ['affiliate_id'])

    # Affiliate clicks table
    op.create_table(
        'affiliate_clicks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('affiliate_id', sa.Integer(), nullable=False),
        sa.Column('sub_id', sa.String(100), nullable=True),
        sa.Column('session_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.String(50), nullable=False)
    )
    op.create_index('ix_affiliate_clicks_affiliate_id', 'affiliate_clicks', ['affiliate_id'])
    op.create_index('ix_affiliate_clicks_created_at', 'affiliate_clicks', ['created_at'])

    # Add affiliate_id column to discount_codes table
    with op.batch_alter_table('discount_codes') as batch_op:
        batch_op.add_column(sa.Column('affiliate_id', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Drop affiliate tables."""

    # Drop affiliate_id column from discount_codes
    with op.batch_alter_table('discount_codes') as batch_op:
        batch_op.drop_column('affiliate_id')

    # Drop tables in reverse order
    op.drop_index('ix_affiliate_clicks_created_at', 'affiliate_clicks')
    op.drop_index('ix_affiliate_clicks_affiliate_id', 'affiliate_clicks')
    op.drop_table('affiliate_clicks')

    op.drop_index('ix_affiliate_attributions_affiliate_id', 'affiliate_attributions')
    op.drop_index('ix_affiliate_attributions_account_id', 'affiliate_attributions')
    op.drop_table('affiliate_attributions')

    op.drop_index('ix_commissions_account_id', 'commissions')
    op.drop_index('ix_commissions_status', 'commissions')
    op.drop_index('ix_commissions_affiliate_id', 'commissions')
    op.drop_table('commissions')

    op.drop_index('ix_affiliates_code', 'affiliates')
    op.drop_table('affiliates')
