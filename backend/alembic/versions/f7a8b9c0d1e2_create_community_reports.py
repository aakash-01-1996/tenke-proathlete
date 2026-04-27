"""create community_reports table

Revision ID: f7a8b9c0d1e2
Revises: e6f7a8b9c0d1
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'f7a8b9c0d1e2'
down_revision = 'e6f7a8b9c0d1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'community_reports',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('content_type', sa.String(), nullable=False),
        sa.Column('content_id', UUID(as_uuid=True), nullable=False),
        sa.Column('post_id', UUID(as_uuid=True), nullable=False),
        sa.Column('reported_by_email', sa.String(), nullable=False),
        sa.Column('reason', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_community_reports_status', 'community_reports', ['status'])


def downgrade():
    op.drop_index('ix_community_reports_status', table_name='community_reports')
    op.drop_table('community_reports')
