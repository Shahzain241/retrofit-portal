import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Button from '../../components/Button';
import { services } from '../../data/misc';

export default function Services() {
  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">Services Management</h1>
          <p className="text-body mt-1">Add / Edit services, tiers, add-ons (demo)</p>
        </div>
        <Link to="/admin/services/new">
          <Button variant="navy" icon={Plus}>Create Service</Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="text-xs font-semibold text-muted uppercase border-b border-line">
              <th className="px-6 py-4">Service Title</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Working Days</th>
              <th className="px-6 py-4">Last Updated</th>
              <th className="px-6 py-4">Deliverables</th>
              <th className="px-6 py-4">Service Status</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4 text-ink font-medium">{s.title}</td>
                <td className="px-6 py-4 text-body">{s.price}</td>
                <td className="px-6 py-4 text-body">{s.days}</td>
                <td className="px-6 py-4 text-body">{s.updated}</td>
                <td className="px-6 py-4 text-body">{s.deliverables}</td>
                <td className="px-6 py-4">
                  <span className={`font-semibold text-sm ${s.status === 'Active' ? 'text-brand-green' : 'text-muted'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
