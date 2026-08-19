import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import '../../styles/Toast.css';

/**
 * Shared Toast item — rendered by the ToastProvider inside a fixed
 * bottom-right viewport. Pure presentational: receives the toast record and
 * an `onDismiss` callback from the provider.
 *
 * Variants: success | error | warning | info.
 */
const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Toast({ id, type = 'info', message, onDismiss }) {
  const Icon = icons[type] || Info;

  return (
    <div className={`rp-toast rp-toast-${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span className="rp-toast-icon">
        <Icon size={18} />
      </span>
      <p className="rp-toast-message">{message}</p>
      <button
        type="button"
        className="rp-toast-close"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
      >
        <X size={16} />
      </button>
    </div>
  );
}
