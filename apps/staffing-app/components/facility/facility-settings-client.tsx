'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Settings = {
  name: string;
  facilityType?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  defaultAmStartTimeLabel?: string | null;
  defaultAmEndTimeLabel?: string | null;
  defaultPmStartTimeLabel?: string | null;
  defaultPmEndTimeLabel?: string | null;
  defaultNocStartTimeLabel?: string | null;
  defaultNocEndTimeLabel?: string | null;
};

export function FacilitySettingsClient() {
  const [name, setName] = useState('');
  const [facilityType, setFacilityType] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [amStart, setAmStart] = useState('7:00 AM');
  const [amEnd, setAmEnd] = useState('3:30 PM');
  const [pmStart, setPmStart] = useState('3:00 PM');
  const [pmEnd, setPmEnd] = useState('11:30 PM');
  const [nocStart, setNocStart] = useState('11:00 PM');
  const [nocEnd, setNocEnd] = useState('7:30 AM');
  const [message, setMessage] = useState('Loading settings...');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await apiFetch<{ data: Settings }>('/api/facility/settings');
    const data = res.data;
    setName(data.name || '');
    setFacilityType(data.facilityType || '');
    setCity(data.city || '');
    setState(data.state || '');
    setZipCode(data.zipCode || '');
    setContactEmail(data.contactEmail || '');
    setContactPhone(data.contactPhone || '');
    setAmStart(data.defaultAmStartTimeLabel || '7:00 AM');
    setAmEnd(data.defaultAmEndTimeLabel || '3:30 PM');
    setPmStart(data.defaultPmStartTimeLabel || '3:00 PM');
    setPmEnd(data.defaultPmEndTimeLabel || '11:30 PM');
    setNocStart(data.defaultNocStartTimeLabel || '11:00 PM');
    setNocEnd(data.defaultNocEndTimeLabel || '7:30 AM');
    setMessage('');
  }

  async function save() {
    try {
      setBusy(true);
      setMessage('');
      await apiFetch('/api/facility/settings', {
        method: 'PUT',
        body: JSON.stringify({
          name,
          facilityType,
          city,
          state,
          zipCode,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          defaultAmStartTimeLabel: amStart,
          defaultAmEndTimeLabel: amEnd,
          defaultPmStartTimeLabel: pmStart,
          defaultPmEndTimeLabel: pmEnd,
          defaultNocStartTimeLabel: nocStart,
          defaultNocEndTimeLabel: nocEnd,
        }),
      });
      setMessage('Settings saved.');
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  }


  async function deleteAccount() {
    const confirmed = window.confirm(
      'Delete this facility admin account? This will deactivate your login and remove your active app access.'
    );

    if (!confirmed) return;

    const finalConfirm = window.confirm(
      'This action cannot be undone. Continue deleting this account?'
    );

    if (!finalConfirm) return;

    try {
      setBusy(true);
      setMessage('');

      await apiFetch('/api/account', {
        method: 'DELETE',
      });

      setMessage('Account deleted.');
      window.location.href = '/login/index.html';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load settings'));
  }, []);

  return (
    <div className="grid gap-4">
      {message ? <div className="rounded-3xl bg-cyan-50 p-4 text-sm font-bold text-cyan-900 ring-1 ring-cyan-200">{message}</div> : null}

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-extrabold text-slate-950">Facility Info</h2>
        <div className="mt-4 grid gap-3">
          <Input label="Facility name" value={name} onChange={setName} />
          <Input label="Facility type" value={facilityType} onChange={setFacilityType} />
          <Input label="City" value={city} onChange={setCity} />
          <Input label="State" value={state} onChange={setState} />
          <Input label="Zip" value={zipCode} onChange={setZipCode} />
          <Input label="Contact email" value={contactEmail} onChange={setContactEmail} />
          <Input label="Contact phone" value={contactPhone} onChange={setContactPhone} />
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-extrabold text-slate-950">Default Shift Times</h2>
        <TimePair title="AM" start={amStart} end={amEnd} setStart={setAmStart} setEnd={setAmEnd} />
        <TimePair title="PM" start={pmStart} end={pmEnd} setStart={setPmStart} setEnd={setPmEnd} />
        <TimePair title="NOC" start={nocStart} end={nocEnd} setStart={setNocStart} setEnd={setNocEnd} />
      </section>

      <button onClick={save} disabled={busy} className="rounded-2xl bg-cyan-600 px-4 py-4 text-sm font-extrabold text-white disabled:opacity-60">
        {busy ? 'Saving...' : 'Save Settings'}
      </button>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-rose-200">
        <h2 className="text-lg font-extrabold text-rose-700">Delete Account</h2>
        <p className="mt-2 text-sm text-slate-600">
          Deleting this account will deactivate your facility admin login and remove active app access.
        </p>
        <button
          type="button"
          onClick={deleteAccount}
          disabled={busy}
          className="mt-4 w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          Delete Facility Admin Account
        </button>
      </section>
    </div>
  );
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-bold text-slate-700">
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-950" />
    </label>
  );
}

function TimePair({ title, start, end, setStart, setEnd }: { title: string; start: string; end: string; setStart: (v: string) => void; setEnd: (v: string) => void }) {
  return (
    <div className="mt-4 rounded-2xl bg-slate-50 p-4">
      <div className="font-extrabold text-slate-950">{title}</div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <input value={start} onChange={(e) => setStart(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold" />
        <input value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm font-semibold" />
      </div>
    </div>
  );
}
