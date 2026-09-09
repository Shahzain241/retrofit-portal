import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const PROFILE_KEY = 'retrofit.portal.profile';
const SETTINGS_KEY = 'retrofit.portal.settings';

const DEFAULT_AVATAR = 'https://ui-avatars.com/api/?name=John+Hopkins&background=e6e9ef&color=475467&size=160';

/** True only when `value` is a usable image source (http(s) URL or data-image URI). */
function isImageSource(value) {
  return typeof value === 'string' && /^(https?:\/\/|data:image\/)/i.test(value);
}

/** Guard the avatar against stale/garbage values (e.g. a persisted toast
 *  message) — never let a non-image string become the avatar source. When no
 *  real photo is set (missing value, invalid string, or the generic remote
 *  ui-avatars.com placeholder), returns `null` so the UI falls back to clean
 *  initials instead of a broken/remote image. */
function sanitizeAvatar(value) {
  if (value === DEFAULT_AVATAR) return null;
  if (typeof value === 'string' && /ui-avatars\.com/i.test(value)) return null;
  return isImageSource(value) ? value : null;
}

const defaultProfile = {
  firstName: 'John',
  lastName: 'Hopkins',
  email: 'JohnHopkins123@gmail.com',
  phone: '+44 123 12334 22',
  avatar: null,
  notifications: {
    push: true,
    email: false,
  },
  property: {
    address: '12-14 Kingsway Court Hove, BN3 2LP United Kingdom',
    type: 'Mid Terrace Flat',
    epcNumber: '8821-0293-1402-4211-1025',
  },
  epcCertificatePath: null,
  plan: 'Free',
  nextBillingDate: null,
};

const defaultSettings = {
  emailTemplate: `<div class="header">
  <h2>Project Update: {{project_name}}</h2>
</div>
<p>Hello {{user_name}},</p>
<p>Your recent project submission has passed the
initial compliance checks and is now moving to the
secondary review phase.</p>
<a href="{{link}}" class="btn">View Status</a>`,
  integrations: [
    { name: 'Stripe Payments', status: 'Connected', meta: 'Last ping: 2 mins ago', connected: true },
    { name: 'AWS S3 Storage', status: 'Operational', meta: 'Healthy', connected: true },
    { name: 'SendGrid API', status: 'Operational', meta: 'Queue; 0 messages', connected: true },
  ],
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(() => {
    const p = load(PROFILE_KEY, defaultProfile);
    return { ...p, avatar: sanitizeAvatar(p.avatar) };
  });
  const [settings, setSettings] = useState(() => load(SETTINGS_KEY, defaultSettings));
  const [hydrated, setHydrated] = useState(false);

  // Latest profile for the auth-state listener below (the effect subscribes
  // once, so a ref avoids stale-closure reads of `profile`).
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Hydrate the profile from the live `profiles` row (merging over the
  // localStorage-seeded defaults) once a session is available.
  useEffect(() => {
    let mounted = true;

    const hydrate = async (userId) => {
      if (!userId) return;
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        if (error || !data) return;
        if (!mounted) return;
        setProfile((prev) => ({
          ...prev,
          firstName: data.first_name ?? prev.firstName,
          lastName: data.last_name ?? prev.lastName,
          email: data.email ?? prev.email,
          phone: data.phone ?? prev.phone,
          avatar: data.avatar_url != null ? sanitizeAvatar(data.avatar_url) : sanitizeAvatar(prev.avatar),
          notifications: {
            push: data.notifications?.push ?? prev.notifications.push,
          },
          property: {
            ...prev.property,
            address: data.property_address ?? prev.property.address,
            type: data.property_type ?? prev.property.type,
            epcNumber: data.epc_number ?? prev.property.epcNumber,
          },
          epcCertificatePath: data.epc_certificate_path ?? prev.epcCertificatePath,
          plan: data.plan ?? prev.plan,
          nextBillingDate: data.next_billing_date ?? prev.nextBillingDate,
        }));
      } catch {
        // Keep localStorage defaults on any failure.
      } finally {
        if (mounted) setHydrated(true);
      }
    };

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!mounted) return;
      if (session?.user) {
        await hydrate(session.user.id);
      } else {
        setHydrated(true);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      // After a confirmed email change (USER_UPDATED) the authenticated email
      // can differ from profiles.email — mirror it back to the profiles row so
      // the profile stays in sync with auth.users. Profile.jsx intentionally
      // defers the profiles write until the user clicks the confirmation link;
      // this is that post-confirmation step.
      if (
        event === 'USER_UPDATED' &&
        session?.user?.email &&
        session.user.email !== profileRef.current.email
      ) {
        supabase
          .from('profiles')
          .update({ email: session.user.email })
          .eq('id', session.user.id)
          .then(() => {
            if (mounted) hydrate(session.user.id);
          });
        return;
      }
      // Count sign-ins / token refreshes as activity so the admin User
      // Directory "Last Login" shows a real time (SECURITY DEFINER RPC stamps
      // the caller's own profiles.last_login_at).
      if (
        (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
        session?.user?.id
      ) {
        supabase.rpc('record_login').then(() => {});
      }
      hydrate(session?.user?.id ?? null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      profile,
      settings,
      hydrated,
      updateProfile: (patch) => setProfile((prev) => ({ ...prev, ...patch })),
      updateProperty: (patch) =>
        setProfile((prev) => ({ ...prev, property: { ...prev.property, ...patch } })),
      toggleNotification: (key) =>
        setProfile((prev) => ({
          ...prev,
          notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
        })),
      updateSettings: (patch) => setSettings((prev) => ({ ...prev, ...patch })),
    }),
    [profile, settings, hydrated],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used within a ProfileProvider');
  return ctx;
}

export function fileToDataUrl(file, maxSize = 240) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
