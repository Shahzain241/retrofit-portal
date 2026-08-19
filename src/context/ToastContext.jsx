import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Toast from '../components/ui/Toast';

/**
 * Toast notification system.
 *
 * Provides a `useToast()` hook that returns `showToast` / `dismiss`:
 *
 *   const { showToast } = useToast();
 *   showToast({ type: 'success', message: 'Service saved' });
 *   showToast({ type: 'error', message: 'Something went wrong' });
 *
 * Toasts stack bottom-right, auto-dismiss after 4s, and can be closed via the
 * (×) button. The provider is mounted once at the app root.
 */

const AUTO_DISMISS_MS = 4000;

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (toast = {}) => {
      const id = ++idCounter.current;
      const entry = { id, type: 'info', message: '', ...toast };

      setToasts((prev) => [...prev, entry]);

      const timer = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((timer) => clearTimeout(timer));
      map.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast, dismiss }), [showToast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="rp-toast-viewport">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            message={toast.message}
            onDismiss={dismiss}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
