"""add workspace pause fields

Revision ID: f7a1c2d9b4e6
Revises: 1e8e1d3ab7c5
Create Date: 2026-04-09 03:10:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7a1c2d9b4e6'
down_revision: Union[str, Sequence[str], None] = '1e8e1d3ab7c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('organizations', sa.Column('is_paused', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('organizations', sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'paused_at')
    op.drop_column('organizations', 'is_paused')
