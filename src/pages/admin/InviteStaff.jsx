import { useNavigate } from 'react-router-dom';
import Button from '../../components/Button';

export default function InviteStaff() {
  const navigate = useNavigate();

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink mb-6">Invite New Staff</h1>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Email Address</label>
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
          <h4 className="font-bold text-ink mb-4">Permission</h4>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-body">View all projects</span>
            <div className="w-11 h-6 rounded-full bg-navy-900 flex items-center justify-end px-0.5">
              <span className="w-5 h-5 rounded-full bg-white block" />
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-body">Assign to specific projects</span>
            <div className="w-11 h-6 rounded-full bg-line flex items-center px-0.5">
              <span className="w-5 h-5 rounded-full bg-white block" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <Button variant="outline" className="flex-1" onClick={() => navigate('/admin/users')}>
          Cancel
        </Button>
        <Button variant="green" className="flex-1">Send Invite</Button>
      </div>
    </div>
  );
}
