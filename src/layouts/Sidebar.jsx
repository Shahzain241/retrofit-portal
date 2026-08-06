import { NavLink } from 'react-router-dom';
import logo from '../assets/clientlogo.png';
import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  CreditCard,
  Wrench,
  Users,
  Settings,
  LogOut,
  Plus,
  ChevronLeft,
} from 'lucide-react';

const clientLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'My Projects', icon: ClipboardList },
  { to: '/profile', label: 'Profile & Property', icon: Building2 },
  { to: '/billing', label: 'Billing', icon: CreditCard },
];

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/projects', label: 'My Projects', icon: ClipboardList },
  { to: '/admin/projects/RET-2026-9156/board', label: 'Task Board', icon: ClipboardList },
  { to: '/admin/services', label: 'Services', icon: Wrench },
  { to: '/admin/users', label: 'User', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ variant = 'client' }) {
  const links = variant === 'admin' ? adminLinks : clientLinks;

  return (
    <aside className="fixed left-0 top-0 h-screen w-[260px] bg-navy-900 text-white flex flex-col">
      <div className="relative px-6 pt-8 pb-6">
        <div className="flex items-center gap-1 text-lg font-semibold tracking-wide">
          <img src={logo} alt="Retrofit Portal" className="w-6 shrink-0" />
        </div>
        <button className="absolute -right-3 top-9 w-6 h-6 rounded-full bg-white text-navy-900 flex items-center justify-center shadow">
          <ChevronLeft size={14} />
        </button>
        <div className="mt-3 h-px bg-white/10" />
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-white text-navy-900'
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
          <button className="w-full flex items-center justify-center gap-2 rounded-full bg-white text-navy-900 font-semibold py-3 text-sm">
            <Plus size={16} /> New Project
          </button>
        )}
        <NavLink
          to="/login"
          className="flex items-center gap-3 px-4 py-2 text-sm text-white/85 hover:text-white"
        >
          <LogOut size={18} /> Logout
        </NavLink>
      </div>
    </aside>
  );
}
