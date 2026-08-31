import { useState } from 'react';
import Modal from './ui/Modal';
import Button from './Button';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabaseClient';
import '../styles/NewProjectModal.css';

/**
 * Create New Project modal — the single "New Project" flow used by both the
 * Sidebar button and MyProjects.jsx.
 *
 * Collects the minimum fields the existing `projects` table actually needs
 * (only `name` is NOT NULL beyond `id`; the rest of the row is filled by DB
 * defaults or left NULL, exactly as the table allows). On submit it inserts a
 * real row scoped to the logged-in client (client_id = auth.uid()), respecting
 * the client INSERT policy, then:
 *   - shows a success toast (the real insert replaces the old fake one)
 *   - dispatches a window event so open pages (MyProjects / ClientDashboard)
 *     refetch and the new project appears immediately
 */
export default function NewProjectModal({ isOpen, onClose, onCreated }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ name: '', line1: '', city: '', postcode: '', service: '' });
  const [submitting, setSubmitting] = useState(false);

  function setField(field) {
    return (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  function handleClose() {
    if (submitting) return;
    setForm({ name: '', line1: '', city: '', postcode: '', service: '' });
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to be signed in to create a project.');

      // `id` is a NOT NULL text column with no DB default, so generate one;
      // every other non-submitted column has a DB default (status/progress/
      // has_issues/created_at/updated_at) or is nullable.
      const { error } = await supabase.from('projects').insert({
        id: `PRJ-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        name: form.name.trim(),
        address_line1: form.line1.trim() || null,
        address_city: form.city.trim() || null,
        address_postcode: form.postcode.trim() || null,
        service: form.service.trim() || null,
        client_id: user.id,
      });
      if (error) throw error;

      showToast({ type: 'success', message: 'New project created' });
      onCreated?.();
      window.dispatchEvent(new Event('rp:project-created'));
      handleClose();
    } catch (err) {
      showToast({ type: 'error', message: err.message || 'Could not create project.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Project">
      <p className="npm-hint">
        Tell us where the retrofit is happening. A new active project will be
        added to your dashboard.
      </p>
      <form onSubmit={handleSubmit} className="npm-form" noValidate>
        <div className="npm-field">
          <label className="npm-label" htmlFor="npm-name">
            Project Name <span className="npm-required">*</span>
          </label>
          <input
            id="npm-name"
            className="npm-input"
            type="text"
            placeholder="e.g. Hove House Retrofit"
            value={form.name}
            onChange={setField('name')}
            autoFocus
          />
        </div>

        <div className="npm-field">
          <label className="npm-label" htmlFor="npm-line1">
            Address Line 1
          </label>
          <input
            id="npm-line1"
            className="npm-input"
            type="text"
            placeholder="e.g. 12-14 Kingsway Court"
            value={form.line1}
            onChange={setField('line1')}
          />
        </div>

        <div className="npm-row">
          <div className="npm-field">
            <label className="npm-label" htmlFor="npm-city">
              City
            </label>
            <input
              id="npm-city"
              className="npm-input"
              type="text"
              placeholder="e.g. Hove"
              value={form.city}
              onChange={setField('city')}
            />
          </div>
          <div className="npm-field">
            <label className="npm-label" htmlFor="npm-postcode">
              Postcode
            </label>
            <input
              id="npm-postcode"
              className="npm-input"
              type="text"
              placeholder="e.g. BN3 2LP"
              value={form.postcode}
              onChange={setField('postcode')}
            />
          </div>
        </div>

        <div className="npm-field">
          <label className="npm-label" htmlFor="npm-service">
            Service
          </label>
          <input
            id="npm-service"
            className="npm-input"
            type="text"
            placeholder="e.g. HVAC Retrofit"
            value={form.service}
            onChange={setField('service')}
          />
        </div>

        <div className="npm-actions">
          <Button
            type="button"
            variant="outline"
            className="npm-btn"
            disabled={submitting}
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gradient"
            className="npm-btn npm-btn-submit"
            disabled={submitting || !form.name.trim()}
          >
            {submitting ? 'Creating...' : 'Create Project'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}