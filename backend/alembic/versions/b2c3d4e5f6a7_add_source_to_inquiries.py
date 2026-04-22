"""add source to summer_camp_inquiries

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-22

"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('summer_camp_inquiries', sa.Column('source', sa.String(), nullable=True))


def downgrade():
    op.drop_column('summer_camp_inquiries', 'source')
