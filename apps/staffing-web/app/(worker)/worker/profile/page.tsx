'use client';

import { useEffect, useState } from 'react';
import { meRequest } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';
import { WorkerProfileForm } from '@/components/worker/worker-profile-form';

type WorkerProfile = {
  id: string;
  role: string;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  maxDistanceMiles?: number | null;
  openShiftAlertsEnabled?: boolean | null;
  openShiftAlertRadiusMiles?: number | null;
  hourlyRateCents?: number | null;
  bio?: string | null;
  onboardingStatus?: string | null;
  approvedByWezen: boolean;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  phone?: string | null;
};

export default function WorkerProfilePage() {
  const [profile, setProfile] = useState<WorkerProfile | null>(null);
  const [message, setMessage] = useState('Loading profile...');

  useEffect(() => {
    async function load() {
      try {
        const me = await meRequest();
        const professionalId = me.data.professionalId ?? null;

        if (!professionalId) {
          setMessage('You must be signed in as a professional.');
          return;
        }

        const res = await apiFetch<{ data: WorkerProfile }>(
          `/api/worker/profile?professionalId=${professionalId}`
        );

        setProfile(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load profile');
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Profile
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Manage your worker profile and onboarding details
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Keep your professional information current so facilities and internal reviewers
          can approve you faster.
        </p>
      </div>

       <div className="flex justify-end">
  <a
    href="https://payroll.wezenstaffing.com"
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
  >
    Payroll Portal ↗
  </a>
</div>

      {message && !profile ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {profile ? <WorkerProfileForm profile={profile} /> : null}
    </div>
  );
}
