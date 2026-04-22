"""add phone to users

Revision ID: a1b2c3d4e5f6
Revises: f3a1d2e4b5c6
Create Date: 2026-04-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = 'f3a1d2e4b5c6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('phone', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'phone')
