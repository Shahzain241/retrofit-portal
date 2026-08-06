import { Link } from 'react-router-dom';
import { UserPlus, LogIn, Pencil, Ban } from 'lucide-react';
import Button from '../../components/Button';
import { users } from '../../data/misc';

export default function Users() {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">User Directory</h1>
          <p className="text-body mt-1">Manage platform access, roles, and impersonate accounts.</p>
        </div>
        <Link to="/admin/users/invite">
          <Button variant="navy" icon={UserPlus}>Invite New Staff</Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="text-xs font-semibold text-muted uppercase border-b border-line">
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4"># Projects</th>
              <th className="px-6 py-4">Last Login</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4">
                  <p className="text-ink text-sm font-semibold">{u.name}</p>
                  <p className="text-xs text-muted">{u.email}</p>
                </td>
                <td className="px-6 py-4 text-body">{u.role}</td>
                <td className="px-6 py-4 text-body">{u.projects}</td>
                <td className="px-6 py-4 text-body">{u.lastLogin}</td>
                <td className="px-6 py-4">
                  <span className={`font-semibold text-sm ${u.status === 'Active' ? 'text-brand-green' : 'text-muted'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3 text-muted">
                    <LogIn size={16} className="cursor-pointer hover:text-ink" />
                    <Pencil size={16} className="cursor-pointer hover:text-ink" />
                    <Ban size={16} className="cursor-pointer hover:text-ink" />
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
