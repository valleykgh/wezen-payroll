'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Profile = {
  id: string;
  openShiftAlertsEnabled?: boolean | null;
  openShiftAlertRadiusMiles?: number | null;
};

export function WorkerNotificationSettingsClient() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [radius, setRadius] = useState('50');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadProfile() {
    try {
      const me = await apiFetch<{ data: { professionalId?: string | null } }>('/api/auth/me');
      const professionalId = me.data.professionalId;

      if (!professionalId) return;

      const res = await apiFetch<{ data: Profile }>(`/api/worker/profile?professionalId=${professionalId}`);
      setProfile(res.data);
      setEnabled(Boolean(res.data.openShiftAlertsEnabled));
      setRadius(String(res.data.openShiftAlertRadiusMiles ?? 50));
    } catch {
      setMessage('Could not load notification settings.');
    }
  }

  async function saveSettings() {
    if (!profile?.id) return;

    setBusy(true);
    setMessage('');

    try {
      await apiFetch('/api/worker/notification-settings', {
        method: 'PUT',
        body: JSON.stringify({
          openShiftAlertsEnabled: enabled,
          openShiftAlertRadiusMiles: Number(radius || 50),
        }),
      });

      setMessage('Notification settings saved.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  return (
    <div className="rounded-3xl border-2 border-cyan-200 bg-cyan-50 p-5 shadow-sm">
      <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-cyan-800">
        Shift Alerts
      </p>
      <h2 className="mt-2 text-xl font-extrabold text-slate-950">
        Notify me when shifts open nearby
      </h2>
      <p className="mt-2 text-sm font-semibold text-cyan-900">
        Get in-app alerts when a matching open shift is posted within your selected radius.
      </p>

      <label className="mt-5 flex items-start gap-3 rounded-2xl bg-white p-4 text-sm font-bold text-slate-950">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 h-5 w-5"
        />
        Enable nearby shift alerts
      </label>

      <label className="mt-4 block text-sm font-bold text-slate-900">
        Alert radius in miles
        <input
          type="number"
          min={1}
          value={radius}
          onChange={(e) => setRadius(e.target.value)}
          className="mt-2 w-full rounded-2xl border border-cyan-200 bg-white px-4 py-4 text-base font-bold"
        />
      </label>

      <button
        type="button"
        onClick={saveSettings}
        disabled={busy}
        className="mt-4 w-full rounded-2xl bg-cyan-600 px-5 py-4 text-base font-extrabold text-white disabled:opacity-60"
      >
        {busy ? 'Saving...' : 'Save Notification Settings'}
      </button>

      {message ? (
        <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-center text-sm font-bold text-slate-900">
          {message}
        </div>
      ) : null}
    </div>
  );
}
