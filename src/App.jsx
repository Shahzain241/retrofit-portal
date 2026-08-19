import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import DashboardLayout from './components/DashboardLayout';
import ErrorBoundary from './components/ErrorBoundary';

// Page components are lazy-loaded per route to keep the initial bundle small.
// Small shared components (DashboardLayout, ErrorBoundary, Toast) stay eager.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const Services = lazy(() => import('./pages/Services'));
const ServiceDetail = lazy(() => import('./pages/ServiceDetail'));
const ClientDashboard = lazy(() => import('./pages/client/ClientDashboard'));
const MyProjects = lazy(() => import('./pages/client/MyProjects'));
const ProjectDetail = lazy(() => import('./pages/client/ProjectDetail'));
const Profile = lazy(() => import('./pages/client/Profile'));
const Billing = lazy(() => import('./pages/client/Billing'));
const Plans = lazy(() => import('./pages/client/Plans'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const ProjectsDirectory = lazy(() => import('./pages/admin/ProjectsDirectory'));
const TaskBoard = lazy(() => import('./pages/admin/TaskBoard'));
const AdminServices = lazy(() => import('./pages/admin/Services'));
const ServiceForm = lazy(() => import('./pages/admin/ServiceForm'));
const Users = lazy(() => import('./pages/admin/Users'));
const InviteStaff = lazy(() => import('./pages/admin/InviteStaff'));
const Settings = lazy(() => import('./pages/admin/Settings'));

// Placeholder pages will be swapped in as we build them
function Placeholder({ label }) {
  return <div className="text-2xl font-bold text-ink">{label} — coming next</div>;
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </ToastProvider>
  );
}

function AppRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={<div className="route-loading">Loading...</div>}>
      <div key={location.pathname} className="route-fade">
        <Routes location={location}>
            <Route path="/" element={<ErrorBoundary><Landing /></ErrorBoundary>} />
            <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
            <Route path="/signup" element={<ErrorBoundary><Signup /></ErrorBoundary>} />
            <Route path="/services" element={<ErrorBoundary><Services /></ErrorBoundary>} />
            <Route path="/services/:id" element={<ErrorBoundary><ServiceDetail /></ErrorBoundary>} />
            <Route path="/how-it-works" element={<Placeholder label="How It Works" />} />
            <Route path="/get-started" element={<Placeholder label="Get Started" />} />
            <Route path="/feedbacks" element={<Placeholder label="Feedbacks" />} />
            <Route path="/privacy" element={<Placeholder label="Privacy Policy" />} />
            <Route path="/terms" element={<Placeholder label="Terms &amp; Conditions" />} />
            <Route path="/changelog" element={<Placeholder label="Changelog" />} />

            <Route element={<ErrorBoundary><DashboardLayout variant="client" /></ErrorBoundary>}>
              <Route path="/dashboard" element={<ClientDashboard />} />
              <Route path="/projects" element={<MyProjects />} />
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/billing/plans" element={<Plans />} />
            </Route>

            <Route element={<ErrorBoundary><DashboardLayout variant="admin" /></ErrorBoundary>}>
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/projects" element={<ProjectsDirectory />} />
              <Route path="/admin/projects/:id/board" element={<TaskBoard />} />
              <Route path="/admin/services" element={<AdminServices />} />
              <Route path="/admin/services/new" element={<ServiceForm />} />
              <Route path="/admin/users" element={<Users />} />
              <Route path="/admin/users/invite" element={<InviteStaff />} />
              <Route path="/admin/settings" element={<Settings />} />
            </Route>
        </Routes>
      </div>
    </Suspense>
  );
}
