'use client';

import { useEffect, useRef, useState } from 'react';
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
  consentText?: string | null;
  downloadAvailable?: boolean;
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
  const [signerName, setSignerName] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [signing, setSigning] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    async function load() {
      try {
          const meRes = await meRequest();
const currentUser = meRes.data;
setMe(currentUser);
setSignerName(`${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim());

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

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
  }

  async function signAgreement() {
    if (!agreement || !me || !canvasRef.current) return;
    try {
      setSigning(true);
      setMessage('');
      const result = await apiFetch<{ data: Agreement }>('/api/worker/agreements/sign', {
        method: 'POST',
        body: JSON.stringify({ agreementType: 'ICA', signerName, signerEmail: me.email, signatureDataUrl: canvasRef.current.toDataURL('image/png'), consentAccepted }),
      });
      setAgreements([result.data]);
      setMessage('Your ICA has been signed. A copy was saved securely and emailed to you.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to sign agreement');
    } finally {
      setSigning(false);
    }
  }

  async function downloadSignedAgreement() {
    if (!agreement) return;
    const response = await fetch(`${STAFFING_API_BASE_URL}/api/worker/agreements/${agreement.id}/download`, { credentials: 'include' });
    if (!response.ok) { setMessage('The signed agreement could not be downloaded.'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'Wezen-signed-ICA.pdf'; anchor.click(); URL.revokeObjectURL(url);
  }

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

            {agreement.status === 'SENT' ? (
              <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <h3 className="text-lg font-bold text-slate-950">Sign your agreement</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">Review the full agreement above. Your saved compensation rates are part of the issued agreement.</p>
                <label className="mt-4 block text-sm font-semibold text-slate-800">Legal name</label>
                <input value={signerName} onChange={(event) => setSignerName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" />
                <label className="mt-4 block text-sm font-semibold text-slate-800">Draw your signature</label>
                <canvas ref={canvasRef} width={700} height={180}
                  onPointerDown={(event) => { drawingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); const point = pointerPosition(event); const context = event.currentTarget.getContext('2d'); context?.beginPath(); context?.moveTo(point.x, point.y); }}
                  onPointerMove={(event) => { if (!drawingRef.current) return; setHasSignature(true); const point = pointerPosition(event); const context = event.currentTarget.getContext('2d'); if (context) { context.lineWidth = 3; context.lineCap = 'round'; context.strokeStyle = '#0f172a'; context.lineTo(point.x, point.y); context.stroke(); } }}
                  onPointerUp={() => { drawingRef.current = false; }} onPointerCancel={() => { drawingRef.current = false; }}
                  className="mt-2 h-40 w-full touch-none rounded-xl border border-slate-300 bg-white" />
                <button type="button" onClick={() => { canvasRef.current?.getContext('2d')?.clearRect(0, 0, 700, 180); setHasSignature(false); }} className="mt-2 text-sm font-semibold text-cyan-700">Clear signature</button>
                <label className="mt-4 flex gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-1 h-4 w-4" /><span>{agreement.consentText}</span></label>
                <button type="button" onClick={signAgreement} disabled={signing || !consentAccepted || !hasSignature || signerName.trim().length < 2} className="mt-5 rounded-full bg-slate-950 px-6 py-3 font-semibold text-white disabled:opacity-50">{signing ? 'Signing securely...' : 'Agree and sign ICA'}</button>
              </div>
            ) : null}

            {agreement.status === 'SIGNED' && agreement.downloadAvailable ? (
              <button type="button" onClick={downloadSignedAgreement} className="mt-6 rounded-full bg-cyan-700 px-6 py-3 font-semibold text-white">Download signed ICA PDF</button>
            ) : null}


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
    Wezen Staffing will issue your ICA in this secure portal. Review every page, accept the electronic signature consent, and sign below.
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
    : agreement.status === 'SENT' ? 'Ready for your secure electronic signature' : 'Waiting for Wezen Staffing to issue the agreement'}
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
