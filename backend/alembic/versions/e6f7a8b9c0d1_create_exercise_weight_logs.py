"""create exercise_weight_logs table

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'e6f7a8b9c0d1'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'exercise_weight_logs',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('exercise_id', UUID(as_uuid=True),
                  sa.ForeignKey('workout_exercises.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('weight', sa.String(), nullable=False),
        sa.Column('logged_at', sa.Date(), nullable=False,
                  server_default=sa.text('CURRENT_DATE')),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),
    )
    op.create_index('ix_exercise_weight_logs_exercise_id',
                    'exercise_weight_logs', ['exercise_id'])


def downgrade():
    op.drop_index('ix_exercise_weight_logs_exercise_id',
                  table_name='exercise_weight_logs')
    op.drop_table('exercise_weight_logs')
