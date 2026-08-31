import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import Toggle from '../../components/Toggle';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/InviteStaff.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Display text -> profiles.role enum key. Only coordinator/designer/assessor
// are invitable from this UI; client/super-admin are intentionally excluded.
const ROLE_OPTIONS = {
  Coordinator: 'coordinator',
  Designer: 'designer',
  Assessor: 'assessor',
};

// Secure temporary password: 16 chars, unambiguous alphabet. Never shown or logged.
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let password = '';
  for (let i = 0; i < bytes.length; i += 1) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

/**
 * Admin Invite Staff — creates a real staff account via supabase.auth.signUp
 * with a temporary random password, sends the built-in password-reset email,
 * then assigns the chosen role on the auto-created profile. Styled via
 * InviteStaff.css + shared dashboard classes.
 */
export default function InviteStaff() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Coordinator');
  const [submitting, setSubmitting] = useState(false);

  async function handleSendInvite() {
    if (submitting) return;

    const emailTrim = email.trim();
    if (!EMAIL_RE.test(emailTrim)) {
      showToast({ type: 'error', message: 'Enter a valid email address' });
      return;
    }
    const roleKey = ROLE_OPTIONS[role];
    if (!roleKey) {
      showToast({ type: 'error', message: 'Please select a valid role' });
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase.auth.signUp({
        email: emailTrim,
        password: generateTempPassword(),
      });
      if (error || !data?.user?.id) {
        showToast({ type: 'error', message: error?.message || 'Could not create the account.' });
        return;
      }

      // signUp switches the active session to the new user; restore the
      // super-admin session so the role assignment runs with admin privileges.
      if (session) {
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });
      }

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailTrim);
      const { error: roleError } = await supabase
        .from('profiles')
        .update({ role: roleKey })
        .eq('id', data.user.id);

      if (roleError) {
        showToast({
          type: 'error',
          message: `Account created, but the role could not be assigned: ${roleError.message}`,
        });
        return;
      }
      if (resetError) {
        console.error('[InviteStaff] resetPasswordForEmail failed', {
          message: resetError.message,
          status: resetError.status,
          code: resetError.code,
          raw: resetError,
        });
        showToast({
          type: 'warning',
          message: 'Invitation sent, but the password-set email could not be delivered.',
        });
      } else {
        showToast({ type: 'success', message: `Invitation sent to ${emailTrim}` });
      }
      setEmail('');
      setRole('Coordinator');
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not send the invitation.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="is-heading mb-6">
        Invite New Staff
      </h1>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="invite-email" className="is-label block mb-2">
              Email Address
            </label>
            <input
              id="invite-email"
              placeholder="e.g. johnsmith@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="invite-role" className="block text-sm font-semibold text-ink mb-2">Role</label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm"
            >
              <option>Coordinator</option>
              <option>Designer</option>
              <option>Assessor</option>
            </select>
          </div>
        </div>

        <div className="border border-line rounded-xl p-5">
          <h4 className="is-perm-title mb-4">
            Permission
          </h4>
          <div className="flex items-center justify-between py-2">
            <span className="is-perm-label">
              View all projects
            </span>
            <div className="flex items-center gap-2">
              <Toggle aria-label="View all projects permission" on size="lg" disabled />
              <span className="text-[10px] font-semibold uppercase text-muted">Coming soon</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="is-perm-label">
              Assign to specific projects
            </span>
            <div className="flex items-center gap-2">
              <Toggle aria-label="Assign to specific projects permission" on={false} size="lg" disabled />
              <span className="text-[10px] font-semibold uppercase text-muted">Coming soon</span>
            </div>
          </div>
          <p className="text-[11px] text-muted mt-2">
            Permissions are not saved yet — there is no permissions table in this environment.
          </p>
        </div>
      </div>

      <div className="rp-dash-actions-bar flex mx-auto mt-6">
        <Button
          variant="outline"
          className="flex-1 rp-dash-action rp-dash-action-cancel"
          onClick={() => navigate('/admin/users')}
        >
          Cancel
        </Button>
        <Button
          variant="green"
          className="flex-1 rp-dash-action rp-dash-action-save"
          disabled={submitting}
          onClick={handleSendInvite}
        >
          Send Invite
        </Button>
      </div>
    </div>
  );
}