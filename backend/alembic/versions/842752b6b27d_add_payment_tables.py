"""add_payment_tables

Revision ID: 842752b6b27d
Revises: 4fd3f14bce7e
Create Date: 2026-01-19 18:14:50.911673

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '842752b6b27d'
down_revision: Union[str, Sequence[str], None] = '4fd3f14bce7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create payment-related tables.

    Tables:
    - orders: Purchase records with Stripe integration
    - account_balances: Per-account balance tracking
    - transactions: Audit trail for all balance changes
    - discount_codes: Discount/promo code management

    Also adds stripe_customer_id to accounts table.
    """
    # Orders table
    op.create_table(
        'orders',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('order_type', sa.String(20), nullable=False),  # initial_access, top_up
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('stripe_session_id', sa.String(255), nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(255), nullable=True),
        sa.Column('discount_code_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.String(50), nullable=False),
        sa.Column('completed_at', sa.String(50), nullable=True),
    )
    op.create_index('ix_orders_account_id', 'orders', ['account_id'])
    op.create_index('ix_orders_stripe_session_id', 'orders', ['stripe_session_id'])

    # Account balances table (one per account)
    op.create_table(
        'account_balances',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('account_id', sa.Integer(), nullable=False, unique=True),
        sa.Column('balance_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('updated_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_account_balances_account_id', 'account_balances', ['account_id'])

    # Transactions table (audit trail)
    op.create_table(
        'transactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('transaction_type', sa.String(20), nullable=False),  # credit, debit, refund
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('balance_after_cents', sa.Integer(), nullable=False),
        sa.Column('description', sa.String(255), nullable=False),
        sa.Column('created_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_transactions_account_id', 'transactions', ['account_id'])

    # Discount codes table
    op.create_table(
        'discount_codes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('code', sa.String(50), nullable=False, unique=True),
        sa.Column('discount_type', sa.String(20), nullable=False),  # percent, fixed
        sa.Column('discount_value', sa.Integer(), nullable=False),
        sa.Column('max_uses', sa.Integer(), nullable=True),
        sa.Column('current_uses', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('stripe_coupon_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_discount_codes_code', 'discount_codes', ['code'])

    # Add stripe_customer_id to accounts table (for stored cards)
    with op.batch_alter_table('accounts') as batch_op:
        batch_op.add_column(sa.Column('stripe_customer_id', sa.String(255), nullable=True))


def downgrade() -> None:
    """Remove payment tables and stripe_customer_id column."""
    # Remove stripe_customer_id from accounts
    with op.batch_alter_table('accounts') as batch_op:
        batch_op.drop_column('stripe_customer_id')

    # Drop tables in reverse order of creation
    op.drop_index('ix_discount_codes_code', table_name='discount_codes')
    op.drop_table('discount_codes')

    op.drop_index('ix_transactions_account_id', table_name='transactions')
    op.drop_table('transactions')

    op.drop_index('ix_account_balances_account_id', table_name='account_balances')
    op.drop_table('account_balances')

    op.drop_index('ix_orders_stripe_session_id', table_name='orders')
    op.drop_index('ix_orders_account_id', table_name='orders')
    op.drop_table('orders')
