import { Link } from 'react-router-dom';
import { UserPlus, LogIn, Pencil, Ban } from 'lucide-react';
import Button from '../../components/Button';
import { users } from '../../data/misc';
import { label, USER_ROLE, USER_STATUS } from '../../data/enums';
import { useToast } from '../../context/ToastContext';
import '../../styles/Users.css';

/**
 * Admin User Directory — list of platform users with roles, status and
 * management actions. Styled via Users.css + shared dashboard classes.
 */
export default function Users() {
  const { showToast } = useToast();
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
            <tr className="border-b border-line">
              <th className="px-6 py-4 rp-table-th">Name</th>
              <th className="px-6 py-4 rp-table-th">Role</th>
              <th className="px-6 py-4 rp-table-th"># Projects</th>
              <th className="px-6 py-4 rp-table-th">Last Login</th>
              <th className="px-6 py-4 rp-table-th">Status</th>
              <th className="px-6 py-4 rp-table-th">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4">
                  <p className="rp-table-td font-semibold">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-6 py-4">
                  <span className="rp-table-td">{label(USER_ROLE, u.role)}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rp-table-td">{u.projects}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="rp-table-td">{u.lastLogin}</span>
                </td>
                <td className="px-6 py-4">
                  <span className={`rp-table-td ${u.status === 'active' ? 'rp-table-td-success' : ''}`}>
                    {label(USER_STATUS, u.status)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-muted">
                    <button type="button" aria-label="Log in as user" className="cursor-pointer hover:text-ink" onClick={() => showToast({ type: 'info', message: 'Impersonating user' })}>
                      <LogIn size={16} />
                    </button>
                    <button type="button" aria-label="Edit user" className="cursor-pointer hover:text-ink" onClick={() => showToast({ type: 'info', message: 'Editing user' })}>
                      <Pencil size={16} />
                    </button>
                    <button type="button" aria-label="Ban user" className="cursor-pointer hover:text-ink" onClick={() => showToast({ type: 'warning', message: 'User banned' })}>
                      <Ban size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
