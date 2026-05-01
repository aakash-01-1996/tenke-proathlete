"""add workout_days table and day_id to workout_exercises

Revision ID: b1c2d3e4f5a6
Revises: a0b1c2d3e4f5
Create Date: 2026-04-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
import uuid

revision = 'b1c2d3e4f5a6'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Create workout_days table
    op.create_table(
        'workout_days',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False, server_default='Workout'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )
    op.create_index('ix_workout_days_member_id', 'workout_days', ['member_id'])

    # 2. Add day_id column to workout_exercises (nullable)
    op.add_column('workout_exercises', sa.Column('day_id', UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        'fk_workout_exercises_day_id',
        'workout_exercises', 'workout_days',
        ['day_id'], ['id'],
        ondelete='CASCADE',
    )

    # 3. Data migration — group existing exercises by member + category,
    #    create WorkoutDay rows, then point exercises at them.
    #    category order: upper→Day1, lower→Day2, core→Day3
    conn = op.get_bind()

    # Fetch all distinct (member_id, category) pairs that have exercises
    rows = conn.execute(sa.text(
        "SELECT DISTINCT member_id, category FROM workout_exercises ORDER BY member_id, category"
    )).fetchall()

    category_order = {'upper': 1, 'lower': 2, 'core': 3}
    category_label = {'upper': 'Upper Body', 'lower': 'Lower Body', 'core': 'Core'}

    # Build per-member day map
    member_day_map: dict = {}  # (member_id, category) -> day_id
    for member_id, category in rows:
        day_number = category_order.get(category, 1)
        label = category_label.get(category, 'Workout')
        day_id = str(uuid.uuid4())
        conn.execute(sa.text(
            "INSERT INTO workout_days (id, member_id, day_number, label) VALUES (:id, :member_id, :day_number, :label)"
        ), {"id": day_id, "member_id": str(member_id), "day_number": day_number, "label": label})
        member_day_map[(str(member_id), category)] = day_id

    # Update each exercise with its day_id
    for (member_id, category), day_id in member_day_map.items():
        conn.execute(sa.text(
            "UPDATE workout_exercises SET day_id = :day_id WHERE member_id = :member_id AND category = :category"
        ), {"day_id": day_id, "member_id": member_id, "category": category})


def downgrade():
    op.drop_constraint('fk_workout_exercises_day_id', 'workout_exercises', type_='foreignkey')
    op.drop_column('workout_exercises', 'day_id')
    op.drop_index('ix_workout_days_member_id', table_name='workout_days')
    op.drop_table('workout_days')
