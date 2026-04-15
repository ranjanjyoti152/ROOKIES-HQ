import uuid
from datetime import datetime, timezone
from sqlalchemy import String, DateTime, ForeignKey, Text, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tag_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    project_tag_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tags.id", ondelete="SET NULL"), nullable=True)
    lead_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True)
    client_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("org_id", "tag_key", name="uq_projects_org_tag_key"),
        Index("idx_projects_org_project_tag", "org_id", "project_tag_id"),
    )

    # Relationships
    organization = relationship("Organization", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="project", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="project_tags", back_populates="projects")
    project_tag = relationship("Tag", foreign_keys=[project_tag_id])
    lead = relationship("Lead", foreign_keys=[lead_id])
    memberships = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    assigned_members = relationship("User", secondary="project_members", viewonly=True, primaryjoin="Project.id == ProjectMember.project_id", secondaryjoin="and_(ProjectMember.user_id == User.id, ProjectMember.status != 'rejected')")
