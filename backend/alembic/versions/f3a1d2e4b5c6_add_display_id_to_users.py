"""add display_id to users

Revision ID: f3a1d2e4b5c6
Revises: 0bb9abc97d7d
Create Date: 2026-04-21

"""
from alembic import op
import sqlalchemy as sa

revision = 'f3a1d2e4b5c6'
down_revision = '0bb9abc97d7d'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('display_id', sa.Integer(), nullable=True))
    op.create_unique_constraint('uq_users_display_id', 'users', ['display_id'])


def downgrade() -> None:
    op.drop_constraint('uq_users_display_id', 'users', type_='unique')
    op.drop_column('users', 'display_id')
