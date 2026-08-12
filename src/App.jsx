import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import Landing from './pages/Landing';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import DashboardLayout from './components/DashboardLayout';
import ClientDashboard from './pages/client/ClientDashboard';
import MyProjects from './pages/client/MyProjects';
import ProjectDetail from './pages/client/ProjectDetail';
import Profile from './pages/client/Profile';
import Billing from './pages/client/Billing';
import Plans from './pages/client/Plans';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProjectsDirectory from './pages/admin/ProjectsDirectory';
import TaskBoard from './pages/admin/TaskBoard';
import AdminServices from './pages/admin/Services';
import ServiceForm from './pages/admin/ServiceForm';
import Users from './pages/admin/Users';
import InviteStaff from './pages/admin/InviteStaff';
import Settings from './pages/admin/Settings';

// Placeholder pages will be swapped in as we build them
function Placeholder({ label }) {
  return <div className="text-2xl font-bold text-ink">{label} — coming next</div>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/how-it-works" element={<Placeholder label="How It Works" />} />
        <Route path="/get-started" element={<Placeholder label="Get Started" />} />
        <Route path="/feedbacks" element={<Placeholder label="Feedbacks" />} />
        <Route path="/privacy" element={<Placeholder label="Privacy Policy" />} />
        <Route path="/terms" element={<Placeholder label="Terms &amp; Conditions" />} />
        <Route path="/changelog" element={<Placeholder label="Changelog" />} />

        <Route element={<DashboardLayout variant="client" />}>
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/projects" element={<MyProjects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/billing/plans" element={<Plans />} />
        </Route>

        <Route element={<DashboardLayout variant="admin" />}>
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
    </BrowserRouter>
  );
}
