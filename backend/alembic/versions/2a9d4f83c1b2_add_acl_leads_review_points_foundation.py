"""add_acl_leads_review_points_foundation

Revision ID: 2a9d4f83c1b2
Revises: f7a1c2d9b4e6
Create Date: 2026-04-11 23:55:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "2a9d4f83c1b2"
down_revision: Union[str, Sequence[str], None] = "f7a1c2d9b4e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column("leads", "status", existing_type=sa.String(length=20), type_=sa.String(length=40), existing_nullable=False)

    # tags
    op.add_column("tags", sa.Column("kind", sa.String(length=20), nullable=False, server_default="task"))
    op.add_column("tags", sa.Column("parent_tag_id", sa.UUID(), nullable=True))
    op.add_column(
        "tags",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_foreign_key("fk_tags_parent", "tags", "tags", ["parent_tag_id"], ["id"], ondelete="SET NULL")

    # users
    op.add_column("users", sa.Column("nickname", sa.String(length=80), nullable=True))
    op.add_column(
        "users",
        sa.Column("role_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.create_index(
        "uq_users_org_nickname_not_null",
        "users",
        ["org_id", "nickname"],
        unique=True,
        postgresql_where=sa.text("nickname IS NOT NULL"),
    )

    # projects
    op.add_column("projects", sa.Column("tag_key", sa.String(length=64), nullable=True))
    op.add_column("projects", sa.Column("project_tag_id", sa.UUID(), nullable=True))
    op.add_column("projects", sa.Column("lead_id", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_projects_project_tag", "projects", "tags", ["project_tag_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_projects_lead", "projects", "leads", ["lead_id"], ["id"], ondelete="SET NULL")
    op.create_unique_constraint("uq_projects_org_tag_key", "projects", ["org_id", "tag_key"])

    # tasks
    op.add_column("tasks", sa.Column("created_by_user_id", sa.UUID(), nullable=True))
    op.add_column("tasks", sa.Column("is_flagged", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("tasks", sa.Column("revision_badge_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("tasks", sa.Column("last_revision_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_tasks_created_by_user", "tasks", "users", ["created_by_user_id"], ["id"], ondelete="SET NULL")

    # leads
    op.add_column("leads", sa.Column("contact_email", sa.String(length=255), nullable=True))
    op.add_column("leads", sa.Column("site_url", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("reference_link", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("priority", sa.String(length=10), nullable=False, server_default="medium"))
    op.add_column("leads", sa.Column("niche", sa.String(length=100), nullable=True))
    op.add_column("leads", sa.Column("custom_comments", sa.Text(), nullable=True))
    op.add_column("leads", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "leads",
        sa.Column("task_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column(
        "leads",
        sa.Column("niche_tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
    )
    op.add_column("leads", sa.Column("converted_project_id", sa.UUID(), nullable=True))
    op.add_column("leads", sa.Column("converted_task_id", sa.UUID(), nullable=True))
    op.add_column("leads", sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key("fk_leads_converted_project", "leads", "projects", ["converted_project_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_leads_converted_task", "leads", "tasks", ["converted_task_id"], ["id"], ondelete="SET NULL")

    # lead stage migration (old -> new)
    op.execute(
        sa.text(
            """
            UPDATE leads
            SET status = CASE status
                WHEN 'new_lead' THEN 'new_lead'
                WHEN 'follow_ups' THEN 'first_follow_up'
                WHEN 'vfa' THEN 'vfa_send'
                WHEN 'client_won' THEN 'client_won'
                WHEN 'closed' THEN 'closed'
                ELSE 'new_lead'
            END
            """
        )
    )

    # comments
    op.add_column("comments", sa.Column("video_timestamp_ms", sa.Integer(), nullable=True))
    op.add_column("comments", sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("comments", sa.Column("resolved_by", sa.UUID(), nullable=True))
    op.create_foreign_key("fk_comments_resolved_by", "comments", "users", ["resolved_by"], ["id"], ondelete="SET NULL")

    # leaderboard entries
    op.add_column("leaderboard_entries", sa.Column("category", sa.String(length=80), nullable=True))
    op.add_column("leaderboard_entries", sa.Column("is_penalty", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("leaderboard_entries", sa.Column("entry_type", sa.String(length=20), nullable=False, server_default="auto"))
    op.add_column(
        "leaderboard_entries",
        sa.Column("meta", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
    )

    # user_tag_assignments
    op.create_table(
        "user_tag_assignments",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("tag_id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["tag_id"], ["tags.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "tag_id"),
    )

    # video_assets
    op.create_table(
        "video_assets",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("thumbnail_url", sa.Text(), nullable=True),
        sa.Column("video_url", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="pending_review"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # productivity_logbook_entries
    op.create_table(
        "productivity_logbook_entries",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("org_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("task_id", sa.UUID(), nullable=False),
        sa.Column("project_id", sa.UUID(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="closed"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["task_id"], ["tasks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    # indexes
    op.create_index("idx_tags_org_kind", "tags", ["org_id", "kind"], unique=False)
    op.create_index("idx_projects_org_project_tag", "projects", ["org_id", "project_tag_id"], unique=False)
    op.create_index("idx_tasks_org_project_status_created", "tasks", ["org_id", "project_id", "status", "created_at"], unique=False)


def downgrade() -> None:
    op.drop_index("idx_tasks_org_project_status_created", table_name="tasks")
    op.drop_index("idx_projects_org_project_tag", table_name="projects")
    op.drop_index("idx_tags_org_kind", table_name="tags")

    op.drop_table("productivity_logbook_entries")
    op.drop_table("video_assets")
    op.drop_table("user_tag_assignments")

    op.drop_column("leaderboard_entries", "meta")
    op.drop_column("leaderboard_entries", "entry_type")
    op.drop_column("leaderboard_entries", "is_penalty")
    op.drop_column("leaderboard_entries", "category")

    op.drop_constraint("fk_comments_resolved_by", "comments", type_="foreignkey")
    op.drop_column("comments", "resolved_by")
    op.drop_column("comments", "resolved_at")
    op.drop_column("comments", "video_timestamp_ms")

    op.drop_constraint("fk_leads_converted_task", "leads", type_="foreignkey")
    op.drop_constraint("fk_leads_converted_project", "leads", type_="foreignkey")
    op.drop_column("leads", "converted_at")
    op.drop_column("leads", "converted_task_id")
    op.drop_column("leads", "converted_project_id")
    op.drop_column("leads", "niche_tags")
    op.drop_column("leads", "task_tags")
    op.drop_column("leads", "description")
    op.drop_column("leads", "custom_comments")
    op.drop_column("leads", "niche")
    op.drop_column("leads", "priority")
    op.drop_column("leads", "reference_link")
    op.drop_column("leads", "site_url")
    op.drop_column("leads", "contact_email")

    op.drop_constraint("fk_tasks_created_by_user", "tasks", type_="foreignkey")
    op.drop_column("tasks", "last_revision_at")
    op.drop_column("tasks", "revision_badge_count")
    op.drop_column("tasks", "is_flagged")
    op.drop_column("tasks", "created_by_user_id")

    op.drop_constraint("uq_projects_org_tag_key", "projects", type_="unique")
    op.drop_constraint("fk_projects_lead", "projects", type_="foreignkey")
    op.drop_constraint("fk_projects_project_tag", "projects", type_="foreignkey")
    op.drop_column("projects", "lead_id")
    op.drop_column("projects", "project_tag_id")
    op.drop_column("projects", "tag_key")

    op.drop_index("uq_users_org_nickname_not_null", table_name="users")
    op.drop_column("users", "role_tags")
    op.drop_column("users", "nickname")

    op.drop_constraint("fk_tags_parent", "tags", type_="foreignkey")
    op.drop_column("tags", "created_at")
    op.drop_column("tags", "parent_tag_id")
    op.drop_column("tags", "kind")

    op.alter_column("leads", "status", existing_type=sa.String(length=40), type_=sa.String(length=20), existing_nullable=False)
