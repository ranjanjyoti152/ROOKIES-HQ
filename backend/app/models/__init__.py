# Import all models so they are registered with Base.metadata
from app.models.organization import Organization
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.comment import Comment
from app.models.time_entry import TimeEntry
from app.models.notification import Notification
from app.models.tag import Tag, task_tags, project_tags
from app.models.lead import Lead, LeadFollowup
from app.models.automation_rule import AutomationRule
from app.models.leaderboard import LeaderboardEntry
from app.models.note import Note
from app.models.canvas_board import CanvasBoard
from app.models.project_members import ProjectMember

__all__ = [
    "Organization",
    "User",
    "Project",
    "Task",
    "Comment",
    "TimeEntry",
    "Notification",
    "Tag",
    "task_tags",
    "project_tags",
    "Lead",
    "LeadFollowup",
    "AutomationRule",
    "LeaderboardEntry",
    "Note",
    "CanvasBoard",
    "ProjectMember",
]
