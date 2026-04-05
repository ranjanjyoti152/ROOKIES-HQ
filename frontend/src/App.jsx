import { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import useAuthStore from './store/authStore';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import Projects from './pages/Projects';
import Arena from './pages/Arena';
import Leads from './pages/Leads';
import Team from './pages/Team';
import Leaderboard from './pages/Leaderboard';
import Notifications from './pages/Notifications';
import MyWork from './pages/MyWork';
import TimeReport from './pages/TimeReport';
import Automations from './pages/Automations';
import WorkDashboard from './pages/WorkDashboard';
import Canvas from './pages/Canvas';
import Notes from './pages/Notes';
import Workspaces from './pages/Workspaces';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30000, retry: 1 } },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="w-8 h-8 border-2 border-[var(--accent-primary)]/30 border-t-[var(--accent-primary)] rounded-full animate-spin" />
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  // While loading, show the page content anyway (avoids blank flash/reload feel).
  // If already authenticated, redirect to dashboard once loading is done.
  if (!isLoading && isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  // Use a ref so initialize() is only called once on mount,
  // regardless of store re-renders.
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      useAuthStore.getState().initialize();
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />

          {/* Protected - Main layout */}
          <Route element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/pipeline" element={<Pipeline />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/automations" element={<Automations />} />
            <Route path="/team" element={<Team />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/my-work" element={<MyWork />} />
            <Route path="/time-report" element={<TimeReport />} />
            <Route path="/work-dashboard" element={<WorkDashboard />} />
            <Route path="/canvas" element={<Canvas />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/workspaces" element={<Workspaces />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
