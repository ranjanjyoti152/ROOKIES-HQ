"""widen leads status length

Revision ID: 670c83988889
Revises: 2a9d4f83c1b2
Create Date: 2026-04-12 15:52:30.516479

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = '670c83988889'
down_revision: Union[str, None] = '2a9d4f83c1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op on purpose.
    # The status length change is already introduced in 2a9d4f83c1b2 and
    # re-asserted in f1b6f58d2e11. We keep this revision for history only.
    pass


def downgrade() -> None:
    # No-op on purpose; see upgrade() note above.
    pass
