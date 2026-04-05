import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="new_lead")
    value: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    organization = relationship("Organization", back_populates="leads")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    followups = relationship("LeadFollowup", back_populates="lead", cascade="all, delete-orphan")

    VALID_TRANSITIONS = {
        "new_lead": ["follow_ups"],
        "follow_ups": ["vfa"],
        "vfa": ["client_won", "closed"],
        "client_won": ["closed"],
        "closed": [],
    }

    def can_transition_to(self, target_status: str) -> bool:
        return target_status in self.VALID_TRANSITIONS.get(self.status, [])


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
