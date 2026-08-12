import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import Button from '../../components/Button';
import StatusPill from '../../components/StatusPill';
import { services } from '../../data/misc';
import '../../styles/Services.css';

/**
 * Admin Services Management — read-only list of the service catalogue.
 * Styled via Services.css + shared dashboard classes.
 */
export default function Services() {
  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Services Management</h1>
          <p className="text-body mt-1">Add / Edit services, tiers, add-ons (demo)</p>
        </div>
        <Link to="/admin/services/new" className="shrink-0">
          <Button
            variant="gradientEdge"
            icon={Plus}
            className="rp-dash-cta rp-create-service-btn"
          >
            Create Service
          </Button>
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm overflow-x-auto">
        <table className="w-full text-left min-w-[800px]">
          <thead>
            <tr className="border-b border-line">
              <th className="px-6 py-4 rp-table-th">Service Title</th>
              <th className="px-6 py-4 rp-table-th">Price</th>
              <th className="px-6 py-4 rp-table-th">Working Days</th>
              <th className="px-6 py-4 rp-table-th">Last Updated</th>
              <th className="px-6 py-4 rp-table-th">Deliverables</th>
              <th className="px-6 py-4 rp-table-th">Service Status</th>
            </tr>
          </thead>
          <tbody>
            {services.map((s, i) => (
              <tr key={i} className="border-b border-line/60 last:border-0">
                <td className="px-6 py-4">
                  <span className="rp-table-td">
                    {s.title}
                  </span>
                </td>
                <td className="px-6 py-4 text-body">{s.price}</td>
                <td className="px-6 py-4 text-body">{s.days}</td>
                <td className="px-6 py-4 text-body">{s.updated}</td>
                <td className="px-6 py-4 text-body">{s.deliverables}</td>
                <td className="px-6 py-4">
                  <StatusPill>{s.status}</StatusPill>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
