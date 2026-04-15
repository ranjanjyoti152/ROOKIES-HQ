# Import all models so they are registered with Base.metadata
from app.models.organization import Organization
from app.models.user import User
from app.models.project import Project
from app.models.task import Task
from app.models.comment import Comment
from app.models.time_entry import TimeEntry
from app.models.notification import Notification
from app.models.tag import Tag, task_tags, project_tags
from app.models.user_tag_assignment import UserTagAssignment
from app.models.lead import Lead, LeadFollowup
from app.models.automation_rule import AutomationRule
from app.models.leaderboard import LeaderboardEntry
from app.models.note import Note
from app.models.canvas_board import CanvasBoard
from app.models.project_members import ProjectMember
from app.models.video_asset import VideoAsset
from app.models.productivity_logbook import ProductivityLogbookEntry
from app.models.ai_provider_setting import AIProviderSetting
from app.models.ai_chat import AIChat
from app.models.ai_message import AIMessage
from app.models.ai_memory import AIMemory

__all__ = [
    "Organization",
    "User",
    "Project",
    "Task",
    "Comment",
    "TimeEntry",
    "Notification",
    "Tag",
    "UserTagAssignment",
    "task_tags",
    "project_tags",
    "Lead",
    "LeadFollowup",
    "AutomationRule",
    "LeaderboardEntry",
    "Note",
    "CanvasBoard",
    "ProjectMember",
    "VideoAsset",
    "ProductivityLogbookEntry",
    "AIProviderSetting",
    "AIChat",
    "AIMessage",
    "AIMemory",
]
