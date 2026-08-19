import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Grid3x3 } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { topbarNotifications as notifications, topbarApps as apps } from '../data/misc';
import '../styles/DashboardShared.css';

/**
 * Dashboard topbar — search, notification & app grid dropdowns, user chip.
 * Rendered on every dashboard page via DashboardLayout. Styled with
 * DashboardShared.css + Tailwind utilities.
 */
export default function Topbar() {
  const [openNotif, setOpenNotif] = useState(false);
  const [openGrid, setOpenGrid] = useState(false);
  const ref = useRef(null);
  const { profile } = useProfile();

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpenNotif(false);
        setOpenGrid(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 rp-dash-topbar" ref={ref}>
      <div className="rp-dash-topbar-search">
        <div className="relative rp-dash-topbar-search-field">
          <label htmlFor="topbar-search-input" className="sr-only">Search retrofit services</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            id="topbar-search-input"
            placeholder="Search retrofit services..."
            className="rp-topbar-search-input w-full bg-white pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>
      </div>

      <div className="relative shrink-0">
        <button
          aria-label="Open notifications"
          onClick={() => {
            setOpenNotif((v) => !v);
            setOpenGrid(false);
          }}
          className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white border border-line flex items-center justify-center"
        >
          <Bell size={18} className="text-ink" />
          <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-danger" />
        </button>
        {openNotif && (
          <div className="fixed right-4 top-16 sm:absolute sm:top-auto sm:right-0 sm:mt-2 w-72 max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-xl border border-line py-2 z-50">
            <div className="px-4 py-2 text-sm font-semibold text-ink border-b border-line">
              Notifications
            </div>
            {notifications.map((n, i) => (
              <div key={i} className="px-4 py-3 hover:bg-surface cursor-pointer">
                <p className="text-sm font-medium text-ink">{n.title}</p>
                <p className="text-xs text-muted mt-0.5">{n.meta}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative shrink-0 hidden sm:block">
        <button
          aria-label="Open apps menu"
          onClick={() => {
            setOpenGrid((v) => !v);
            setOpenNotif(false);
          }}
          className="w-11 h-11 rounded-full bg-white border border-line flex items-center justify-center"
        >
          <Grid3x3 size={18} className="text-ink" />
        </button>
        {openGrid && (
          <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-line p-3 grid grid-cols-3 gap-2 z-50">
            {apps.map((a) => (
              <div
                key={a}
                className="flex flex-col items-center gap-1 text-center p-2 rounded-xl hover:bg-surface cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-navy-900/5 flex items-center justify-center text-navy-900 text-xs font-semibold">
                  {a[0]}
                </div>
                <span className="text-[11px] text-body">{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 pl-1 border-l border-line shrink-0">
        <img
          src={profile.avatar}
          alt="User avatar"
          className="w-11 h-11 rounded-full object-cover"
        />
      </div>
    </div>
  );
}
