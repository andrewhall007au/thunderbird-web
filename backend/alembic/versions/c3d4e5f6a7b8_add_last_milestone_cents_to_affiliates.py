"""add last_milestone_cents to affiliates

Revision ID: c3d4e5f6a7b8
Revises: 7af520d0f608
Create Date: 2026-01-21 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = '7af520d0f608'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add last_milestone_cents column to affiliates table for milestone email tracking."""
    with op.batch_alter_table('affiliates') as batch_op:
        batch_op.add_column(sa.Column('last_milestone_cents', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Remove last_milestone_cents column from affiliates table."""
    with op.batch_alter_table('affiliates') as batch_op:
        batch_op.drop_column('last_milestone_cents')
