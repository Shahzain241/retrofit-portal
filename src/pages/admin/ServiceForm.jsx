import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Upload, Plus, Bold, Italic, List, Trash2, X } from 'lucide-react';
import Button from '../../components/Button';
import { useToast } from '../../context/ToastContext';
import { supabase } from '../../lib/supabaseClient';
import '../../styles/ServiceForm.css';

// Allowlisted rich-text tags for the description (the toolbar only ever
// produces b/i/ul/li; anything else — scripts, attributes, unknown tags — is
// stripped before the value is persisted to `services.description`).
const ALLOWED_DESCRIPTION_TAGS = ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'p', 'br'];

const MEDIA_BUCKET = 'service-media';
const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const MEDIA_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function emptyTier() {
  return { key: newId(), name: '', price: '', days: '', deliverables: [] };
}

/** Strip everything except the allowlisted tags (no attributes, no scripts). */
function sanitizeRichText(input) {
  if (!input) return '';
  return String(input)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
    .replace(/<[^>]+>/g, (tag) => {
      const close = tag.startsWith('</');
      const name = (tag.replace(/^<\/?\s*/, '').match(/^[a-zA-Z0-9]+/) || [''])[0].toLowerCase();
      if (!ALLOWED_DESCRIPTION_TAGS.includes(name)) return '';
      return close ? `</${name}>` : `<${name}>`;
    });
}

