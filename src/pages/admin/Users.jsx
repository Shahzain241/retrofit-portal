import { Link } from 'react-router-dom';
import { useCallback, useEffect, useState } from 'react';
import { UserPlus, LogIn, Pencil, Ban } from 'lucide-react';
import Button from '../../components/Button';
import Modal from '../../components/ui/Modal';
import { supabase } from '../../lib/supabaseClient';
import { label, USER_ROLE, USER_STATUS } from '../../data/enums';
import { useToast } from '../../context/ToastContext';
import '../../styles/Users.css';

// Roles an admin may assign via the Edit modal (all roles exist in profiles).
const ROLE_OPTIONS = [
  { value: 'client', label: 'Client' },
  { value: 'super-admin', label: 'Super Admin' },
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'designer', label: 'Designer' },
  { value: 'assessor', label: 'Assessor' },
];

/** Format a last-login timestamp as a short date-time, or '—' when absent. */
function formatLastLogin(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Admin User Directory — list of platform users with roles, status and
 * management actions. Edit + Ban are real `profiles` UPDATEs; impersonation is
 * honestly disabled ("Coming soon") — there is no session-switching service
 * (needs Supabase admin API / Edge Functions) so it must not pretend to work.
 */
export default function Users() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [editingUser, setEditingUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('client');
  const [editSaving, setEditSaving] = useState(false);

  const [banUser, setBanUser] = useState(null);
  const [banSaving, setBanSaving] = useState(false);

  const [projectCounts, setProjectCounts] = useState({});

  const fetchProfiles = useCallback(async () => {
    const [profileRes, projectRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('projects').select('client_id'),
    ]);
    const { data, error: fetchError } = profileRes;
    if (fetchError) {
      setError(fetchError.message);
    } else {
      setProfiles(data);
      // Real per-user project counts derived from projects.client_id.
      const counts = {};
      (projectRes.data ?? []).forEach((p) => {
        if (p.client_id) counts[p.client_id] = (counts[p.client_id] || 0) + 1;
      });
      setProjectCounts(counts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  function openEdit(user) {
    setEditingUser(user);
    setEditName(user.full_name || '');
    setEditRole(user.role || 'client');
  }

  async function handleSaveEdit() {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ full_name: editName.trim(), role: editRole })
        .eq('id', editingUser.id);
      if (updateError) {
        showToast({ type: 'error', message: updateError.message || 'Could not update the user.' });
        return;
      }
      showToast({ type: 'success', message: 'User updated' });
      setEditingUser(null);
      fetchProfiles();
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not update the user.' });
    } finally {
      setEditSaving(false);
    }
  }

  // Ban persists the is_banned flag on the profiles row (the status column has
  // a CHECK constraint limited to active/offline). Enforcement (blocking
  // login/access) is a separate future step.
  async function handleBan() {
    if (!banUser) return;
    setBanSaving(true);
    const next = !banUser.is_banned;
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_banned: next })
        .eq('id', banUser.id);
      if (updateError) {
        showToast({ type: 'error', message: updateError.message || 'Could not update the user status.' });
        return;
      }
      showToast({
        type: 'success',
        message: next ? 'User banned' : 'User unbanned',
      });
      setBanUser(null);
      fetchProfiles();
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not update the user status.' });
    } finally {
      setBanSaving(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">
            User Directory
          </h1>
          <p className="text-body mt-1">Manage platform access, roles, and impersonate accounts.</p>
        </div>
        <Link to="/admin/users/invite" className="shrink-0">
          <Button
            variant="gradientEdge"
            icon={UserPlus}
            className="rp-dash-cta rp-invite-btn"
          >
            Invite New Staff
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-dashed border-gray-200">
              <th className="px-6 py-4 rp-table-th">Name</th>
              <th className="px-6 py-4 rp-table-th">Role</th>
              <th className="px-6 py-4 rp-table-th"># Projects</th>
              <th className="px-6 py-4 rp-table-th">Last Login</th>
              <th className="px-6 py-4 rp-table-th">Status</th>
              <th className="px-6 py-4 rp-table-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-6 py-4 rp-table-td" colSpan={6}>Loading users...</td>
              </tr>
            ) : error ? (
              <tr>
                <td className="px-6 py-4 rp-table-td" colSpan={6}>Could not load users.</td>
              </tr>
            ) : (
              profiles.map((u) => (
              <tr key={u.id} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4">
                  <p className="rp-table-td font-semibold">{u.full_name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="rp-table-td">{label(USER_ROLE, u.role)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rp-table-td">{projectCounts[u.id] ?? 0}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rp-table-td">{formatLastLogin(u.last_login_at)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`rp-table-td ${
                    u.is_banned
                      ? 'text-danger'
                      : u.status === 'active'
                        ? 'rp-table-td-success'
                        : 'text-muted'
                  }`}>
                    {u.is_banned ? 'Banned' : label(USER_STATUS, u.status)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-muted">
                    <button
                      type="button"
                      aria-label="Log in as user"
                      disabled
                      title="Coming soon"
                      className="cursor-not-allowed opacity-40"
                    >
                      <LogIn size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label="Edit user"
                      className="cursor-pointer hover:text-ink"
                      onClick={() => openEdit(u)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={u.is_banned ? 'Unban user' : 'Ban user'}
                      className="cursor-pointer hover:text-danger"
                      onClick={() => setBanUser(u)}
                    >
                      <Ban size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={!!editingUser}
        onClose={() => !editSaving && setEditingUser(null)}
        title="Edit User"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-user-name" className="block text-xs font-semibold text-ink mb-2">Full Name</label>
            <input
              id="edit-user-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <div>
            <label htmlFor="edit-user-role" className="block text-xs font-semibold text-ink mb-2">Role</label>
            <select
              id="edit-user-role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="outline" className="flex-1" disabled={editSaving} onClick={() => setEditingUser(null)}>
              Cancel
            </Button>
            <Button variant="navy" className="flex-1" disabled={editSaving} onClick={handleSaveEdit}>
              {editSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!banUser}
        onClose={() => !banSaving && setBanUser(null)}
        title={banUser?.is_banned ? 'Unban User' : 'Ban User'}
      >
        <p className="mb-6">
          {banUser?.is_banned
            ? `Unban ${banUser?.full_name || 'this user'}? The ban flag will be cleared.`
            : `Ban ${banUser?.full_name || 'this user'}? Their profile will be flagged as banned. Note: enforcing the ban (blocking login/access) is a separate future step.`}
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" className="flex-1" disabled={banSaving} onClick={() => setBanUser(null)}>
            Cancel
          </Button>
          <Button variant="navy" className="flex-1" disabled={banSaving} onClick={handleBan}>
            {banSaving ? 'Saving...' : banUser?.is_banned ? 'Unban' : 'Ban'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}