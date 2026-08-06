import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout({ variant = 'client' }) {
  return (
    <div className="min-h-screen bg-surface">
      <Sidebar variant={variant} />
      <div className="ml-[260px] px-10 py-8">
        <Topbar />
        <Outlet />
      </div>
    </div>
  );
}
