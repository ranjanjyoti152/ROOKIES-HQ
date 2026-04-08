from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.core.exceptions import global_exception_handler
from app.api import auth, users, projects, tasks, comments, time_entries, notifications, leads, automations, leaderboard, websocket, analytics, notes, canvas, workspaces, ai


import asyncio

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    print("🚀 Rookies HQ API starting up...")
    
    try:
        print("🔄 Running database migrations...")
        import alembic.config
        alembic_args = ["--raiseerr", "upgrade", "head"]
        await asyncio.to_thread(alembic.config.main, argv=alembic_args)
        print("✅ Database migrations complete.")
    except Exception as e:
        print(f"⚠️ Migrations failed or already configured: {e}")
        
    yield
    print("🛑 Rookies HQ API shutting down...")


app = FastAPI(
    title="Rookies HQ",
    description="Workflow Operating System for Creative Agencies",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler
app.add_exception_handler(Exception, global_exception_handler)

# Register API routes
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(tasks.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(time_entries.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(leads.router, prefix="/api")
app.include_router(automations.router, prefix="/api")
app.include_router(leaderboard.router, prefix="/api")
app.include_router(websocket.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(canvas.router, prefix="/api")
app.include_router(workspaces.router, prefix="/api")
app.include_router(ai.router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "rookies-hq"}
