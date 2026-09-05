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
      <main className={`px-4 sm:px-6 lg:pl-[47px] lg:pr-[39px] py-5 lg:py-8 rp-dash-content transition-[margin] duration-200 ${isCollapsed ? 'lg:ml-[76px]' : 'lg:ml-[232px]'}`}>
        <div className="flex items-center justify-between lg:hidden mb-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-2 rounded-full bg-white border border-line px-4 py-2.5 text-sm font-semibold text-ink"
          >
            <Menu size={18} />
            Menu
          </button>
        </div>

        <div className="rp-topbar-bar w-full max-w-[877px] ml-auto xl:mr-10 bg-transparent mb-5 sm:mb-6">
          <Topbar variant={variant} />
        </div>

        <Outlet />
      </main>
    </div>
  );
}