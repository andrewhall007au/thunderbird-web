"""add_custom_routes_tables

Revision ID: 3b3ffb2bb293
Revises: 842752b6b27d
Create Date: 2026-01-19 19:14:30.774217

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3b3ffb2bb293'
down_revision: Union[str, Sequence[str], None] = '842752b6b27d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create custom route tables for Phase 3: Route Creation.

    Tables:
    - custom_routes: User-created routes with GPX data
    - custom_waypoints: Waypoints with globally unique SMS codes
    - route_library: Admin-uploaded popular trails for cloning
    """
    # custom_routes table
    op.create_table(
        'custom_routes',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('account_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('gpx_data', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
        sa.Column('is_library_clone', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('source_library_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.String(50), nullable=False),
        sa.Column('updated_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_custom_routes_account_id', 'custom_routes', ['account_id'])

    # custom_waypoints table
    op.create_table(
        'custom_waypoints',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('route_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.String(20), nullable=False, server_default='poi'),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('sms_code', sa.String(5), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('elevation', sa.Float(), nullable=False, server_default='0'),
        sa.Column('order_index', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.String(50), nullable=False),
    )
    op.create_index('ix_custom_waypoints_route_id', 'custom_waypoints', ['route_id'])
    op.create_index('ix_custom_waypoints_sms_code', 'custom_waypoints', ['sms_code'], unique=True)

    # route_library table
    op.create_table(
        'route_library',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('gpx_data', sa.JSON(), nullable=True),
        sa.Column('country', sa.String(100), nullable=True),
        sa.Column('region', sa.String(255), nullable=True),
        sa.Column('difficulty_grade', sa.Integer(), nullable=True),
        sa.Column('distance_km', sa.Float(), nullable=True),
        sa.Column('typical_days', sa.String(50), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.String(50), nullable=False),
        sa.Column('updated_at', sa.String(50), nullable=True),
    )
    op.create_index('ix_route_library_is_active', 'route_library', ['is_active'])


def downgrade() -> None:
    """Remove custom route tables."""
    # Drop indexes and tables in reverse order
    op.drop_index('ix_route_library_is_active', table_name='route_library')
    op.drop_table('route_library')

    op.drop_index('ix_custom_waypoints_sms_code', table_name='custom_waypoints')
    op.drop_index('ix_custom_waypoints_route_id', table_name='custom_waypoints')
    op.drop_table('custom_waypoints')

    op.drop_index('ix_custom_routes_account_id', table_name='custom_routes')
    op.drop_table('custom_routes')
