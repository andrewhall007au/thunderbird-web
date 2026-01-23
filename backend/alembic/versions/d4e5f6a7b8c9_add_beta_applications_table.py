"""add beta_applications table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-01-23 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create beta_applications table."""
    op.create_table(
        'beta_applications',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.Text(), nullable=False),
        sa.Column('email', sa.Text(), nullable=False),
        sa.Column('country', sa.Text(), nullable=False),
        sa.Column('status', sa.Text(), nullable=False, server_default='pending'),
        sa.Column('account_id', sa.Integer(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.Text(), nullable=False),
        sa.Column('reviewed_at', sa.Text(), nullable=True),
    )

    op.create_index('idx_beta_applications_email', 'beta_applications', ['email'], unique=True)
    op.create_index('idx_beta_applications_status', 'beta_applications', ['status'])


def downgrade() -> None:
    """Drop beta_applications table."""
    op.drop_index('idx_beta_applications_status', 'beta_applications')
    op.drop_index('idx_beta_applications_email', 'beta_applications')
    op.drop_table('beta_applications')
