import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    site_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_link: Mapped[str | None] = mapped_column(Text, nullable=True)
    priority: Mapped[str] = mapped_column(String(10), default="medium", nullable=False)
    niche: Mapped[str | None] = mapped_column(String(100), nullable=True)
    custom_comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    niche_tags: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="new_lead")
    value: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    converted_project_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)
    converted_task_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="leads")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    followups = relationship("LeadFollowup", back_populates="lead", cascade="all, delete-orphan")

    STATUS_ALIASES = {
        "working_on_valuefirst": "working_on_value_first",
        "working on value first": "working_on_value_first",
        "working_on_value first": "working_on_value_first",
        "working-on-value-first": "working_on_value_first",
    }

    VALID_TRANSITIONS = {
        "new_lead": ["first_follow_up"],
        "first_follow_up": ["second_follow_up"],
        "second_follow_up": ["go_to_reply"],
        "go_to_reply": ["working_on_value_first"],
        "working_on_value_first": ["vfa_send"],
        "vfa_send": ["client_won", "closed"],
        "client_won": ["closed"],
        "closed": [],
    }

    @classmethod
    def normalize_status(cls, status: str | None) -> str:
        normalized = (status or "").strip().lower()
        return cls.STATUS_ALIASES.get(normalized, normalized)

    def can_transition_to(self, target_status: str) -> bool:
        current = self.normalize_status(self.status)
        target = self.normalize_status(target_status)
        return target in self.VALID_TRANSITIONS.get(current, [])


class LeadFollowup(Base):
    __tablename__ = "lead_followups"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    note: Mapped[str] = mapped_column(Text, nullable=False)
    follow_up_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # Relationships
    lead = relationship("Lead", back_populates="followups")
    user = relationship("User", foreign_keys=[user_id])
