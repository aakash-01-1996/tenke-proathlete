"""add ai plan generation and nutrition tables

Revision ID: 9d06205f6f63
Revises: d3e4f5a6b7c8
Create Date: 2026-10-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ENUM

revision = '9d06205f6f63'
down_revision = 'd3e4f5a6b7c8'
branch_labels = None
depends_on = None

# create_type=False: the type is created explicitly below via .create(checkfirst=True);
# without this, each CREATE TABLE using the enum tries to recreate the type and errors.
ai_plan_request_status = ENUM('pending', 'approved', 'denied', 'failed', name='aiplanrequeststatus', create_type=False)


def upgrade():
    ai_plan_request_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        'athlete_profiles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False, unique=True),
        sa.Column('primary_goal', sa.String(), nullable=True),
        sa.Column('secondary_goals', sa.String(), nullable=True),
        sa.Column('workout_style', sa.String(), nullable=True),
        sa.Column('experience_level', sa.String(), nullable=True),
        sa.Column('target_weight', sa.String(), nullable=True),
        sa.Column('sessions_per_week_pref', sa.Integer(), nullable=True),
        sa.Column('equipment_access', sa.String(), nullable=True),
        sa.Column('injury_notes', sa.Text(), nullable=True),
        sa.Column('dietary_preferences', sa.String(), nullable=True),
        sa.Column('allergies', sa.Text(), nullable=True),
        sa.Column('daily_calorie_target', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'ai_workout_plan_requests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by', UUID(as_uuid=True), nullable=False),
        sa.Column('trigger_source', sa.String(), nullable=False),
        sa.Column('status', ai_plan_request_status, nullable=False, server_default='pending'),
        sa.Column('model_used', sa.String(), nullable=True),
        sa.Column('raw_response_json', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('coach_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'ai_workout_plan_days',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('request_id', UUID(as_uuid=True), sa.ForeignKey('ai_workout_plan_requests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False, server_default='Workout'),
    )

    op.create_table(
        'ai_workout_plan_exercises',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('plan_day_id', UUID(as_uuid=True), sa.ForeignKey('ai_workout_plan_days.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sets', sa.Integer(), nullable=True),
        sa.Column('reps', sa.Integer(), nullable=True),
        sa.Column('duration', sa.String(), nullable=True),
        sa.Column('is_rest', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('rest_seconds', sa.Integer(), nullable=True),
        sa.Column('ai_rationale', sa.Text(), nullable=True),
    )

    op.create_table(
        'nutrition_plans',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('daily_calories', sa.Integer(), nullable=True),
        sa.Column('daily_protein_g', sa.Integer(), nullable=True),
        sa.Column('daily_carbs_g', sa.Integer(), nullable=True),
        sa.Column('daily_fat_g', sa.Integer(), nullable=True),
        sa.Column('summary_notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
    )

    op.create_table(
        'nutrition_meals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('plan_id', UUID(as_uuid=True), sa.ForeignKey('nutrition_plans.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meal_order', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False, server_default='Meal'),
        sa.Column('food_items', sa.Text(), nullable=True),
        sa.Column('calories', sa.Integer(), nullable=True),
        sa.Column('protein_g', sa.Integer(), nullable=True),
        sa.Column('carbs_g', sa.Integer(), nullable=True),
        sa.Column('fat_g', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )

    op.create_table(
        'ai_nutrition_plan_requests',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('member_id', UUID(as_uuid=True), sa.ForeignKey('members.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by', UUID(as_uuid=True), nullable=False),
        sa.Column('trigger_source', sa.String(), nullable=False),
        sa.Column('status', ai_plan_request_status, nullable=False, server_default='pending'),
        sa.Column('model_used', sa.String(), nullable=True),
        sa.Column('raw_response_json', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('coach_notes', sa.Text(), nullable=True),
        sa.Column('daily_calories', sa.Integer(), nullable=True),
        sa.Column('daily_protein_g', sa.Integer(), nullable=True),
        sa.Column('daily_carbs_g', sa.Integer(), nullable=True),
        sa.Column('daily_fat_g', sa.Integer(), nullable=True),
        sa.Column('summary_notes', sa.Text(), nullable=True),
        sa.Column('reviewed_by', UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        'ai_nutrition_plan_meals',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('request_id', UUID(as_uuid=True), sa.ForeignKey('ai_nutrition_plan_requests.id', ondelete='CASCADE'), nullable=False),
        sa.Column('meal_order', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(), nullable=False, server_default='Meal'),
        sa.Column('food_items', sa.Text(), nullable=True),
        sa.Column('calories', sa.Integer(), nullable=True),
        sa.Column('protein_g', sa.Integer(), nullable=True),
        sa.Column('carbs_g', sa.Integer(), nullable=True),
        sa.Column('fat_g', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
    )


def downgrade():
    op.drop_table('ai_nutrition_plan_meals')
    op.drop_table('ai_nutrition_plan_requests')
    op.drop_table('nutrition_meals')
    op.drop_table('nutrition_plans')
    op.drop_table('ai_workout_plan_exercises')
    op.drop_table('ai_workout_plan_days')
    op.drop_table('ai_workout_plan_requests')
    op.drop_table('athlete_profiles')
    ai_plan_request_status.drop(op.get_bind(), checkfirst=True)
