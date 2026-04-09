'use client';

import { useEffect, useState } from 'react';
import { meRequest } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { TextInput } from '@/components/ui/text-input';
import { FormField } from '@/components/ui/form-field';

const API_BASE_URL = 'http://localhost:4001';

type Agreement = {
  id: string;
  agreementType: string;
  status: string;
  signedAt?: string | null;
  signerName?: string | null;
  signerEmail?: string | null;
  createdAt: string;
};

type MeData = {
  userId: string;
  email: string;
  role: 'FACILITY_ADMIN' | 'PROFESSIONAL' | 'INTERNAL_ADMIN';
  firstName?: string | null;
  lastName?: string | null;
  professionalId?: string | null;
};

export default function WorkerAgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [me, setMe] = useState<MeData | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [message, setMessage] = useState('Loading agreement...');
  const [submitting, setSubmitting] = useState(false);

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

        setSignerName(
          `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim()
        );
        setSignerEmail(currentUser.email || '');

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

  async function signAgreement() {
    try {
      if (!me?.professionalId) {
        throw new Error('You must be signed in as a professional.');
      }

      setSubmitting(true);
      setMessage('');

      const res = await fetch(`${API_BASE_URL}/api/worker/agreements/sign`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agreementType: 'ICA',
          signerName,
          signerEmail,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Failed to sign agreement');
      }

      const refreshed = await apiFetch<{ data: Agreement[] }>(
        `/api/worker/agreements`
      );

      setAgreements(refreshed.data);
      setMessage('Independent Contractor Agreement signed successfully.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to sign agreement');
    } finally {
      setSubmitting(false);
    }
  }

  const agreement = agreements[0] || null;

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
          Review and acknowledge your agreement as part of the onboarding process.
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
              documents, and your acknowledgment of the terms required to accept
              shifts through Wezen Staffing.
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <FormField label="Signer name" htmlFor="signerName">
                <TextInput
                  id="signerName"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  disabled={agreement.status === 'SIGNED'}
                />
              </FormField>

              <FormField label="Signer email" htmlFor="signerEmail">
                <TextInput
                  id="signerEmail"
                  type="email"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                  disabled={agreement.status === 'SIGNED'}
                />
              </FormField>
            </div>

            {message ? (
              <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                {message}
              </div>
            ) : null}

            <div className="mt-6">
              <button
                type="button"
                onClick={signAgreement}
                disabled={submitting || agreement.status === 'SIGNED'}
                className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {agreement.status === 'SIGNED'
                  ? 'Agreement Signed'
                  : submitting
                    ? 'Signing...'
                    : 'Sign Agreement'}
              </button>
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
                {agreement.signedAt
                  ? `Signed on ${new Date(agreement.signedAt).toLocaleString()}`
                  : 'Signature pending'}
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
