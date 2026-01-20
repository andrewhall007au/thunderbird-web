"""add_unit_system_to_users

Revision ID: b2c3d4e5f6g7
Revises: a1b2c3d4e5f6
Create Date: 2026-01-20

Adds unit_system column to users table for SMS user preference
between metric (Celsius, meters) and imperial (Fahrenheit, feet).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6g7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add unit_system column to users table."""
    op.add_column(
        'users',
        sa.Column('unit_system', sa.String(10), nullable=False, server_default='metric')
    )


def downgrade() -> None:
    """Remove unit_system column from users table."""
    op.drop_column('users', 'unit_system')