/** Recover a storage path from a public service-media URL (for deletions). */
function pathFromPublicUrl(url) {
  if (!url) return '';
  const marker = `/${MEDIA_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return '';
  return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
}

export default function ServiceForm() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const { showToast } = useToast();

  const serviceId = params.id;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tiers, setTiers] = useState([emptyTier()]);
  const [active, setActive] = useState(true);
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaPath, setMediaPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const descriptionRef = useRef(null);
  const mediaFileRef = useRef(null);

  const loadTiers = useCallback(async (sid) => {
    const { data: tiersData, error: tiersErr } = await supabase
      .from('service_tiers')
      .select('id, name, price, working_days, sort_order')
      .eq('service_id', sid)
      .order('sort_order', { ascending: true });
    if (tiersErr) {
      showToast({ type: 'error', message: tiersErr.message || 'Could not load pricing tiers.' });
      return null;
    }
    const result = [];
    for (const t of tiersData ?? []) {
      const { data: delivData, error: delivErr } = await supabase
        .from('service_tier_deliverables')
        .select('title')
        .eq('tier_id', t.id)
        .order('sort_order', { ascending: true });
      if (delivErr) {
        showToast({ type: 'error', message: delivErr.message || 'Could not load tier deliverables.' });
        return null;
      }
      result.push({
        key: t.id,
        name: t.name ?? '',
        price: t.price != null ? String(t.price) : '',
        days: t.working_days != null ? String(t.working_days) : '',
        deliverables: (delivData ?? []).map((d) => ({ key: newId(), title: d.title ?? '' })),
      });
    }
    return result;
  }, [showToast]);

  function applyService(s, loadedTiers) {
    setTitle(s.title ?? '');
    setDescription(s.description ?? '');
    setActive(s.status === 'active');
    setMediaUrl(s.media_url ?? '');
    setMediaPath(pathFromPublicUrl(s.media_url));
    if (loadedTiers && loadedTiers.length > 0) {
      setTiers(loadedTiers);
    } else {
      // Legacy single-price service → seed one tier from the legacy columns so
      // the form always shows a working tier (never a silent no-op).
      setTiers([
        {
          key: newId(),
          name: 'Standard',
          price: s.price != null ? String(s.price) : '',
          days: s.working_days != null ? String(s.working_days) : '',
          deliverables: [],
        },
      ]);
    }
  }

  useEffect(() => {
    if (!serviceId) return;
    const existing = location.state?.service;
    let mounted = true;
    setLoading(true);
    (async () => {
      try {
        let row = existing && existing.id === serviceId ? existing : null;
        if (!row) {
          const { data, error } = await supabase
            .from('services')
            .select('*')
            .eq('id', serviceId)
            .single();
          if (error) throw error;
          row = data;
        }
        const loadedTiers = await loadTiers(serviceId);
        if (mounted) applyService(row, loadedTiers);
      } catch (err) {
        if (mounted) {
          showToast({ type: 'error', message: err?.message || 'Could not load service.' });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [serviceId, location.state?.service, showToast, loadTiers]);

  function validate() {
    const missing = [];
    if (!title.trim()) missing.push('Service Title');
    if (tiers.length === 0) missing.push('at least one Pricing Tier');
    else {
      const bad = tiers.findIndex(
        (t) => !t.name.trim() || t.price === '' || Number.isNaN(Number(t.price)) ||
          t.days === '' || Number.isNaN(Number(t.days)),
      );
      if (bad !== -1) missing.push(`Tier ${bad + 1} (name, price and days are required)`);
    }
    return missing;
  }

  // --- description toolbar -----------------------------------------------------
  function wrapSelection(prefix, suffix) {
    const el = descriptionRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = description;
    const before = value.slice(0, start);
    const selected = value.slice(start, end);
    const after = value.slice(end);
    setDescription(`${before}${prefix}${selected}${suffix}${after}`);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + prefix.length + selected.length + suffix.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function applyBold() {
    wrapSelection('<b>', '</b>');
  }

  function applyItalic() {
    wrapSelection('<i>', '</i>');
  }

  function applyList() {
    const el = descriptionRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = description;
    const lineEnd = value.indexOf('\n', start);
    const selected = value.slice(start, end).trim() ||
      value.slice(start, lineEnd === -1 ? value.length : lineEnd).trim();
    if (!selected) return;
    const lines = selected
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => `  <li>${l}</li>`)
      .join('\n');
    const before = value.slice(0, start);
    const after = value.slice(end);
    setDescription(`${before}<ul>\n${lines}\n</ul>${after}`);
    requestAnimationFrame(() => {
      el.focus();
    });
  }

  // --- tiers + deliverables ----------------------------------------------------
  function updateTier(index, patch) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, emptyTier()]);
  }

  function removeTier(index) {
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function addDeliverable(index) {
    updateTier(index, { deliverables: [...tiers[index].deliverables, { key: newId(), title: '' }] });
  }

  function updateDeliverable(index, dIndex, value) {
    updateTier(index, {
      deliverables: tiers[index].deliverables.map((d, i) => (i === dIndex ? { ...d, title: value } : d)),
    });
  }

  function removeDeliverable(index, dIndex) {
    updateTier(index, {
      deliverables: tiers[index].deliverables.filter((_, i) => i !== dIndex),
    });
  }

  // --- media upload -------------------------------------------------------------
  async function handleMediaSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!MEDIA_TYPES.includes(file.type)) {
      showToast({ type: 'error', message: 'Please choose a PDF, JPEG, or PNG file.' });
      return;
    }
    if (file.size > MEDIA_MAX_BYTES) {
      showToast({ type: 'error', message: 'File must be 10MB or smaller.' });
      return;
    }
    setUploadingMedia(true);
    try {
      const ext = ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/gi, '') || 'jpg');
      const storagePath = `services/${Date.now().toString(36)}-${ext}`;
      const { error: upErr } = await supabase.storage
        .from(MEDIA_BUCKET)
        .upload(storagePath, file, { upsert: true, cacheControl: '3600' });
      if (upErr) {
        showToast({ type: 'error', message: upErr.message || 'Could not upload media.' });
        return;
      }
      const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(storagePath);
      setMediaUrl(data.publicUrl);
      setMediaPath(storagePath);
      showToast({ type: 'success', message: 'Media uploaded' });
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleMediaRemove() {
    if (mediaPath) {
      const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([mediaPath]);
      if (error) {
        showToast({ type: 'error', message: error.message || 'Could not remove media.' });
        return;
      }
    }
    setMediaUrl('');
    setMediaPath('');
    showToast({ type: 'success', message: 'Media removed' });
  }

  // --- save ---------------------------------------------------------------------
  async function handleSubmit() {
    const missing = validate();
    if (missing.length > 0) {
      showToast({ type: 'error', message: `Please fill in: ${missing.join(', ')}` });
      return;
    }

    setSubmitting(true);
    const first = tiers[0];
    const payload = {
      title: title.trim(),
      description: sanitizeRichText(description),
      // Legacy columns kept in sync with the first/default tier so the admin
      // list page and catalogue keep working unchanged.
      price: Number(first.price),
      working_days: Number(first.days),
      deliverables: first.deliverables.filter((d) => d.title.trim()).length,
      status: active ? 'active' : 'inactive',
      media_url: mediaUrl || null,
    };

    try {
      let savedId = serviceId;
      if (serviceId) {
        const { error } = await supabase.from('services').update(payload).eq('id', serviceId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('services')
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        savedId = data.id;
      }

      // Replace all tiers + deliverables (delete cascades to deliverables).
      const { error: delErr } = await supabase
        .from('service_tiers')
        .delete()
        .eq('service_id', savedId);
      if (delErr) throw delErr;

      for (let i = 0; i < tiers.length; i += 1) {
        const t = tiers[i];
        const { data: tierRow, error: tierErr } = await supabase
          .from('service_tiers')
          .insert({
            service_id: savedId,
            name: t.name.trim(),
            price: Number(t.price),
            working_days: Number(t.days),
            sort_order: i,
          })
          .select('id')
          .single();
        if (tierErr) throw tierErr;
        const items = t.deliverables.map((d) => d.title.trim()).filter(Boolean);
        for (let j = 0; j < items.length; j += 1) {
          const { error: dErr } = await supabase
            .from('service_tier_deliverables')
            .insert({ tier_id: tierRow.id, title: items[j], sort_order: j });
          if (dErr) throw dErr;
        }
      }

      showToast({
        type: 'success',
        message: serviceId ? 'Service updated' : 'Service created',
      });
      navigate('/admin/services');
    } catch (err) {
      showToast({ type: 'error', message: err?.message || 'Could not save the service.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="font-['Inter'] font-semibold text-[36px] leading-[40px] tracking-[-0.9px] text-[#0B1C30]">Services Management</h1>
      <p className="text-body mt-1 mb-6">Add / Edit services, tiers, add-ons</p>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-6 space-y-6">
        <h4 className="font-['Inter'] sf-section-title">
          General Information
        </h4>

        <div>
          <label
            htmlFor="service-title"
            className="block font-['Inter'] mb-2 sf-label"
          >
            Service Title
          </label>
          <input
            id="service-title"
            placeholder="e.g. Comprehensive Energy Audit"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-line px-4 py-3 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="service-description"
            className="block font-['Inter'] mb-2 sf-label"
          >
            Description
          </label>
          <div className="border border-line rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 bg-surface px-4 py-2 border-b border-line">
              <button
                type="button"
                aria-label="Bold"
                title="Bold"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyBold}
                className="p-1 -m-1 rounded-md hover:bg-navy-900/5 cursor-pointer"
              >
                <Bold size={14} className="text-body" />
              </button>
              <button
                type="button"
                aria-label="Italic"
                title="Italic"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyItalic}
                className="p-1 -m-1 rounded-md hover:bg-navy-900/5 cursor-pointer"
              >
                <Italic size={14} className="text-body" />
              </button>
              <button
                type="button"
                aria-label="Bullet list"
                title="Bullet list"
                onMouseDown={(e) => e.preventDefault()}
                onClick={applyList}
                className="p-1 -m-1 rounded-md hover:bg-navy-900/5 cursor-pointer"
              >
                <List size={14} className="text-body" />
              </button>
            </div>
            <textarea
              id="service-description"
              ref={descriptionRef}
              placeholder="Describe the service..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full px-4 py-3 text-sm focus:outline-none resize-none"
            />
          </div>
        </div>

        <div>
          <label
            className="block font-['Inter'] mb-2 sf-label"
          >
            Media
          </label>
          <input
            ref={mediaFileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            className="hidden"
            onChange={handleMediaSelect}
          />
          {mediaUrl ? (
            <div className="border border-line rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4">
              <img
                src={mediaUrl}
                alt="Service media preview"
                className="w-24 h-24 rounded-lg object-cover border border-line"
              />
              <div className="flex-1 text-center sm:text-left">
                <p className="font-semibold text-ink text-sm">Service media uploaded</p>
                <p className="text-xs text-muted mt-1">PDF, JPEG, or PNG up to 10MB</p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="sf-mini-btn"
                  disabled={uploadingMedia}
                  onClick={() => mediaFileRef.current?.click()}
                >
                  {uploadingMedia ? 'Uploading…' : 'Replace'}
                </Button>
                <button
                  type="button"
                  aria-label="Remove media"
                  onClick={handleMediaRemove}
                  className="p-2 rounded-full hover:bg-surface text-muted hover:text-danger cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload service media"
              onClick={() => mediaFileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  mediaFileRef.current?.click();
                }
              }}
              className="border-2 border-dashed border-line rounded-xl py-10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-surface"
            >
              <Upload size={22} className="text-ink mb-3" />
              <p className="font-semibold text-ink text-sm">
                {uploadingMedia ? 'Uploading…' : 'Click to upload service media'}
              </p>
              <p className="text-xs text-muted mt-1">PDF, JPEG, or PNG up to 10MB</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label
              className="block font-['Inter'] sf-label"
            >
              Pricing Tiers
            </label>
            <Button
              variant="navy"
              icon={Plus}
              className="sf-mini-btn sf-btn-add-tier"
              onClick={addTier}
            >
              Add Tier
            </Button>
          </div>
          {tiers.map((tier, i) => (
            <div key={tier.key} className="border border-line rounded-xl p-4 space-y-4 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-muted">TIER {i + 1}</span>
                {tiers.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Remove tier ${i + 1}`}
                    onClick={() => removeTier(i)}
                    className="p-1 -m-1 rounded-md text-muted hover:text-danger hover:bg-surface cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={`tier-${tier.key}-name`} className="block text-[11px] font-semibold text-muted mb-1.5">TIER NAME</label>
                  <input
                    id={`tier-${tier.key}-name`}
                    placeholder="e.g. Standard"
                    value={tier.name}
                    onChange={(e) => updateTier(i, { name: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`tier-${tier.key}-price`} className="block text-[11px] font-semibold text-muted mb-1.5">PRICE</label>
                  <input
                    id={`tier-${tier.key}-price`}
                    type="number"
                    min={0}
                    value={tier.price}
                    onChange={(e) => updateTier(i, { price: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor={`tier-${tier.key}-days`} className="block text-[11px] font-semibold text-muted mb-1.5">DAYS TO COMPLETE</label>
                  <input
                    id={`tier-${tier.key}-days`}
                    type="number"
                    min={0}
                    value={tier.days}
                    onChange={(e) => updateTier(i, { days: e.target.value })}
                    className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-muted mb-2">DELIVERABLES</p>
                {tier.deliverables.length === 0 ? (
                  <p className="text-xs text-muted mb-2">No deliverables yet — add the first one below.</p>
                ) : (
                  <div className="space-y-2 mb-2">
                    {tier.deliverables.map((d, dIndex) => (
                      <div key={d.key} className="flex items-center gap-2">
                        <input
                          placeholder="e.g. On-site survey report"
                          value={d.title}
                          onChange={(e) => updateDeliverable(i, dIndex, e.target.value)}
                          className="w-full rounded-lg border border-line px-3 py-2.5 text-sm"
                        />
                        <button
                          type="button"
                          aria-label="Remove deliverable"
                          onClick={() => removeDeliverable(i, dIndex)}
                          className="p-2 shrink-0 rounded-md text-muted hover:text-danger hover:bg-surface cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  variant="navy"
                  icon={Plus}
                  className="sf-mini-btn sf-btn-add-deliverable"
                  onClick={() => addDeliverable(i)}
                >
                  Add Deliverable
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line/60 shadow-sm p-5 sm:p-6 mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-['Inter'] sf-service-active-title">
            Service Active
          </h4>
          <p className="text-sm text-body mt-1">Make this service immediately available for booking upon publishing.</p>
        </div>
        <div
          role="switch"
          aria-checked={active}
          aria-label="Toggle service active status"
          onClick={() => setActive((v) => !v)}
          className={`w-11 h-6 rounded-full flex items-center px-0.5 shrink-0 cursor-pointer transition-colors ${active ? 'bg-navy-900 justify-end' : 'bg-slate-300 justify-start'}`}
        >
          <span className="w-5 h-5 rounded-full bg-white block" />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 mt-6">
        <Button
          variant="green"
          className="sf-save-btn"
          disabled={submitting || loading}
          onClick={handleSubmit}
        >
          Save
        </Button>
      </div>
    </div>
  );
}