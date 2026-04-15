import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, Text, Integer, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="unassigned")
    priority: Mapped[str] = mapped_column(String(10), default="medium")
    task_type: Mapped[str] = mapped_column(String(20), default="short_form")
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    attachment_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    revision_badge_count: Mapped[int] = mapped_column(Integer, default=0)
    last_revision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_private: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("idx_tasks_org_project_status_created", "org_id", "project_id", "status", "created_at"),
    )

    # Relationships
    project = relationship("Project", back_populates="tasks")
    assigned_user = relationship("User", back_populates="assigned_tasks", foreign_keys=[assigned_user_id])
    created_by_user = relationship("User", foreign_keys=[created_by_user_id])
    comments = relationship("Comment", back_populates="task", cascade="all, delete-orphan")
    time_entries = relationship("TimeEntry", back_populates="task", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="task_tags", back_populates="tasks")

    # Valid status transitions
    VALID_TRANSITIONS = {
        "unassigned": ["claimed"],
        "claimed": ["editing"],
        "editing": ["internal_review"],
        "internal_review": ["revision", "delivered"],
        "revision": ["editing"],
        "delivered": ["revision", "closed"],
        "closed": [],
    }

    PRIVATE_TRANSITIONS = {
        "unassigned": ["claimed"],
        "claimed": ["editing", "closed"],
        "editing": ["internal_review", "closed"],
        "internal_review": ["revision", "delivered", "closed"],
        "revision": ["editing", "closed"],
        "delivered": ["revision", "closed"],
        "closed": ["claimed"],
    }

    def can_transition_to(self, target_status: str) -> bool:
        transitions = self.PRIVATE_TRANSITIONS if self.is_private else self.VALID_TRANSITIONS
        return target_status in transitions.get(self.status, [])
