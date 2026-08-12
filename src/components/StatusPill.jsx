/**
 * Shared StatusPill — colored status/priority text (Active, Completed,
 * Offline, High, ...). Maps a status string to a Tailwind text color.
 * Used across dashboards (admin Services table, My Projects table).
 */
const styles = {
  Active: 'text-brand-green',
  Completed: 'text-brand-green',
  Offline: 'text-muted',
  Inactive: 'text-muted',
  Assessment: 'text-warning',
  Coordination: 'text-body',
  High: 'text-danger',
  Medium: 'text-warning',
  'QA Reject': 'text-danger',
};

export default function StatusPill({ children }) {
  return (
    <span className={`text-sm font-semibold ${styles[children] || 'text-body'}`}>
      {children}
    </span>
  );
}
