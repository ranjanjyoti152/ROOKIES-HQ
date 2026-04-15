"""force alter leads status len 40

Revision ID: f1b6f58d2e11
Revises: d601b72ac5f6
Create Date: 2026-04-12 16:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1b6f58d2e11'
down_revision: Union[str, None] = 'd601b72ac5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep this revision as the single authoritative status-width enforcement.
    op.execute(
        sa.text(
            """
            ALTER TABLE leads
            ALTER COLUMN status TYPE VARCHAR(40)
            """
        )
    )
    op.execute(
        sa.text(
            """
            ALTER TABLE leads
            ALTER COLUMN status SET NOT NULL
            """
        )
    )


def downgrade() -> None:
    # Guard downgrade to avoid silent truncation.
    op.execute(
        sa.text(
            """
            DO $$
            DECLARE
                too_long_count integer;
            BEGIN
                SELECT COUNT(*) INTO too_long_count
                FROM leads
                WHERE char_length(status) > 20;

                IF too_long_count > 0 THEN
                    RAISE EXCEPTION
                        'Cannot downgrade leads.status to VARCHAR(20): % rows exceed 20 chars',
                        too_long_count;
                END IF;
            END $$;
            """
        )
    )
    op.execute(
        sa.text(
            """
            ALTER TABLE leads
            ALTER COLUMN status TYPE VARCHAR(20)
            """
        )
    )
