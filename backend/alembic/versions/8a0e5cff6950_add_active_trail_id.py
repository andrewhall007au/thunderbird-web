"""add_active_trail_id

Revision ID: 8a0e5cff6950
Revises: d4e5f6a7b8c9
Create Date: 2026-01-28 17:17:53.294112

Adds active_trail_id column to accounts table for multi-trail SMS selection.
This tracks which trail is currently active for SMS commands.

Note: SQLite does not support adding foreign key constraints in ALTER TABLE,
but this column logically references custom_routes.id.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8a0e5cff6950'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add active_trail_id column and index to accounts table."""
    op.add_column(
        'accounts',
        sa.Column('active_trail_id', sa.Integer(), nullable=True)
    )
    op.create_index(
        'ix_accounts_active_trail_id',
        'accounts',
        ['active_trail_id']
    )


def downgrade() -> None:
    """Remove active_trail_id column and index from accounts table."""
    op.drop_index('ix_accounts_active_trail_id', table_name='accounts')
    op.drop_column('accounts', 'active_trail_id')
