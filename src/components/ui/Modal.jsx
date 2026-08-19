import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import '../../styles/Modal.css';

const ANIMATION_MS = 200;

/**
 * Shared Modal — the single reusable dialog/overlay across the app.
 *
 * Behaviour (standardised for every modal):
 *   - dark blurred backdrop, closes on backdrop click
 *   - closes on Escape
 *   - closes on the (×) button
 *   - locks body scroll while open
 *   - traps focus inside the panel while open
 *   - fade + slight scale enter/exit animation (~200ms)
 */
export default function Modal({ isOpen, onClose, title, children }) {
  const [mounted, setMounted] = useState(isOpen);
  const [visible, setVisible] = useState(false);
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  // Keep the latest onClose available to the key handler without re-running it.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Enter/exit animation: keep the node mounted for the exit transition.
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  // Escape-to-close, focus trap and body scroll lock while mounted.
  useEffect(() => {
    if (!mounted) return undefined;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab') {
        const panel = panelRef.current;
        if (!panel) return;
        const focusables = panel.querySelectorAll(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mounted]);

  // Move focus into the panel on open (also restores focus on unmount via browser).
  useEffect(() => {
    if (mounted) panelRef.current?.focus();
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`rp-modal-overlay ${visible ? 'is-open' : ''}`}
      onClick={() => onCloseRef.current()}
      role="presentation"
    >
      <div
        className={`rp-modal-panel ${visible ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : 'Dialog'}
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="rp-modal-close" onClick={() => onCloseRef.current()} aria-label="Close">
          <X size={18} />
        </button>
        {title && <h2 className="rp-modal-title">{title}</h2>}
        <div className="rp-modal-body">{children}</div>
      </div>
    </div>
  );
}
