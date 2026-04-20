'use client';

import { useEffect, useState } from 'react';
import { meRequest, type AuthMeResponse } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { AGREEMENT_URLS, type AgreementRole } from '@/lib/agreements';

type Agreement = {
  id: string;
  agreementType: string;
  status: string;
  signedAt?: string | null;
  createdAt: string;
};

type MeData = AuthMeResponse['data'];

export default function WorkerAgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [me, setMe] = useState<AuthMeResponse['data'] | null>(null);
  const [workerRole, setWorkerRole] = useState<AgreementRole | null>(null);
  const [message, setMessage] = useState('Loading agreement...');
  const [regularRateCents, setRegularRateCents] = useState<number | null>(null);
  const [overtimeRateCents, setOvertimeRateCents] = useState<number | null>(null);
  const [doubleRateCents, setDoubleRateCents] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
          const meRes = await meRequest();
const currentUser = meRes.data;
setMe(currentUser);

if (!currentUser.professionalId) {
	  setMessage('You must be signed in as a professional.');
          return;
        }

	const dashboardRes = await apiFetch<{ data: { profile: { role: AgreementRole } } }>(
  '/api/worker/dashboard'
);
setWorkerRole(dashboardRes.data.profile.role);

const profileRes = await apiFetch<{
  data: {
    hourlyRateCents?: number | null;
    regularPayRateCents?: number | null;
    overtimePayRateCents?: number | null;
    doublePayRateCents?: number | null;
  };
}>(`/api/worker/profile?professionalId=${currentUser.professionalId}`);


setRegularRateCents(profileRes.data.regularPayRateCents ?? null);
setOvertimeRateCents(profileRes.data.overtimePayRateCents ?? null);
setDoubleRateCents(profileRes.data.doublePayRateCents ?? null)
;
        const res = await apiFetch<{ data: Agreement[] }>(
          `/api/worker/agreements`
        );

        setAgreements(res.data);
        setMessage('');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Failed to load agreement');
      }
    }

    load();
  }, []);


  const agreement = agreements[0] || null;

  const agreementPdfUrl = workerRole ? AGREEMENT_URLS[workerRole] : null;

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Agreements
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Independent Contractor Agreement
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
        Review your agreement status and compensation summary as part of the onboarding process.
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

      {message && !agreement ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {agreement ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                Independent Contractor Agreement
              </h2>
              <StatusBadge
                label={agreement.status}
                tone={agreement.status === 'SIGNED' ? 'success' : 'warning'}
              />
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-600">
            This agreement confirms your status as an independent contractor,
your responsibility for maintaining valid credentials and compliance
documents, and the terms required to accept shifts through Wezen Staffing.
	    </p>

<div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
    Compensation Summary
  </div>

  <div className="mt-4 grid gap-3 md:grid-cols-3">
    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Regular Pay Rate
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        {regularRateCents != null
          ? `$${(regularRateCents / 100).toFixed(2)}/hr`
          : 'Not set yet'}
      </div>
    </div>

    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Overtime Pay Rate
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        {overtimeRateCents != null
          ? `$${(overtimeRateCents / 100).toFixed(2)}/hr`
          : 'Not set yet'}
      </div>
    </div>

    <div className="rounded-2xl bg-slate-50 px-4 py-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Double-Time Pay Rate
      </div>
      <div className="mt-1 text-sm font-medium text-slate-900">
        {doubleRateCents != null
          ? `$${(doubleRateCents / 100).toFixed(2)}/hr`
          : 'Not set yet'}
      </div>
    </div>
  </div>

  <div className="mt-3 text-xs text-slate-500">
    These compensation details apply to your Independent Contractor Agreement and assignment approvals.
  </div>
</div>

	    {agreementPdfUrl ? (
  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
    <iframe
      src={agreementPdfUrl}
      title="Independent Contractor Agreement"
      className="h-[700px] w-full bg-white"
    />
  </div>
) : (
  <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    Agreement PDF is not available for your role yet.
  </div>
)}


            {message ? (
              <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                {message}
              </div>
            ) : null}
	
		<div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
  <div className="font-semibold">
    Independent Contractor Agreement must be completed before shift access is enabled.
  </div>
  <div className="mt-2">
    Wezen Staffing will send your ICA by Adobe eSign. Once it has been signed and confirmed by our team,
    your account will be cleared to request shifts.
  </div>
</div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Agreement status
              </div>
              <div className="mt-3 text-2xl font-bold tracking-tight">
                {agreement.status}
              </div>
              <div className="mt-2 text-cyan-50">
  {agreement.status === 'SIGNED'
    ? `Signed on ${new Date(agreement.signedAt || '').toLocaleString()}`
    : 'Pending Adobe eSign completion'}
</div> 
	   </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold tracking-tight text-slate-950">
                What this does
              </h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  1. Confirms contractor acknowledgment.
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  2. Advances your onboarding process.
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  3. Prepares your account for final approval review.
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
