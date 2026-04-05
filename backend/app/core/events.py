from typing import Any, Callable, Dict, List
from collections import defaultdict
import asyncio


class EventBus:
    """Simple in-process event bus for automation triggers."""

    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: Callable):
        self._handlers[event_type].append(handler)

    def unsubscribe(self, event_type: str, handler: Callable):
        if handler in self._handlers[event_type]:
            self._handlers[event_type].remove(handler)

    async def publish(self, event_type: str, data: Dict[str, Any]):
        handlers = self._handlers.get(event_type, [])
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    await handler(data)
                else:
                    handler(data)
            except Exception as e:
                print(f"Event handler error for '{event_type}': {e}")


# Singleton event bus
event_bus = EventBus()

# Event type constants
EVENT_TASK_STATUS_CHANGED = "task.status_changed"
EVENT_TASK_ASSIGNED = "task.assigned"
EVENT_TASK_CREATED = "task.created"
EVENT_COMMENT_ADDED = "comment.added"
EVENT_LEAD_STATUS_CHANGED = "lead.status_changed"
EVENT_LEAD_CONVERTED = "lead.converted"
EVENT_USER_CHECKED_IN = "user.checked_in"
EVENT_USER_CHECKED_OUT = "user.checked_out"
