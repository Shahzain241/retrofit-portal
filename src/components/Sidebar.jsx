import { NavLink } from 'react-router-dom';
import logo from '../assets/clientlogo.png';
import '../styles/DashboardShared.css';
import { LogOut, Plus, X } from 'lucide-react';
import { clientLinks, adminLinks } from '../data/sidebarLinks';

/**
 * Shared Sidebar — the dashboard navigation rail (client/admin variants).
 * Rendered by DashboardLayout; links come from data/sidebarLinks.js.
 */
export default function Sidebar({ variant = 'client', open = false, onClose }) {
  const links = variant === 'admin' ? adminLinks : clientLinks;

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`rp-sidebar fixed left-0 top-0 z-40 h-screen w-[250px] text-white flex flex-col transition-transform duration-300 rounded-tr-[30px] rounded-br-[30px] ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="relative pt-[45.96px] pb-6">
          <div className="rp-sidebar-brand flex items-center text-lg font-semibold tracking-wide">
            <img src={logo} alt="Retrofit Portal" className="rp-sidebar-logo" />
          </div>
          <button
            onClick={onClose}
            className="absolute -right-3 top-9 w-6 h-6 rounded-full bg-white text-navy-900 flex items-center justify-center shadow lg:hidden sidebar-collapse-btn"
          >
            <X size={14} />
          </button>
          <div className="rp-sidebar-divider" />
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={label}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white rounded-tr-[15px] rounded-br-[15px] rp-sidebar-link-active'
                    : 'text-white/85 hover:bg-white/10'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-6 space-y-3">
          {variant === 'client' && (
            <button className="rp-sidebar-newproject">
              <Plus size={16} /> New Project
            </button>
          )}
          <NavLink
            to="/login"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2 text-sm text-white/85 hover:text-white"
          >
            <LogOut size={18} /> Logout
          </NavLink>
        </div>
      </aside>
    </>
  );
}
