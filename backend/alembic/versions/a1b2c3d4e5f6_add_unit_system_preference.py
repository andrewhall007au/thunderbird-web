"""add_unit_system_preference

Revision ID: a1b2c3d4e5f6
Revises: 3b3ffb2bb293
Create Date: 2026-01-20

Adds unit_system column to accounts table for user preference
between metric (Celsius, meters) and imperial (Fahrenheit, feet).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3b3ffb2bb293'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unit_system column to accounts table."""
    op.add_column(
        'accounts',
        sa.Column('unit_system', sa.String(10), nullable=False, server_default='metric')
    )


def downgrade() -> None:
    """Remove unit_system column from accounts table."""
    op.drop_column('accounts', 'unit_system')
