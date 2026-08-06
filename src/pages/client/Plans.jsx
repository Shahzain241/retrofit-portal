import { Check, X } from 'lucide-react';
import Button from '../../components/Button';
import { plans } from '../../data/misc';

export default function Plans() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Choose Your Transformation</h1>
      <p className="text-body mt-1 mb-8">Scalable solutions for teams of all sizes.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`relative rounded-2xl p-6 border ${
              p.highlight ? 'bg-navy-900 text-white border-navy-900' : 'bg-white border-line/60 shadow-sm'
            }`}
          >
            {p.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-green text-white text-[10px] font-bold px-4 py-1.5 rounded-full">
                {p.badge}
              </span>
            )}
            <h3 className={`text-lg font-bold ${p.highlight ? 'text-brand-green' : 'text-ink'}`}>{p.name}</h3>
            <p className="text-4xl font-bold mt-2">
              {p.price}
              <span className={`text-sm font-normal ${p.highlight ? 'text-white/60' : 'text-muted'}`}>/mo</span>
            </p>
            <p className={`text-sm mt-2 mb-4 ${p.highlight ? 'text-white/70' : 'text-body'}`}>{p.desc}</p>
            <div className={`space-y-2.5 pt-4 mb-6 border-t border-dashed ${p.highlight ? 'border-white/20' : 'border-line'}`}>
              {p.features.map((f) => (
                <div key={f.text} className="flex items-center gap-2 text-sm">
                  {f.ok ? (
                    <Check size={16} className="text-brand-green shrink-0" />
                  ) : (
                    <X size={16} className="text-muted shrink-0" />
                  )}
                  <span className={f.ok ? (p.highlight ? 'text-white' : 'text-ink') : 'text-muted'}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant={p.highlight ? 'outline' : 'primary'}
              className="w-full"
            >
              {p.cta}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
