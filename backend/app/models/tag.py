import uuid
from datetime import datetime, timezone
from sqlalchemy import String, ForeignKey, Table, Column
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

# Association tables
task_tags = Table(
    "task_tags",
    Base.metadata,
    Column("task_id", UUID(as_uuid=True), ForeignKey("tasks.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

project_tags = Table(
    "project_tags",
    Base.metadata,
    Column("project_id", UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", UUID(as_uuid=True), ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str] = mapped_column(String(7), default="#6366f1")

    __table_args__ = (
        {"schema": None},
    )

    # Relationships
    organization = relationship("Organization", back_populates="tags")
    tasks = relationship("Task", secondary=task_tags, back_populates="tags")
    projects = relationship("Project", secondary=project_tags, back_populates="tags")
