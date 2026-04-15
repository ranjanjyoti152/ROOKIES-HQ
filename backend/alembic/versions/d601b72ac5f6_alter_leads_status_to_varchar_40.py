"""alter leads status to varchar 40

Revision ID: d601b72ac5f6
Revises: 670c83988889
Create Date: 2026-04-12 15:52:59.299798

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'd601b72ac5f6'
down_revision: Union[str, None] = '670c83988889'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # No-op on purpose.
    # This duplicate widening revision is retained for revision-chain stability;
    # the authoritative widening is enforced by f1b6f58d2e11.
    pass


def downgrade() -> None:
    # No-op on purpose; see upgrade() note above.
    pass
