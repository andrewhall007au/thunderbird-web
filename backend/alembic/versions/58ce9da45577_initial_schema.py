"""initial_schema

Revision ID: 58ce9da45577
Revises:
Create Date: 2026-01-19

Creates the initial database schema matching existing Thunderbird tables.
This migration allows new installations to create the database from scratch.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '58ce9da45577'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial tables matching existing schema."""

    # Users table - registered hikers with trip info
    op.create_table(
        'users',
        sa.Column('phone', sa.String(20), primary_key=True),
        sa.Column('route_id', sa.String(50), nullable=False),
        sa.Column('start_date', sa.String(10), nullable=True),
        sa.Column('end_date', sa.String(10), nullable=True),
        sa.Column('trail_name', sa.String(100), nullable=True),
        sa.Column('direction', sa.String(20), server_default='standard'),
        sa.Column('current_position', sa.String(50), nullable=True),
        sa.Column('last_checkin_at', sa.String(30), nullable=True),
        sa.Column('status', sa.String(20), server_default='registered'),
        sa.Column('created_at', sa.String(30), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.String(30), server_default=sa.text('CURRENT_TIMESTAMP')),
    )

    # SafeCheck contacts table - emergency contacts for users
    op.create_table(
        'safecheck_contacts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_phone', sa.String(20), nullable=False),
        sa.Column('contact_phone', sa.String(20), nullable=False),
        sa.Column('contact_name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.String(30), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['user_phone'], ['users.phone'], ondelete='CASCADE'),
        sa.UniqueConstraint('user_phone', 'contact_phone'),
    )

    # Message log table - SMS message tracking with cost analytics
    op.create_table(
        'message_log',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_phone', sa.String(20), nullable=True),
        sa.Column('direction', sa.String(10), nullable=False),
        sa.Column('message_type', sa.String(30), nullable=True),
        sa.Column('command_type', sa.String(30), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('segments', sa.Integer(), server_default='1'),
        sa.Column('cost_aud', sa.Float(), server_default='0'),
        sa.Column('sent_at', sa.String(30), server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('success', sa.Integer(), server_default='1'),
    )

    # Create indexes for message_log analytics queries
    op.create_index('idx_message_log_sent_at', 'message_log', ['sent_at'])
    op.create_index('idx_message_log_user', 'message_log', ['user_phone'])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_index('idx_message_log_user', 'message_log')
    op.drop_index('idx_message_log_sent_at', 'message_log')
    op.drop_table('message_log')
    op.drop_table('safecheck_contacts')
    op.drop_table('users')
