'use client';

import { useEffect, useState } from 'react';
import { apiFetch, formatApiErrorText } from '@/lib/api-client';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { FormField } from '@/components/ui/form-field';
import { TextInput } from '@/components/ui/text-input';

type AdminSettings = {
  userId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  notificationEmail?: string | null;
  notifyNewWorkerSignup: boolean;
  notifyDocumentUploads: boolean;
  notifyAgreementSigned: boolean;
  notifyWorkerReadyForReview: boolean;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [message, setMessage] = useState('Loading settings...');
  const [busy, setBusy] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [notifyNewWorkerSignup, setNotifyNewWorkerSignup] = useState(true);
  const [notifyDocumentUploads, setNotifyDocumentUploads] = useState(true);
  const [notifyAgreementSigned, setNotifyAgreementSigned] = useState(true);
  const [notifyWorkerReadyForReview, setNotifyWorkerReadyForReview] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  async function load() {
    const res = await apiFetch<{ data: AdminSettings }>('/api/admin/settings');
    const data = res.data;

    setSettings(data);
    setFirstName(data.firstName || '');
    setLastName(data.lastName || '');
    setNotificationEmail(data.notificationEmail || '');
    setNotifyNewWorkerSignup(data.notifyNewWorkerSignup);
    setNotifyDocumentUploads(data.notifyDocumentUploads);
    setNotifyAgreementSigned(data.notifyAgreementSigned);
    setNotifyWorkerReadyForReview(data.notifyWorkerReadyForReview);
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load settings');
      }
    }

    init();
  }, []);

  async function saveSettings() {
    try {
      setBusy(true);
      setMessage('');

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/settings`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          notificationEmail,
          notifyNewWorkerSignup,
          notifyDocumentUploads,
          notifyAgreementSigned,
          notifyWorkerReadyForReview,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Failed to save settings'));
      }

      await load();
      setMessage('Admin settings saved successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    try {
      setBusy(true);
      setMessage('');

      if (!currentPassword.trim()) {
        throw new Error('Current password is required.');
      }

      if (newPassword.trim().length < 8) {
        throw new Error('New password must be at least 8 characters.');
      }

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/admin/change-password`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const text = await res.text();
      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Failed to change password'));
      }

      setCurrentPassword('');
      setNewPassword('');
      setMessage('Password changed successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to change password');
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return (
      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
        {message}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Admin Settings
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Profile, password, and notifications
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Manage your internal admin profile and choose where workflow alerts should be sent.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Profile and notification settings
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormField label="Login email" htmlFor="email">
            <TextInput id="email" value={settings.email} disabled />
          </FormField>

          <FormField label="Notification email" htmlFor="notificationEmail">
            <TextInput
              id="notificationEmail"
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="Where admin alerts should be sent"
            />
          </FormField>

          <FormField label="First name" htmlFor="firstName">
            <TextInput
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </FormField>

          <FormField label="Last name" htmlFor="lastName">
            <TextInput
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </FormField>
        </div>

        <div className="mt-6 grid gap-3">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifyNewWorkerSignup}
              onChange={(e) => setNotifyNewWorkerSignup(e.target.checked)}
            />
            Notify me when a new worker signs up
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifyDocumentUploads}
              onChange={(e) => setNotifyDocumentUploads(e.target.checked)}
            />
            Notify me when a worker uploads documents
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifyAgreementSigned}
              onChange={(e) => setNotifyAgreementSigned(e.target.checked)}
            />
            Notify me when a worker signs the ICA
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={notifyWorkerReadyForReview}
              onChange={(e) => setNotifyWorkerReadyForReview(e.target.checked)}
            />
            Notify me when a worker is ready for final review
          </label>
        </div>

        <div className="mt-6">
          <button
            onClick={saveSettings}
            disabled={busy}
            className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
          >
            Save Settings
          </button>
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Change password
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <FormField label="Current password" htmlFor="currentPassword">
            <TextInput
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </FormField>

          <FormField label="New password" htmlFor="newPassword">
            <TextInput
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </FormField>
        </div>

        <div className="mt-6">
          <button
            onClick={changePassword}
            disabled={busy}
            className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
          >
            Update Password
          </button>
        </div>
      </section>
    </div>
  );
}
