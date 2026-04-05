# Rookies HQ

Rookies HQ is a high-fidelity workflow operating system tailored specifically for creative video editing agencies. It provides an end-to-end framework to manage active projects, assign tasks, track creative reviews, and monitor high-level performance metrics.

## Features
- **The Arena**: An active workspace to quickly claim unassigned tasks, review assigned work, and track real-time efficiency metrics.
- **Pipeline Kanban**: Simple drag-and-drop Kanban board designed for complex creative states (Editing, Internal Review, Revision, Delivered, and Closed).
- **Project & Lead Management**: Detailed structural overviews of current tasks linked directly to distinct creative campaigns and inbound client requests.
- **Role-based Access & Security**: Built with scalable JWT-enabled authentication ensuring secure interactions for admins versus internal creative talent.
- **Robust Tech Stack**: 
  - **Backend**: Python 3.12, FastAPI, SQLAlchemy (PostgreSQL), Alembic, running seamlessly alongside Docker.
  - **Frontend**: React + Vite built explicitly with an elite, highly-tailored vanilla inline-styled dark mode system ensuring pixel-perfect UI execution.

## Getting Started

### Backend Prerequisites
Ensure you have Docker and Python 3.12 installed on your host machine.

1. **Start Database Services**:
   ```bash
   docker-compose up -d
   ```
2. **Setup Virtual Environment**:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
3. **Run Database Migrations**:
   Make sure you have an `.env` file containing `DATABASE_URL` and `JWT_SECRET`.
   ```bash
   alembic upgrade head
   ```
4. **Run Application Server**:
   ```bash
   uvicorn app.main:app --port 8001 --reload
   ```

### Frontend Environment
1. **Install Dependencies**:
   ```bash
   cd frontend
   npm install
   ```
2. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   *Note: Ensure Vite configurations are configured with `allowedHosts: true` to support custom local routing or ngrok remote tunnels.*
