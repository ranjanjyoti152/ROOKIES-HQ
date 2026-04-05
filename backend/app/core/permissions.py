from typing import List, Optional
from functools import wraps
from fastapi import HTTPException, status


# Define feature-to-role access map
# Admin has access to EVERYTHING (enforced separately)
ROLE_PERMISSIONS = {
    "dashboard":       ["admin", "manager", "editor", "hr", "marketing"],
    "arena":           ["admin", "manager", "editor"],
    "pipeline":        ["admin", "manager", "editor"],
    "projects":        ["admin", "manager", "editor", "marketing"],
    "leads":           ["admin", "manager", "marketing"],
    "automations":     ["admin", "manager"],
    "team":            ["admin", "manager", "hr"],
    "leaderboard":     ["admin", "manager", "editor", "hr", "marketing"],
    "my_work":         ["admin", "manager", "editor", "hr", "marketing"],
    "time_report":     ["admin", "manager", "editor", "hr"],
    "work_dashboard":  ["admin", "client"],
    "canvas":          ["admin", "manager", "editor"],
    "notes":           ["admin", "manager", "editor"],
    "notifications":   ["admin", "manager", "editor", "client", "hr", "marketing"],
    "user_management": ["admin"],
}


def check_permission(user_role: str, feature: str) -> bool:
    """Check if a user role has access to a feature. Admin always has access."""
    if user_role == "admin":
        return True
    allowed_roles = ROLE_PERMISSIONS.get(feature, [])
    return user_role in allowed_roles


def require_role(*allowed_roles: str):
    """Dependency factory: raises 403 if user role is not in allowed_roles. Admin always passes."""
    def checker(current_user):
        if current_user.role == "admin":
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user.role}' does not have access to this resource",
            )
        return current_user
    return checker


def get_sidebar_items(user) -> List[dict]:
    """Return sidebar menu items filtered by role and superadmin status."""
    all_items = [
        {"key": "dashboard",       "label": "Dashboard",       "icon": "LayoutDashboard",  "path": "/dashboard"},
        {"key": "arena",           "label": "Arena",           "icon": "Swords",           "path": "/arena"},
        {"key": "pipeline",        "label": "Pipeline",        "icon": "Kanban",           "path": "/pipeline"},
        {"key": "projects",        "label": "Projects",        "icon": "FolderOpen",       "path": "/projects"},
        {"key": "leads",           "label": "Leads",           "icon": "Target",           "path": "/leads"},
        {"key": "automations",     "label": "Automations",     "icon": "Zap",              "path": "/automations"},
        {"key": "team",            "label": "Team",            "icon": "Users",            "path": "/team"},
        {"key": "leaderboard",     "label": "Leaderboard",     "icon": "Trophy",           "path": "/leaderboard"},
        {"key": "my_work",         "label": "My Work",         "icon": "ClipboardList",    "path": "/my-work"},
        {"key": "time_report",     "label": "Time Report",     "icon": "Clock",            "path": "/time-report"},
        {"key": "work_dashboard",  "label": "Work Dashboard",  "icon": "Briefcase",        "path": "/work-dashboard"},
        {"key": "canvas",          "label": "Canvas",          "icon": "Palette",          "path": "/canvas"},
        {"key": "notes",           "label": "Notes",           "icon": "StickyNote",       "path": "/notes"},
        {"key": "notifications",   "label": "Notifications",   "icon": "Bell",             "path": "/notifications"},
    ]
    
    # Add Workspaces for superadmins
    if getattr(user, "is_superadmin", False):
        all_items.append({"key": "workspaces", "label": "Workspaces", "icon": "Building2", "path": "/workspaces"})
        
    return [item for item in all_items if item["key"] == "workspaces" or check_permission(user.role, item["key"])]
