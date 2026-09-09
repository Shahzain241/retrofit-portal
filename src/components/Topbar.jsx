import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useProfile } from '../context/ProfileContext';
import { publicServices } from '../data/services';
import { clientLinks, adminLinks } from '../data/sidebarLinks';
import { supabase } from '../lib/supabaseClient';
import '../styles/DashboardShared.css';

// The apps menu is role-aware and driven by the SAME destination lists as the
// dashboard sidebar (data/sidebarLinks.js) so the two can never drift or leak
// between the client and admin dashboards. The active list is chosen by the
// layout variant (which dashboard is currently rendered), not by user role.
const CLIENT_APPS = clientLinks.map(({ to, label }) => ({ label, to }));
const ADMIN_APPS = adminLinks.map(({ to, label }) => ({ label, to }));

const STAFF_ROLES = ['super-admin', 'coordinator', 'designer', 'assessor'];

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
const SEARCH_LIMIT = 5;

/** Format a timestamp as a short time, e.g. "14:22". */
function formatNotifTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** True only when `value` is a usable image source (http(s) URL or data-image URI). */
export function isImageSource(value) {
  return typeof value === 'string' && value.length > 0 && /^(https?:\/\/|data:image\/)/i.test(value);
}

/** Fallback initials derived from a display name ("Jane Doe" -> "JD"). */
export function getAvatarInitials(name = '') {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Topbar avatar — always renders a clean circle: the profile image when a
 * valid avatar source is set, or fallback initials otherwise. The raw avatar
 * string is NEVER rendered as text content, so a stale/garbage avatar value
 * (e.g. a persisted toast/notification/error message) can never leak into the
 * UI. A failed image load swaps to initials instead of showing broken content.
 */
export function TopbarAvatar({ avatar, name = '', className = '' }) {
  const [failed, setFailed] = useState(false);
  const showImage = isImageSource(avatar) && !failed;

  if (!showImage) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-full bg-[#e6e9ef] text-navy-900 font-semibold select-none border-2 border-[#0F9D58] ${className}`}
      >
        {getAvatarInitials(name)}
      </span>
    );
  }
  return (
    <img
      src={avatar}
      alt="User avatar"
      onError={() => setFailed(true)}
      className={`rounded-full object-cover bg-[#e6e9ef] border-2 border-[#0F9D58] ${className}`}
    />
  );
}

/** Material-style outlined bell (Google "notifications" silhouette): rounded
 * dome top, small knob on the crown, straight vertical sides, a flat bottom
 * bar wider than the dome, and a small semicircle clapper hanging below it.
 * Drawn hollow/outline (stroke) in the current color — not solid-filled.
 * lucide-react only ships rounded-dome Bell variants, so this is custom. */
function SolidBellIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M7 9.5A5 5 0 0 1 17 9.5L17 17.4L18.5 17.4L18.5 19.2L5.5 19.2L5.5 17.4L7 17.4Z"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4 19.2A1.6 1.6 0 0 0 13.6 19.2"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <circle cx="12" cy="3.2" r="1.6" stroke="currentColor" strokeWidth={2.2} />
    </svg>
  );
}

/** Solid 3x3 dots grid (app-launcher style) — matches the Figma apps-menu icon. */
function DotsGridIcon({ size = 18, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <g fill="currentColor">
        <circle cx="5" cy="5" r="2.4" />
        <circle cx="12" cy="5" r="2.4" />
        <circle cx="19" cy="5" r="2.4" />
        <circle cx="5" cy="12" r="2.4" />
        <circle cx="12" cy="12" r="2.4" />
        <circle cx="19" cy="12" r="2.4" />
        <circle cx="5" cy="19" r="2.4" />
        <circle cx="12" cy="19" r="2.4" />
        <circle cx="19" cy="19" r="2.4" />
      </g>
    </svg>
  );
}

/** Display name used to derive the avatar fallback initials. */
function avatarName(profile) {
  return `${profile?.firstName ?? ''} ${profile?.lastName ?? ''}`.trim() || profile?.email || '';
}

