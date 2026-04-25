"""add training_goal to members

Revision ID: c4d5e6f7a8b9
Revises: b2c3d4e5f6a7
Create Date: 2026-04-25

"""
from alembic import op
import sqlalchemy as sa

revision = 'c4d5e6f7a8b9'
down_revision = 'b2c3d4e5f6a7'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('members', sa.Column('training_goal', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('members', 'training_goal')
