import { useState, useEffect } from 'react';
import { admin } from '../../api';

export default function AdminRateLimits() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    admin.getSettings().then((data) => {
      setSettings(data);
      setForm(data);
    }).catch(() => {});
  }, []);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await admin.updateSettings(form);
      setSettings(updated);
      setForm(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = settings && JSON.stringify(form) !== JSON.stringify(settings);

  if (!settings) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-xl font-bold">Rate Limits & Settings</h1>
        <div className="glass-strong rounded-2xl p-6">
          <p className="text-sm text-[var(--color-muted-2)]">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-bold">Rate Limits & Settings</h1>

      <div className="glass-strong rounded-2xl p-6 space-y-6">
        {/* Rate limits */}
        <div>
          <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-4 font-medium">Rate Limits</h3>
          <div className="space-y-4">
            <Field
              label="Uploads per IP per 24h"
              type="number"
              value={form.rate_limit_per_ip ?? 20}
              onChange={(v) => handleChange('rate_limit_per_ip', parseInt(v) || 0)}
              hint="Set to 0 to disable rate limiting"
            />
            <Field
              label="Max concurrent jobs"
              type="number"
              value={form.max_concurrent_jobs ?? 1}
              onChange={(v) => handleChange('max_concurrent_jobs', parseInt(v) || 1)}
              hint="Maximum jobs processing simultaneously"
            />
          </div>
        </div>

        {/* File limits */}
        <div>
          <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-4 font-medium">Upload Limits</h3>
          <div className="space-y-4">
            <Field
              label="Max file size (MB)"
              type="number"
              value={form.max_upload_mb ?? 10}
              onChange={(v) => handleChange('max_upload_mb', parseInt(v) || 1)}
            />
            <Field
              label="Max image dimension (px)"
              type="number"
              value={form.max_image_dimension ?? 4096}
              onChange={(v) => handleChange('max_image_dimension', parseInt(v) || 512)}
            />
          </div>
        </div>

        {/* Job settings */}
        <div>
          <h3 className="text-xs text-[var(--color-muted)] uppercase tracking-widest mb-4 font-medium">Job Settings</h3>
          <div className="space-y-4">
            <Field
              label="Job expiry (hours)"
              type="number"
              value={form.job_expiry_hours ?? 72}
              onChange={(v) => handleChange('job_expiry_hours', parseInt(v) || 1)}
              hint="Jobs older than this are auto-cleaned"
            />
            <Field
              label="Job timeout (seconds)"
              type="number"
              value={form.job_timeout_seconds ?? 600}
              onChange={(v) => handleChange('job_timeout_seconds', parseInt(v) || 60)}
              hint="Max time before a processing job is marked failed"
            />
          </div>
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={loading || !hasChanges}
            className="px-5 py-2.5 rounded-xl text-sm font-medium btn-accent text-white disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          {saved && (
            <span className="text-xs text-[var(--color-success)]">Settings saved</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, hint }) {
  return (
    <div>
      <label className="block text-sm text-[var(--color-muted)] mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-mono w-32 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
      />
      {hint && <p className="text-[10px] text-[var(--color-muted-2)] mt-1">{hint}</p>}
    </div>
  );
}
