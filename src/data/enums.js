/**
 * Canonical enum values + display labels shared across the mock data.
 *
 * Data files store the lowercase key (e.g. `status: 'active'`); components
 * render the label via these maps so the on-screen text stays unchanged while
 * the underlying values stay consistent and API-swappable.
 */

export const USER_STATUS = {
  active: 'Active',
  offline: 'Offline',
};

export const SERVICE_STATUS = {
  active: 'Active',
  inactive: 'Inactive',
};

export const PROJECT_STATUS = {
  active: 'In Progress',
  completed: 'Completed',
};

export const INVOICE_STATUS = {
  paid: 'Paid',
};

export const PRIORITY = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export const USER_ROLE = {
  'super-admin': 'Super Admin',
  coordinator: 'Coordinator',
  designer: 'Designer',
  assessor: 'Assessor',
};

/** Resolve a canonical key to its display label, falling back to the key. */
export function label(map, key) {
  return map[key] ?? key;
}
