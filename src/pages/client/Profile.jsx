import { useEffect, useRef, useState } from 'react';
import { Upload, Check, FileText, Pencil, Eye, EyeOff } from 'lucide-react';
import Button from '../../components/Button';
import Badge from '../../components/Badge';
import Toggle from '../../components/Toggle';
import { useProfile, fileToDataUrl } from '../../context/ProfileContext';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/Profile.css';

/**
 * Client Profile & Settings — identity, property, password and notification
 * preferences. Identity/property/notifications persist to the `profiles`
 * table via Supabase. Styled via Profile.css + Tailwind utilities.
 */

export default function Profile() {
  const { profile, hydrated, updateProfile, updateProperty, toggleNotification } = useProfile();
  const { showToast } = useToast();

  const [userId, setUserId] = useState(null);
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
  const [epcPath, setEpcPath] = useState(null);
  const [epcViewing, setEpcViewing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '' });
  const [pwError, setPwError] = useState('');
  const [lastChanged, setLastChanged] = useState('3 months ago');
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [emailError, setEmailError] = useState('');
  const fileRef = useRef(null);
  const epcFileRef = useRef(null);
  const didInit = useRef(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data?.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Once the live profile row is loaded into context, sync the forms to it so
  // they show real data instead of the localStorage defaults.
  useEffect(() => {
    if (hydrated && !didInit.current) {
      didInit.current = true;
      setForm({
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
      });
      setProperty({
        address: profile.property.address,
        type: profile.property.type,
        epcNumber: profile.property.epcNumber,
      });
      setEpcPath(profile.epcCertificatePath ?? null);
    }
  }, [hydrated, profile]);

  function flashSaved() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  async function handleAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!userId) return;
    if (!file.type.startsWith('image/')) {
      showToast({ type: 'error', message: 'Please choose an image file.' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast({ type: 'error', message: 'Image must be 2MB or smaller.' });
      return;
    }
    // Optimistic local preview while the upload runs.
    fileToDataUrl(file)
      .then((url) => updateProfile({ avatar: url }))
      .catch(() => {});

    const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/gi, '') || 'jpg');
    const storagePath = `${userId}/avatar.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, { upsert: true, cacheControl: '3600' });
      if (uploadError) {
        showToast({ type: 'error', message: uploadError.message || 'Could not upload photo.' });
        return;
      }
      const { data } = supabase.storage.from('avatars').getPublicUrl(storagePath);
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', userId);
      if (dbError) {
        showToast({ type: 'error', message: dbError.message || 'Could not save avatar.' });
        return;
      }
      updateProfile({ avatar: data.publicUrl });
      showToast({ type: 'success', message: 'Profile photo updated' });
    } catch {
      showToast({ type: 'error', message: 'Could not upload photo' });
    }
  }

  function handleSaveIdentity(e) {
    e.preventDefault();
    if (!userId) return;
    supabase
      .from('profiles')
      .update({ first_name: form.firstName, last_name: form.lastName, phone: form.phone })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) {
          showToast({ type: 'error', message: error.message || 'Could not update profile.' });
          return;
        }
        updateProfile(form);
        flashSaved();
        showToast({ type: 'success', message: 'Profile updated' });
      });
  }

  function handleEmailChange() {
    const email = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address.');
      showToast({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    if (email.toLowerCase() === form.email.toLowerCase()) {
      setEmailError('New email must be different from your current email.');
      showToast({ type: 'error', message: 'New email must be different from your current email.' });
      return;
    }
    setEmailError('');
    // profiles.email is NOT updated here — the change only takes effect once
    // the user clicks the confirmation link sent to the new address (the
    // USER_UPDATED sync in ProfileContext handles the post-confirmation write).
    supabase.auth
      .updateUser({ email })
      .then(({ error }) => {
        if (error) {
          setEmailError(error.message || 'Could not update email.');
          showToast({ type: 'error', message: error.message || 'Could not update email.' });
          return;
        }
        setEmailNote(
          'A confirmation link has been sent to your new email. Your email address will not change until you click it.',
        );
        setEditingEmail(false);
        setNewEmail('');
        showToast({ type: 'success', message: 'Confirmation link sent to your new email' });
      });
  }

  function handleSaveProperty(e) {
    e.preventDefault();
    if (!userId) return;
    supabase
      .from('profiles')
      .update({
        property_address: property.address,
        property_type: property.type,
        epc_number: property.epcNumber,
      })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) {
          showToast({ type: 'error', message: error.message || 'Could not update property details.' });
          return;
        }
        updateProperty(property);
        flashSaved();
        showToast({ type: 'success', message: 'Property details updated' });
      });
  }

  function handleSaveAll() {
    if (!userId) return;
    Promise.all([
      supabase
        .from('profiles')
        .update({ first_name: form.firstName, last_name: form.lastName, phone: form.phone })
        .eq('id', userId),
      supabase
        .from('profiles')
        .update({
          property_address: property.address,
          property_type: property.type,
          epc_number: property.epcNumber,
        })
        .eq('id', userId),
    ]).then(([identityResult, propertyResult]) => {
      const error = identityResult.error || propertyResult.error;
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not save profile.' });
        return;
      }
      updateProfile(form);
      updateProperty(property);
      flashSaved();
      showToast({ type: 'success', message: 'Profile saved' });
    });
  }

  function handleTogglePush() {
    if (!userId) return;
    const next = !profile.notifications.push;
    supabase
      .from('profiles')
      .update({ notifications: { push: next } })
      .eq('id', userId)
      .then(({ error }) => {
        if (error) {
          showToast({ type: 'error', message: error.message || 'Could not update notification preferences.' });
          return;
        }
        toggleNotification('push');
        showToast({ type: 'success', message: 'Notification preferences updated' });
      });
  }

  function handlePasswordChange(e) {
    e.preventDefault();
    // Known simplification: Supabase's updateUser() does not require the
    // current password by default and no re-auth flow exists yet, so the
    // "Current Password" field is collected but deliberately not re-verified.
    const { next } = pwForm;
    if (!next) {
      setPwError('Please enter an account password.');
      showToast({ type: 'error', message: 'Please enter an account password.' });
      return;
    }
    if (next.length < 6) {
      setPwError('New password must be at least 6 characters.');
      showToast({ type: 'error', message: 'New password must be at least 6 characters' });
      return;
    }
    setPwError('');
    supabase.auth
      .updateUser({ password: next })
      .then(({ error }) => {
        if (error) {
          setPwError(error.message || 'Could not update password.');
          showToast({ type: 'error', message: error.message || 'Could not update password.' });
          return;
        }
        setLastChanged('Just now');
        setPwForm({ current: '', next: '' });
        setShowPassword(false);
        setShowCurrent(false);
        setShowNext(false);
        flashSaved();
        showToast({ type: 'success', message: 'Password updated' });
      });
  }

  async function handleEpcUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!userId) return;
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      showToast({ type: 'error', message: 'Please choose a PDF, JPG, or PNG file.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast({ type: 'error', message: 'EPC certificate must be 5MB or smaller.' });
      return;
    }
    const ext = ((file.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/gi, '') || 'pdf');
    const storagePath = `${userId}/certificate.${ext}`;
    try {
      const { error: uploadError } = await supabase.storage
        .from('epc-certificates')
        .upload(storagePath, file, { upsert: true, cacheControl: '3600' });
      if (uploadError) {
        showToast({ type: 'error', message: uploadError.message || 'Could not upload EPC certificate.' });
        return;
      }
      // The bucket is private, so we persist the storage PATH (not a public
      // URL) and generate short-lived signed URLs on demand.
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ epc_certificate_path: storagePath })
        .eq('id', userId);
      if (dbError) {
        showToast({ type: 'error', message: dbError.message || 'Could not save EPC certificate.' });
        return;
      }
      setEpcPath(storagePath);
      updateProfile({ epcCertificatePath: storagePath });
      flashSaved();
      showToast({ type: 'success', message: 'EPC certificate uploaded' });
    } catch {
      showToast({ type: 'error', message: 'Could not upload EPC certificate' });
    }
  }

  async function handleViewEpc() {
    if (!epcPath) return;
    setEpcViewing(true);
    try {
      const { data, error } = await supabase.storage
        .from('epc-certificates')
        .createSignedUrl(epcPath, 60);
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not open certificate.' });
        return;
      }
      window.open(data.signedUrl, '_blank', 'noopener');
    } catch {
      showToast({ type: 'error', message: 'Could not open certificate' });
    } finally {
      setEpcViewing(false);
    }
  }

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setPropertyField = (key) => (e) => setProperty((p) => ({ ...p, [key]: e.target.value }));

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      <h1 className="text-2xl font-bold text-ink">Profile & Settings</h1>
      <p className="text-body mt-1 mb-6">
        Manage your personal identity, property portfolio, and security preferences.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[624px_1fr] gap-6">
        {/* Left main column (~65%) */}
        <div className="space-y-6">
          {/* Profile Info card */}
          <div className="rp-profile-info-card">
          <div className="flex justify-center mb-5">
            <div className="relative w-24 h-24 rounded-full bg-[#e6e9ef]">
              <img
                src={profile.avatar}
                alt="Profile photo"
                className="w-24 h-24 rounded-full object-cover bg-[#e6e9ef]"
              />
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Change profile photo"
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-brand-green text-white flex items-center justify-center border-2 border-white hover:opacity-90"
              >
                <Pencil size={13} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
          </div>

          <form onSubmit={handleSaveIdentity} className="space-y-5">
            <div>
              <label htmlFor="profile-first-name" className="block text-sm font-semibold text-ink mb-2">First Name</label>
              <input
                id="profile-first-name"
                value={form.firstName}
                onChange={set('firstName')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
            <div>
              <label htmlFor="profile-last-name" className="block text-sm font-semibold text-ink mb-2">Last Name</label>
              <input
                id="profile-last-name"
                value={form.lastName}
                onChange={set('lastName')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="profile-email" className="block text-sm font-semibold text-ink">Email Address</label>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmail((v) => !v);
                    if (!editingEmail) {
                      setNewEmail('');
                      setEmailNote('');
                      setEmailError('');
                    }
                  }}
                  className="text-brand-green text-sm font-semibold"
                >
                  {editingEmail ? 'CANCEL' : 'EDIT'}
                </button>
              </div>
              <input
                id="profile-email"
                type="email"
                value={form.email}
                onChange={set('email')}
                readOnly
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
              {emailNote && <p className="text-sm text-brand-green mt-2">{emailNote}</p>}
              {editingEmail && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label htmlFor="profile-new-email" className="block text-sm font-semibold text-ink mb-2">New Email</label>
                    <input
                      id="profile-new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full rounded-xl border border-line px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    />
                  </div>
                  {emailError && <p className="text-sm text-danger">{emailError}</p>}
                  <Button
                    type="button"
                    variant="navy"
                    onClick={handleEmailChange}
                    className="w-full !py-2.5 text-sm"
                  >
                    Update Email
                  </Button>
                </div>
              )}
            </div>
            <div>
              <label htmlFor="profile-phone" className="block text-sm font-semibold text-ink mb-2">Phone Number</label>
              <input
                id="profile-phone"
                value={form.phone}
                onChange={set('phone')}
                className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
              />
            </div>
            <Button type="submit" variant="primary" className="w-full rp-profile-update">
              Update
            </Button>
          </form>
          </div>
        </div>

        {/* Right side column (~35%) */}
        <div className="space-y-6">
          <div className="rp-profile-security-card">
            <h4 className="font-bold text-ink">Password & Security</h4>
            <p className="text-sm text-body">
              Change your password to keep your account secure.
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
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <label htmlFor="profile-current-password" className="block text-sm font-semibold text-ink mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      id="profile-current-password"
                      type={showCurrent ? 'text' : 'password'}
                      value={pwForm.current}
                      onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                      className="w-full rounded-xl border border-line px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      aria-label="Toggle current password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="profile-account-password" className="block text-sm font-semibold text-ink mb-2">Account Password</label>
                  <div className="relative">
                    <input
                      id="profile-account-password"
                      type={showNext ? 'text' : 'password'}
                      value={pwForm.next}
                      onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                      className="w-full rounded-xl border border-line px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNext((v) => !v)}
                      aria-label="Toggle account password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                    >
                      {showNext ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                {pwError && <p className="text-sm text-danger">{pwError}</p>}
                <Button type="submit" variant="navy" className="w-full !py-2.5 text-sm">
                  Update Password
                </Button>
              </form>
            )}
          </div>

          <div className="rp-profile-notif-card">
            <h4 className="font-bold text-ink">Notification Preferences</h4>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink">Receive Push Notification</p>
                <p className="text-xs text-muted mt-1">
                  Receive alerts when your retrofit project hits a major milestone.
                </p>
              </div>
              <Toggle aria-label="Receive push notifications" on={profile.notifications.push} onClick={handleTogglePush} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section: Primary Property Details (large white card) */}
      <form onSubmit={handleSaveProperty} className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-bold text-ink">Primary Property Details</h4>
          <Badge variant="green">VERIFIED</Badge>
        </div>
        <div className="space-y-5">
          <div>
            <label htmlFor="profile-address" className="block text-sm font-semibold text-ink mb-2">Address</label>
            <input
              id="profile-address"
              value={property.address}
              onChange={setPropertyField('address')}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <div>
            <label htmlFor="profile-property-type" className="block text-sm font-semibold text-ink mb-2">Property Type</label>
            <input
              id="profile-property-type"
              value={property.type}
              onChange={setPropertyField('type')}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          <div>
            <label htmlFor="profile-epc-number" className="block text-sm font-semibold text-ink mb-2">EPC Number</label>
            <input
              id="profile-epc-number"
              value={property.epcNumber}
              onChange={setPropertyField('epcNumber')}
              className="w-full rounded-xl border border-line px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-green/30"
            />
          </div>
          {epcPath ? (
            <div className="rp-epc-uploaded">
              <span className="rp-epc-uploaded-icon">
                <FileText size={20} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="rp-epc-uploaded-name">{epcPath.split('/').pop()}</p>
                <p className="rp-epc-uploaded-meta">EPC Certificate</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Button
                  type="button"
                  variant="navy"
                  onClick={handleViewEpc}
                  disabled={epcViewing}
                  className="!py-1.5 !px-3 text-xs"
                >
                  {epcViewing ? 'Opening…' : 'View'}
                </Button>
                <button
                  type="button"
                  onClick={() => epcFileRef.current?.click()}
                  className="rp-epc-replace"
                >
                  REPLACE
                </button>
              </div>
              <input
                ref={epcFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={handleEpcUpload}
              />
            </div>
          ) : (
            <label className="rp-epc-dropzone">
              <span className="rp-epc-dropzone-icon">
                <Upload size={20} />
              </span>
              <p className="rp-epc-dropzone-title">Upload New EPC Certificate</p>
              <p className="rp-epc-dropzone-hint">PDF, JPEG, or PNG up to 10MB</p>
              <span className="rp-epc-dropzone-btn">Upload</span>
              <input
                ref={epcFileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                className="hidden"
                onChange={handleEpcUpload}
              />
            </label>
          )}
          <Button
            type="button"
            variant="primary"
            className="w-full rp-property-upload"
            onClick={() => epcFileRef.current?.click()}
          >
            Upload
          </Button>
        </div>
      </form>

      {/* Save button (centered, standalone) */}
      <div className="mt-6 flex flex-col items-center">
        <Button
          variant="green"
          onClick={handleSaveAll}
          className="rp-profile-save"
        >
          Save
        </Button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-brand-green">
            <Check size={16} /> Saved!
          </span>
        )}
      </div>
    </div>
  );
}
