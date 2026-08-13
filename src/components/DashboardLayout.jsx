import { Outlet } from 'react-router-dom';
import { useState, useLayoutEffect } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import '../styles/DashboardShared.css';

/**
 * Shared DashboardLayout — the shell for every dashboard route (client and
 * admin). Composes Sidebar + Topbar around the routed <Outlet/>.
 */
export default function DashboardLayout({ variant = 'client' }) {
  // Desktop layout width the dashboard is designed for:
  // 250px sidebar + 40px padding each side + 1120px content/banner column.
  const DESKTOP_DASHBOARD_WIDTH = 1450;
  // Below this width we treat the device as mobile/tablet and keep the real
  // device-width viewport, so CSS media queries and Tailwind responsive
  // utilities kick in (drawer sidebar, stacked cards, scrollable tables).
  // 1280px covers phones, tablets and iPad landscape; genuine laptops
  // (>= 1280px) still get the desktop-width viewport below.
  const MOBILE_BREAKPOINT = 1280;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // On genuine mobile/tablet widths (below 1280px) and real desktops (at or
  // above the 1450px design width) do nothing: index.html already ships
  // `width=device-width`, so media queries work normally and large desktops
  // lay out at their true resolution. Only laptop widths (1280-1449px) get a
  // desktop-width layout viewport so the exact laptop view (sidebar pinned,
  // full top bar, 4-column stats, tables intact) is preserved, scaled to fit.
  // The viewport is restored on unmount.
  useLayoutEffect(() => {
    if (
      window.innerWidth < MOBILE_BREAKPOINT ||
      window.innerWidth >= DESKTOP_DASHBOARD_WIDTH
    ) {
      return undefined;
    }
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return undefined;
    const previous = meta.getAttribute('content');
    meta.setAttribute('content', `width=${DESKTOP_DASHBOARD_WIDTH}`);
    return () => meta.setAttribute('content', previous ?? 'width=device-width, initial-scale=1.0');
  }, []);

  return (
    <div className="min-h-screen bg-surface">
      <Sidebar variant={variant} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[250px] px-4 sm:px-6 lg:px-10 py-5 lg:py-8 rp-dash-content">
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
      </div>
    </div>
  );
}