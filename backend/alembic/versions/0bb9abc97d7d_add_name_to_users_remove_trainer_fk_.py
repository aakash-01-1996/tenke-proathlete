"""add name to users remove trainer fk from members

Revision ID: 0bb9abc97d7d
Revises: e7de9ec8812e
Create Date: 2026-04-21 18:31:37.143082

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0bb9abc97d7d'
down_revision: Union[str, Sequence[str], None] = 'e7de9ec8812e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('first_name', sa.String(), nullable=True))
    op.add_column('users', sa.Column('last_name', sa.String(), nullable=True))
    op.drop_constraint('members_trainer_id_fkey', 'members', type_='foreignkey')


def downgrade() -> None:
    op.create_foreign_key(
        'members_trainer_id_fkey', 'members', 'trainers', ['trainer_id'], ['id']
    )
    op.drop_column('users', 'last_name')
    op.drop_column('users', 'first_name')
