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
  { id: 'nav-client-dashboard', to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'nav-client-projects', to: '/projects', label: 'My Projects', icon: ClipboardList },
  { id: 'nav-client-profile', to: '/profile', label: 'Profile & Property', icon: Building2 },
  { id: 'nav-client-billing', to: '/billing', label: 'Billing', icon: CreditCard },
];

export const adminLinks = [
  { id: 'nav-admin-dashboard', to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'nav-admin-projects', to: '/admin/projects', label: 'My Projects', icon: ClipboardList },
  { id: 'nav-admin-services', to: '/admin/services', label: 'Services', icon: Wrench },
  { id: 'nav-admin-users', to: '/admin/users', label: 'User', icon: Users },
  { id: 'nav-admin-settings', to: '/admin/settings', label: 'Settings', icon: Settings },
];