export default function Topbar({ variant = 'client' }) {
  const [openNotif, setOpenNotif] = useState(false);
  const [openGrid, setOpenGrid] = useState(false);
  const ref = useRef(null);
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  // Staff/admin users get all-project search + the admin apps menu; clients
  // keep the own-projects scope and client apps menu.
  const [isStaff, setIsStaff] = useState(false);

  // Search — the client's own projects (Supabase, RLS-scoped) + the public
  // services catalogue (src/data/services.js; the services table is staff-only).
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ projects: [], services: [] });
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Real unread notifications for the logged-in user (RLS: own rows only).
  const loadNotifications = useCallback(async (uid) => {
    if (!uid) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) {
      console.error('[Topbar] failed to load notifications', error.message, error);
      return;
    }
    setNotifications(data ?? []);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      const uid = data?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        loadNotifications(uid);
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', uid)
          .maybeSingle();
        if (mounted) {
          setIsStaff(!!profile?.role && STAFF_ROLES.includes(profile.role));
        }
      }
    });
    return () => {
      mounted = false;
    };
  }, [loadNotifications]);

  // Debounced search: own projects (Supabase) + services (static catalogue).
  const runSearch = useCallback(async (query) => {
    const q = query.trim();
    if (q.length < SEARCH_MIN_CHARS) {
      setSearchResults({ projects: [], services: [] });
      setSearchOpen(false);
      setSearching(false);
      return;
    }

    const ql = q.toLowerCase();
    const services = publicServices
      .filter((s) => s.title.toLowerCase().includes(ql))
      .slice(0, SEARCH_LIMIT)
      .map((s) => ({ id: s.id, title: s.title, category: s.category, price: s.price, currency: s.currency }));

    let projects = [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Staff/admin search ALL projects; clients only their own (RLS-scoped).
      let query = supabase
        .from('projects')
        .select('id, name, address_line1, address_city')
        .or(`name.ilike.%${q}%,address_line1.ilike.%${q}%,address_city.ilike.%${q}%,id.ilike.%${q}%`)
        .limit(SEARCH_LIMIT);
      if (!isStaff) query = query.eq('client_id', user.id);
      const { data, error } = await query;
      if (!error) {
        projects = (data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          address: [p.address_line1, p.address_city].filter(Boolean).join(', '),
        }));
      }
    }

    setSearchResults({ projects, services });
    setSearchOpen(true);
    setSearching(false);
  }, [isStaff]);

  useEffect(() => {
    if (searchQuery.trim().length < SEARCH_MIN_CHARS) {
      setSearchResults({ projects: [], services: [] });
      setSearchOpen(false);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const timer = window.setTimeout(() => runSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery, runSearch]);

  function selectResult(type, id) {
    setSearchQuery('');
    setSearchOpen(false);
    if (type === 'project') {
      // Staff/admin land on the project's task board; clients on their project.
      if (isStaff) navigate(`/admin/projects/${id}/board`);
      else navigate(`/projects/${id}`);
    } else navigate(`/services/${id}`);
  }

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpenNotif(false);
        setOpenGrid(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Mark read + navigate to the notification's link (if present).
  async function handleNotificationClick(n) {
    if (userId && !n.is_read) {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', n.id)
        .eq('user_id', userId);
      if (!error) {
        setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      }
    }
    if (n.link) navigate(n.link);
    setOpenNotif(false);
  }

  const unreadCount = notifications.length;

  return (
    <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-8 rp-dash-topbar" ref={ref}>
      <div className="rp-dash-topbar-search relative">
        <div className="relative rp-dash-topbar-search-field">
          <label htmlFor="topbar-search-input" className="sr-only">Search retrofit services</label>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            id="topbar-search-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery.trim().length >= SEARCH_MIN_CHARS) setSearchOpen(true);
            }}
            placeholder="Search retrofit services..."
            className="rp-topbar-search-input w-full bg-white pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-green/30"
          />
        </div>

        {searchOpen && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-line py-2 max-h-80 overflow-y-auto">
            {searching ? (
              <p className="px-4 py-3 text-sm text-muted">Searching...</p>
            ) : searchResults.projects.length === 0 && searchResults.services.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted">No results for "{searchQuery.trim()}".</p>
            ) : (
              <>
                {searchResults.projects.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase text-muted border-b border-line/60">Projects</div>
                    {searchResults.projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectResult('project', p.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface cursor-pointer"
                      >
                        <p className="text-sm font-medium text-ink">{p.name || p.id}</p>
                        {p.address && <p className="text-xs text-muted">{p.address}</p>}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.services.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase text-muted border-b border-line/60">Services</div>
                    {searchResults.services.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => selectResult('service', s.id)}
                        className="w-full text-left px-4 py-2.5 hover:bg-surface cursor-pointer"
                      >
                        <p className="text-sm font-medium text-ink">{s.title}</p>
                        <p className="text-xs text-muted">
                          {s.category}
                          {s.price ? ` • ${s.currency} ${s.price}` : ''}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="relative shrink-0 ml-2 -mr-2">
        <button
          aria-label="Open notifications"
          onClick={() => {
            setOpenNotif((v) => !v);
            setOpenGrid(false);
            if (!openNotif) loadNotifications(userId);
          }}
          className="relative w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center"
        >
          <SolidBellIcon size={18} className="text-ink" />
          {unreadCount > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-danger border border-white" />
          ) : (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger border border-white" />
          )}
        </button>
        {openNotif && (
          <div className="fixed right-4 top-16 sm:absolute sm:top-auto sm:right-0 sm:mt-2 w-72 max-w-[calc(100vw-32px)] bg-white rounded-2xl shadow-xl border border-line py-2 z-50">
            <div className="px-4 py-2 text-sm font-semibold text-ink border-b border-line">
              Notifications
            </div>
            {notifications.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted">No unread notifications.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className="w-full text-left px-4 py-3 hover:bg-surface cursor-pointer"
                >
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  <p className="text-xs text-muted mt-0.5">{n.body}</p>
                  <p className="text-[10px] text-muted mt-1">{formatNotifTime(n.created_at)}</p>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative shrink-0 hidden sm:block -ml-2 -mr-2">
        <button
          aria-label="Open apps menu"
          onClick={() => {
            setOpenGrid((v) => !v);
            setOpenNotif(false);
          }}
          className="w-11 h-11 flex items-center justify-center"
        >
          <DotsGridIcon size={18} className="text-ink" />
        </button>
        {openGrid && (
          <div className="absolute right-0 mt-2 w-[250px] bg-white rounded-2xl shadow-xl border border-line p-3 grid grid-cols-3 gap-3 z-50">
            {(variant === 'admin' ? ADMIN_APPS : CLIENT_APPS).map((a) => (
              <button
                key={a.label}
                onClick={() => {
                  setOpenGrid(false);
                  navigate(a.to);
                }}
                className="flex flex-col items-center gap-1 text-center p-2 rounded-xl hover:bg-surface cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-navy-900/5 flex items-center justify-center text-navy-900 text-xs font-semibold">
                  {a.label[0]}
                </div>
                <span className="text-[11px] text-body">{a.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative shrink-0">
        {variant === 'admin' ? (
          // Admin dashboard: the avatar is a plain, inert display element —
          // no click handler, no navigation, no clickable styling.
          <TopbarAvatar
            avatar={profile.avatar}
            name={avatarName(profile)}
            className="w-[35px] h-[35px]"
          />
        ) : (
          <button
            type="button"
            aria-label="Open profile"
            onClick={() => navigate('/profile')}
            className="p-0 rounded-full border-0 bg-transparent cursor-pointer"
          >
            <TopbarAvatar
              avatar={profile.avatar}
              name={avatarName(profile)}
              className="w-[35px] h-[35px]"
            />
          </button>
        )}
      </div>
    </div>
  );
}