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
