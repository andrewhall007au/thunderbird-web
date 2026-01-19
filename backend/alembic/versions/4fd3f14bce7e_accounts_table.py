"""accounts_table

Revision ID: 4fd3f14bce7e
Revises: 58ce9da45577
Create Date: 2026-01-19

Creates accounts table for web authentication.
Note: Accounts are distinct from Users (SMS hikers).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4fd3f14bce7e'
down_revision: Union[str, Sequence[str], None] = '58ce9da45577'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create accounts table."""
    op.create_table(
        'accounts',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('phone', sa.String(20), nullable=True),  # Linked in FOUN-05
        sa.Column('created_at', sa.String(30), nullable=False),
        sa.Column('updated_at', sa.String(30), nullable=False),
    )

    # Create index on email for fast lookups
    op.create_index('ix_accounts_email', 'accounts', ['email'], unique=True)


def downgrade() -> None:
    """Drop accounts table."""
    op.drop_index('ix_accounts_email', table_name='accounts')
    op.drop_table('accounts')
