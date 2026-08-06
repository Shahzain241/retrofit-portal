import { useRef, useState } from 'react';
import { Pencil, Upload, Check, FileText } from 'lucide-react';
import Button from '../../components/Button';
import { useProfile, fileToDataUrl } from '../../context/ProfileContext';

export default function Profile() {
  const { profile, updateProfile, updateProperty, toggleNotification } = useProfile();

  const [form, setForm] = useState({
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phone: profile.phone,
  });
  const [property, setProperty] = useState({
    address: profile.property.address,
    type: profile.property.type,
    epcNumber: profile.property.epcNumber,
  });
  const [epcFile, setEpcFile] = useState(null);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [lastChanged, setLastChanged] = useState('3 months ago');
  const fileRef = useRef(null);

  function flashSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function handleAvatar(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    fileToDataUrl(file)
      .then((url) => updateProfile({ avatar: url }))
      .catch(() => {});
    e.target.value = '';
  }

  function handleSaveIdentity(e) {
    e.preventDefault();
    updateProfile(form);
    flashSaved();
  }

  function handleSaveProperty(e) {
    e.preventDefault();
    updateProperty(property);
    flashSaved();
  }

  function handleSaveAll() {
    updateProfile(form);
    updateProperty(property);
    flashSaved();
  }

  function handlePasswordChange(e) {
    e.preventDefault();
    if (pwForm.next.length < 6) {
      setPwError('New password must be at least 6 characters.');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('Passwords do not match.');
      return;
    }
    setPwError('');
    setLastChanged('Just now');
    setPwForm({ current: '', next: '', confirm: '' });
    setShowPassword(false);
    flashSaved();
  }

  function handleEpcUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setEpcFile(file.name);
    flashSaved();
    e.target.value = '';
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setPropertyField = (key) => (e) => setProperty((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div>
      <h1 className="text-2xl font-bold text-ink">Profile & Settings</h1>
      <p className="text-body mt-1 mb-6">
        Manage your personal identity, property portfolio, and security preferences.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-line/60 shadow-sm p-6">
          <div className="relative w-24 h-24 mb-6">
            <img
              src={profile.avatar}
              alt="avatar"
              className="w-24 h-24 rounded-full object-cover"
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-green text-white flex items-center justify-center hover:opacity-90"
            >
              <Pencil size={12} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
          </div>

          <form onSubmit={handleSaveIdentity} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">First Name</label>
                <input
                  value={form.firstName}
                  onChange={set('firstName')}
                  className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-ink mb-2">Last Name</label>
                <input
                  value={form.lastName}
                  onChange={set('lastName')}
                  className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Email Address</label>
              <input
                type="email"
                value={form.email}
                onChange={set('email')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Phone Number</label>
              <input
                value={form.phone}
                onChange={set('phone')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full">
              Update
            </Button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6">
            <h4 className="font-bold text-ink mb-1">Password & Security</h4>
            <p className="text-sm text-body mb-4">
              Change your password or manage two-factor authentication to keep your account secure.
            </p>
            <div className="flex items-center justify-between border border-line rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">Account Password</p>
                <p className="text-xs text-muted">Last changed {lastChanged}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-brand-green text-sm font-semibold"
              >
                {showPassword ? 'CANCEL' : 'UPDATE'}
              </button>
            </div>
            {showPassword && (
              <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">Current Password</label>
                  <input
                    type="password"
                    value={pwForm.current}
                    onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                    className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">New Password</label>
                  <input
                    type="password"
                    value={pwForm.next}
                    onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                    className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={pwForm.confirm}
                    onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                    className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                  />
                </div>
                {pwError && <p className="text-sm text-danger">{pwError}</p>}
                <Button type="submit" variant="navy" className="w-full !py-2.5 text-sm">
                  Update Password
                </Button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-4">
            <h4 className="font-bold text-ink">Notification Preferences</h4>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Receive Push Notification</p>
                <p className="text-xs text-muted mt-1">
                  Receive alerts when your retrofit project hits a major milestone.
                </p>
              </div>
              <Toggle on={profile.notifications.push} onClick={() => toggleNotification('push')} />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Email Alerts</p>
                <p className="text-xs text-muted mt-1">
                  Get project updates delivered straight to your inbox.
                </p>
              </div>
              <Toggle on={profile.notifications.email} onClick={() => toggleNotification('email')} />
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={handleSaveProperty} className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-ink">Primary Property Details</h4>
          <span className="bg-brand-green-light text-brand-green text-xs font-bold px-3 py-1 rounded-full">
            VERIFIED
          </span>
        </div>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-ink mb-2">Address</label>
            <input
              value={property.address}
              onChange={setPropertyField('address')}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">Property Type</label>
              <input
                value={property.type}
                onChange={setPropertyField('type')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-ink mb-2">EPC Number</label>
              <input
                value={property.epcNumber}
                onChange={setPropertyField('epcNumber')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
          </div>
          {epcFile ? (
            <div className="flex items-center gap-3 bg-surface border border-line rounded-xl px-4 py-3">
              <FileText size={18} className="text-brand-green" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{epcFile}</p>
                <p className="text-xs text-muted">EPC Certificate • Uploaded just now</p>
              </div>
              <span className="text-xs font-bold text-brand-green">UPLOADED</span>
            </div>
          ) : (
            <label className="border-2 border-dashed border-line rounded-xl py-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface">
              <Upload size={22} className="text-ink mb-3" />
              <p className="font-semibold text-ink text-sm">Upload New EPC Certificate</p>
              <p className="text-xs text-muted mt-1">PDF, JPEG, or PNG up to 10MB</p>
              <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleEpcUpload} />
            </label>
          )}
          <Button type="submit" variant="primary" className="w-full">
            Upload & Save
          </Button>
        </div>
      </form>

      <div className="flex items-center gap-3 mt-6">
        <Button variant="green" className="flex-1 !py-4" onClick={handleSaveAll}>
          Save
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green">
            <Check size={16} /> Saved!
          </span>
        )}
      </div>
    </div>
  );
}

function Toggle({ on, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 transition-colors ${
        on ? 'bg-navy-900 justify-end' : 'bg-line justify-start'
      }`}
    >
      <span className="w-5 h-5 rounded-full bg-white block" />
    </button>
  );
}
