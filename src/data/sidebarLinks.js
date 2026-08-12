import {
  LayoutDashboard,
  ClipboardList,
  Building2,
  CreditCard,
  Wrench,
  Users,
  Settings,
} from 'lucide-react';

/**
 * Dashboard sidebar navigation links per role (client / admin).
 * `icon` is a lucide component reference.
 */
export const clientLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'My Projects', icon: ClipboardList },
  { to: '/profile', label: 'Profile & Property', icon: Building2 },
  { to: '/billing', label: 'Billing', icon: CreditCard },
];

export const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/projects', label: 'My Projects', icon: ClipboardList },
  { to: '/admin/projects/RET-2026-9156/board', label: 'Task Board', icon: ClipboardList },
  { to: '/admin/services', label: 'Services', icon: Wrench },
  { to: '/admin/users', label: 'User', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];