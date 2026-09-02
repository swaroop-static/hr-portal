import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManagerDashboard from './pages/manager/ManagerDashboard';
import HRDashboard from './pages/hr/HRDashboard';
import Positions from './pages/hr/Positions';
import Applications from './pages/hr/Applications';
import ApplicationDetail from './pages/hr/ApplicationDetail';
import Tests from './pages/hr/Tests';
import ProctoringView from './pages/hr/ProctoringView';
import TestResponseViewer from './pages/hr/TestResponseViewer';
import InterviewerDashboard from './pages/interviewer/InterviewerDashboard';
import InterviewerTests from './pages/interviewer/InterviewerTests';
import InterviewerAttemptGrade from './pages/interviewer/InterviewerAttemptGrade';
import CandidateDashboard from './pages/candidate/CandidateDashboard';
import TestPage from './pages/candidate/TestPage';
import InterviewRoom from './pages/InterviewRoom';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import QuestionBank from './pages/QuestionBank';
import InterviewLobby from './pages/InterviewLobby';
import TemplatesPage from './pages/TemplatesPage';
import AuditLogPage from './pages/AuditLogPage';
import CodeReplayPage from './pages/CodeReplayPage';
import InterviewTimelinePage from './pages/InterviewTimelinePage';
import NotificationsPage from './pages/NotificationsPage';
import CommandCenter from './pages/hr/CommandCenter';
import Layout from './components/Layout';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'var(--font-body)', color: 'var(--text-secondary)', background: 'var(--obsidian)' }}>Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--obsidian)' }} />;
  if (!user) return <Navigate to="/login" replace />;
  const routes: Record<string, string> = {
    ADMIN: '/admin', MANAGER: '/manager', HR: '/hr', INTERVIEWER: '/interviewer', CANDIDATE: '/candidate'
  };
  return <Navigate to={routes[user.role] || '/login'} replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <ToastProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/login" element={<Login />} />

          {/* Candidate test — uses auth */}
          <Route path="/test/:token" element={
            <ProtectedRoute roles={['CANDIDATE', 'HR', 'ADMIN']}>
              <TestPage />
            </ProtectedRoute>
          } />

          {/* Admin */}
          <Route path="/admin" element={
            <ProtectedRoute roles={['ADMIN']}><Layout><AdminDashboard /></Layout></ProtectedRoute>
          } />

          {/* Manager */}
          <Route path="/manager" element={
            <ProtectedRoute roles={['MANAGER']}><Layout><ManagerDashboard /></Layout></ProtectedRoute>
          } />

          {/* HR */}
          <Route path="/hr" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><HRDashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/positions" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><Positions /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/applications" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><Applications /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/applications/:id" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><ApplicationDetail /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/tests" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><Tests /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/analytics" element={
            <ProtectedRoute roles={['HR', 'ADMIN', 'MANAGER']}><Layout><AnalyticsDashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/questions" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><QuestionBank /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/templates" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><TemplatesPage /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/command-center" element={
            <ProtectedRoute roles={['HR', 'ADMIN']}><Layout><CommandCenter /></Layout></ProtectedRoute>
          } />
          <Route path="/admin/audit" element={
            <ProtectedRoute roles={['ADMIN']}><Layout><AuditLogPage /></Layout></ProtectedRoute>
          } />
          <Route path="/hr/proctor/:attemptId" element={
            <ProtectedRoute roles={['HR', 'ADMIN', 'INTERVIEWER']}><Layout><ProctoringView /></Layout></ProtectedRoute>
          } />
          <Route path="/tests/attempt/:attemptId/view" element={
            <ProtectedRoute roles={['HR', 'ADMIN', 'INTERVIEWER']}><Layout><TestResponseViewer /></Layout></ProtectedRoute>
          } />

          {/* Interviewer */}
          <Route path="/interviewer" element={
            <ProtectedRoute roles={['INTERVIEWER']}><Layout><InterviewerDashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/interviewer/tests" element={
            <ProtectedRoute roles={['INTERVIEWER']}><Layout><InterviewerTests /></Layout></ProtectedRoute>
          } />
          <Route path="/interviewer/attempt/:attemptId" element={
            <ProtectedRoute roles={['INTERVIEWER']}><Layout><InterviewerAttemptGrade /></Layout></ProtectedRoute>
          } />
          <Route path="/interviewer/questions" element={
            <ProtectedRoute roles={['INTERVIEWER']}><Layout><QuestionBank /></Layout></ProtectedRoute>
          } />
          <Route path="/interviewer/templates" element={
            <ProtectedRoute roles={['INTERVIEWER']}><Layout><TemplatesPage /></Layout></ProtectedRoute>
          } />

          {/* Interview lobby — pre-interview tech check */}
          <Route path="/interview/:roundId/lobby" element={
            <ProtectedRoute roles={['INTERVIEWER', 'CANDIDATE', 'HR', 'ADMIN']}>
              <InterviewLobby />
            </ProtectedRoute>
          } />

          {/* Interview timeline — must be before /interview/:roundId */}
          <Route path="/interview/:roundId/timeline" element={
            <ProtectedRoute roles={['INTERVIEWER', 'HR', 'ADMIN']}>
              <InterviewTimelinePage />
            </ProtectedRoute>
          } />

          {/* Code replay — must be before /interview/:roundId to avoid param collision */}
          <Route path="/interview/:roundId/replay" element={
            <ProtectedRoute roles={['INTERVIEWER', 'HR', 'ADMIN']}>
              <CodeReplayPage />
            </ProtectedRoute>
          } />

          {/* Interview room — shared by interviewer and candidate */}
          <Route path="/interview/:roundId" element={
            <ProtectedRoute roles={['INTERVIEWER', 'CANDIDATE', 'HR', 'ADMIN']}>
              <InterviewRoom />
            </ProtectedRoute>
          } />

          {/* Notifications — all authenticated roles */}
          <Route path="/notifications" element={
            <ProtectedRoute><Layout><NotificationsPage /></Layout></ProtectedRoute>
          } />

          {/* Candidate portal */}
          <Route path="/candidate" element={
            <ProtectedRoute roles={['CANDIDATE']}><CandidateDashboard /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </ToastProvider>
  );
}
