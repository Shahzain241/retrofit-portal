import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';
import Toggle from '../../components/Toggle';
import '../../styles/InviteStaff.css';

/**
 * Admin Invite Staff — email/role picker and read-only permission toggles.
 * Styled via InviteStaff.css + shared dashboard classes.
 */
export default function InviteStaff() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="is-heading mb-6">
        Invite New Staff
      </h1>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="is-label block mb-2">
              Email Address
            </label>
            <input
              placeholder="e.g. johnsmith@gmail.com"
              className="w-full rounded-xl border border-line px-4 py-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Role</label>
            <select className="w-full rounded-xl border border-line px-4 py-3 text-sm">
              <option>John Smith</option>
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
            <Toggle on size="lg" />
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="is-perm-label">
              Assign to specific projects
            </span>
            <Toggle on={false} size="lg" />
          </div>
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
        >
          Send Invite
        </Button>
      </div>
    </div>
  );
}
