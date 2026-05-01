"""add training_time to members

Revision ID: a0b1c2d3e4f5
Revises: f7a8b9c0d1e2
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'a0b1c2d3e4f5'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('members', sa.Column('training_time', sa.String(), nullable=True))


def downgrade():
    op.drop_column('members', 'training_time')
