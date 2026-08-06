import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const PROFILE_KEY = 'retrofit.portal.profile';
const SETTINGS_KEY = 'retrofit.portal.settings';

const defaultProfile = {
  firstName: 'John',
  lastName: 'Hopkins',
  email: 'JohnHopkins123@gmail.com',
  phone: '+44 123 12334 22',
  avatar: 'https://i.pravatar.cc/160?img=13',
  notifications: {
    push: true,
    email: false,
  },
  property: {
    address: '12-14 Kingsway Court Hove, BN3 2LP United Kingdom',
    type: 'Mid Terrace Flat',
    epcNumber: '8821-0293-1402-4211-1025',
  },
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
  const [profile, setProfile] = useState(() => load(PROFILE_KEY, defaultProfile));
  const [settings, setSettings] = useState(() => load(SETTINGS_KEY, defaultSettings));

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const value = useMemo(
    () => ({
      profile,
      settings,
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
    [profile, settings],
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
