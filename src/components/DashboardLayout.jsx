import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import '../styles/DashboardShared.css';

/**
 * Shared DashboardLayout — the shell for every dashboard route (client and
 * admin). Composes Sidebar + Topbar around the routed <Outlet/>.
 */
export default function DashboardLayout({ variant = 'client' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar
        variant={variant}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed((v) => !v)}
      />
      <main className={`px-4 sm:px-6 lg:px-10 py-5 lg:py-8 rp-dash-content transition-[margin] duration-200 ${isCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[250px]'}`}>
        <div className="flex items-center justify-between lg:hidden mb-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-full bg-white border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          >
            <Menu size={18} />
            Menu
          </button>
        </div>
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
}