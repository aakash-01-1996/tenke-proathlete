"""add is_rest and rest_seconds to workout_exercises

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa

revision = 'c2d3e4f5a6b7'
down_revision = 'b1c2d3e4f5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('workout_exercises', sa.Column('is_rest', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('workout_exercises', sa.Column('rest_seconds', sa.Integer(), nullable=True))


def downgrade():
    op.drop_column('workout_exercises', 'rest_seconds')
    op.drop_column('workout_exercises', 'is_rest')
