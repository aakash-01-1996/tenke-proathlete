"""make workout_exercises.category nullable

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-04-30
"""
from alembic import op

revision = 'd3e4f5a6b7c8'
down_revision = 'c2d3e4f5a6b7'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('workout_exercises', 'category', nullable=True)


def downgrade():
    op.alter_column('workout_exercises', 'category', nullable=False)
