"""create workout_exercises table

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-04-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'd5e6f7a8b9c0'
down_revision = 'c4d5e6f7a8b9'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'workout_exercises',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('category', sa.String(), nullable=False),   # 'upper' | 'lower' | 'core'
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sets', sa.Integer(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.Column('duration', sa.String(), nullable=True),    # e.g. "20 min", "30 sec"
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_workout_exercises_member_id', 'workout_exercises', ['member_id'])


def downgrade():
    op.drop_index('ix_workout_exercises_member_id', table_name='workout_exercises')
    op.drop_table('workout_exercises')
