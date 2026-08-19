import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../assets/clientlogo.png';
import '../styles/DashboardShared.css';
import { LogOut, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { clientLinks, adminLinks } from '../data/sidebarLinks';
import { useToast } from '../context/ToastContext';

/**
 * Shared Sidebar — the dashboard navigation rail (client/admin variants).
 * Rendered by DashboardLayout; links come from data/sidebarLinks.js.
 * `collapsed` collapses the rail to an icon-only state (76px).
 */
export default function Sidebar({ variant = 'client', open = false, onClose, collapsed = false, onToggleCollapse }) {
  const links = variant === 'admin' ? adminLinks : clientLinks;
  const { showToast } = useToast();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Escape-to-close + body scroll lock while the mobile drawer is open
  // (backdrop click already closes it). Matches the shared Modal behaviour.
  useEffect(() => {
    if (!open) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') onCloseRef.current?.();
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`rp-sidebar fixed left-0 top-0 z-40 h-screen text-white flex flex-col transition-all duration-200 rounded-tr-[30px] rounded-br-[30px] ${
          collapsed ? 'is-collapsed w-[76px]' : 'w-[250px]'
        } ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}
      >
        <div className="relative pt-[45.96px] pb-6">
          <div className={`rp-sidebar-brand flex items-center text-lg font-semibold tracking-wide ${collapsed ? 'justify-center' : ''}`}>
            <img src={logo} alt="Retrofit Portal" className="rp-sidebar-logo" />
          </div>

          <button
            onClick={onClose}
            aria-label="Close menu"
            className="absolute -right-3 top-9 w-6 h-6 rounded-full bg-white text-navy-900 flex items-center justify-center shadow lg:hidden sidebar-collapse-btn"
          >
            <X size={14} />
          </button>

          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex absolute top-[56px] -right-4 w-8 h-8 rounded-full bg-white text-navy-900 items-center justify-center shadow border border-line hover:bg-gray-100 sidebar-toggle-btn"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>

          <div className="rp-sidebar-divider" />
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center py-3 text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center' : 'px-4 gap-3'
                } ${
                  isActive
                    ? 'text-white rounded-tr-[15px] rounded-br-[15px] rp-sidebar-link-active'
                    : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-6 space-y-3">
          {variant === 'client' && !collapsed && (
            <button
              className="rp-sidebar-newproject"
              onClick={() => showToast({ type: 'success', message: 'New project created' })}
            >
              <Plus size={16} /> New Project
            </button>
          )}
          <NavLink
            to="/login"
            onClick={onClose}
            title={collapsed ? 'Logout' : undefined}
            className={`flex items-center py-2 text-sm text-white/85 hover:text-white ${
              collapsed ? 'justify-center' : 'px-4 gap-3'
            }`}
          >
            <LogOut size={18} />
            {!collapsed && <span>Logout</span>}
          </NavLink>
        </div>
      </aside>
    </>
  );
}
