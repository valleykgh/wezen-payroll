'use client';

import { useEffect, useMemo, useState } from 'react';
import { meRequest } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { DocumentUploadForm } from '@/components/worker/document-upload-form';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type WorkerDocument = {
  id: string;
  name: string;
  category: string;
  status: string;
  expiresAt?: string | null;
  notes?: string | null;
  fileUrl: string;
  createdAt: string;
  storageProvider?: string | null;
  oneDriveWebUrl?: string | null;
};

type WorkerRole = 'CNA' | 'LVN' | 'RN';

type RequiredDocumentItem = {
  key: string;
  label: string;
  category: string;
  uploadCategory?: string;
  manualOnly?: boolean;
};

const REQUIRED_DOCUMENTS_BY_ROLE: Record<WorkerRole, RequiredDocumentItem[]> = {
  CNA: [
    { key: 'license', label: 'CNA License / Certification', category: 'LICENSE', uploadCategory: 'LICENSE' },
    { key: 'cpr', label: 'CPR', category: 'CPR', uploadCategory: 'CPR' },
    { key: 'physical', label: 'Physical Report', category: 'PHYSICAL', uploadCategory: 'PHYSICAL' },
    { key: 'tb', label: 'TB Report', category: 'TB_TEST', uploadCategory: 'TB_TEST' },
    { key: 'ssn', label: 'SSN', category: 'SSN', uploadCategory: 'OTHER', manualOnly: true },
    { key: 'id', label: 'State ID', category: 'ID', uploadCategory: 'ID' },
    { key: 'vaccination', label: 'Vaccination Record', category: 'VACCINATION', uploadCategory: 'VACCINATION' },
    { key: 'inservice', label: 'In-Service Certifications', category: 'INSERVICE', uploadCategory: 'OTHER', manualOnly: true },
  ],
  LVN: [
    { key: 'license', label: 'LVN License', category: 'LICENSE', uploadCategory: 'LICENSE' },
    { key: 'cpr', label: 'CPR', category: 'CPR', uploadCategory: 'CPR' },
    { key: 'physical', label: 'Physical Report', category: 'PHYSICAL', uploadCategory: 'PHYSICAL' },
    { key: 'tb', label: 'TB Report', category: 'TB_TEST', uploadCategory: 'TB_TEST' },
    { key: 'ssn', label: 'SSN', category: 'SSN', uploadCategory: 'OTHER', manualOnly: true },
    { key: 'id', label: 'State ID', category: 'ID', uploadCategory: 'ID' },
    { key: 'vaccination', label: 'Vaccination Record', category: 'VACCINATION', uploadCategory: 'VACCINATION' },
    { key: 'inservice', label: 'In-Service Certifications', category: 'INSERVICE', uploadCategory: 'OTHER', manualOnly: true },
  ],
  RN: [
    { key: 'license', label: 'RN License', category: 'LICENSE', uploadCategory: 'LICENSE' },
    { key: 'cpr', label: 'CPR', category: 'CPR', uploadCategory: 'CPR' },
    { key: 'physical', label: 'Physical Report', category: 'PHYSICAL', uploadCategory: 'PHYSICAL' },
    { key: 'tb', label: 'TB Report', category: 'TB_TEST', uploadCategory: 'TB_TEST' },
    { key: 'ssn', label: 'SSN', category: 'SSN', uploadCategory: 'OTHER', manualOnly: true },
    { key: 'id', label: 'State ID', category: 'ID', uploadCategory: 'ID' },
    { key: 'vaccination', label: 'Vaccination Record', category: 'VACCINATION', uploadCategory: 'VACCINATION' },
    { key: 'inservice', label: 'In-Service Certifications', category: 'INSERVICE', uploadCategory: 'OTHER', manualOnly: true },
  ],
};

function getDaysUntilExpiration(expiresAt?: string | null) {
  if (!expiresAt) return null;
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function getExpirationTone(expiresAt?: string | null) {
  const days = getDaysUntilExpiration(expiresAt);
  if (days == null) return null;
  if (days < 0) return 'expired';
  if (days < 30) return 'warning';
  return 'ok';
}

export default function WorkerDocumentsPage() {
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
  const [workerRole, setWorkerRole] = useState<WorkerRole | null>(null);
  const [message, setMessage] = useState('Loading documents...');

  async function loadDocuments(id: string) {
    const res = await apiFetch<{ data: WorkerDocument[] }>(
      `/api/worker/documents?professionalId=${id}`
    );
    setDocuments(res.data);
  }

  useEffect(() => {
  async function load() {
    try {
      const dashboardRes = await apiFetch<{ data: any }>('/api/worker/dashboard');

      const id = dashboardRes.data.profile.professionalId;
      const role = dashboardRes.data.profile.role as WorkerRole;

      if (!id) {
        setMessage('Professional profile not found.');
        return;
      }

      setProfessionalId(id);
      setWorkerRole(role);

      await loadDocuments(id);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load documents');
    }
  }

  load();
}, []);	

  async function handleUploaded() {
    if (!professionalId) return;
    await loadDocuments(professionalId);
  }

  const requiredDocuments = useMemo(() => {
    if (!workerRole) return [];
    return REQUIRED_DOCUMENTS_BY_ROLE[workerRole] || [];
  }, [workerRole]);

  const checklist = useMemo(() => {
    return requiredDocuments.map((item) => {
      const matchingDocs = documents.filter((doc) => {
        if (item.category === 'SSN' || item.category === 'INSERVICE') {
          return (
            doc.category === 'OTHER' &&
            doc.name.toLowerCase().includes(item.label.toLowerCase())
          );
        }

        return doc.category === item.category;
      });

      const approved = matchingDocs.some((doc) => doc.status === 'APPROVED');
      const pending = matchingDocs.some((doc) => doc.status === 'PENDING');
      const rejected = matchingDocs.some((doc) => doc.status === 'REJECTED');
      const expired = matchingDocs.some((doc) => doc.status === 'EXPIRED');

      let state: 'MISSING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' = 'MISSING';

      if (approved) state = 'APPROVED';
      else if (pending) state = 'PENDING';
      else if (rejected) state = 'REJECTED';
      else if (expired) state = 'EXPIRED';

      return {
        ...item,
        state,
        matchingDocs,
      };
    });
  }, [requiredDocuments, documents]);

  const completedCount = checklist.filter((item) => item.state === 'APPROVED').length;
  const totalRequired = checklist.length;
  const missingCount = checklist.filter((item) => item.state === 'MISSING').length;

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Documents
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Manage your compliance documents
        </h1>
        <p className="mt-2 max-w-3xl text-slate-600">
          Upload and track required documents for internal review and facility readiness.
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

      {workerRole ? (
        <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-950">
                Required documents for {workerRole}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Complete these items before Wezen can fully approve your profile for shift requests.
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <div>
                Completed: <span className="font-semibold">{completedCount}/{totalRequired}</span>
              </div>
              <div className="mt-1">
                Missing: <span className="font-semibold">{missingCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {checklist.map((item) => (
              <div
                key={item.key}
                className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">{item.label}</div>

                  <StatusBadge
                    label={item.state}
                    tone={
                      item.state === 'APPROVED'
                        ? 'success'
                        : item.state === 'PENDING'
                          ? 'info'
                          : item.state === 'REJECTED'
                            ? 'danger'
                            : item.state === 'EXPIRED'
                              ? 'warning'
                              : 'warning'
                    }
                  />
                </div>

                <div className="mt-3 text-sm text-slate-600">
                  {item.state === 'APPROVED' && 'Uploaded and approved.'}
                  {item.state === 'PENDING' && 'Uploaded and awaiting review.'}
                  {item.state === 'REJECTED' && 'Uploaded but rejected. Please review notes below.'}
                  {item.state === 'EXPIRED' && 'Uploaded document has expired and needs replacement.'}
                  {item.state === 'MISSING' && 'Not uploaded yet.'}
                </div>

                {item.manualOnly ? (
                  <div className="mt-3 rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Upload this under <span className="font-semibold">Other</span> for now, and include the document name clearly.
                  </div>
                ) : null}

                {item.matchingDocs.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {item.matchingDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-700 border border-slate-200"
                      >
                        <div className="font-medium text-slate-900">{doc.name}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          Status: {doc.status}
                        </div>
                        {doc.notes ? (
                          <div className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">
                            {doc.notes}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {professionalId ? (
        <DocumentUploadForm professionalId={professionalId} onUploaded={handleUploaded} />
      ) : null}

      {message && documents.length === 0 ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}


	{documents.length > 0 ? (
  <div className="space-y-4">
    {documents.map((doc) => {
      const daysUntilExpiration = doc.expiresAt
        ? Math.ceil(
            (new Date(doc.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        : null;

      return (
        <div
          key={doc.id}
          className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-xl font-bold tracking-tight text-slate-950">
                  {doc.name}
                </div>
                <StatusBadge
                  label={doc.status}
                  tone={
                    doc.status === 'APPROVED'
                      ? 'success'
                      : doc.status === 'REJECTED'
                        ? 'danger'
                        : doc.status === 'EXPIRED'
                          ? 'warning'
                          : 'info'
                  }
                />
                {doc.storageProvider === 'ONEDRIVE' ? (
                  <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                    Uploaded to OneDrive
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-sm text-slate-600">
                Category: {doc.category}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Uploaded
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Expires
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-900">
                    {doc.expiresAt
                      ? new Date(doc.expiresAt).toLocaleDateString()
                      : 'No expiration listed'}
                  </div>
                </div>
              </div>

              {doc.expiresAt && daysUntilExpiration != null ? (
                daysUntilExpiration < 0 ? (
                  <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    This document expired on{' '}
                    {new Date(doc.expiresAt).toLocaleDateString()}.
                  </div>
                ) : daysUntilExpiration < 30 ? (
                  <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Warning: this document expires in {daysUntilExpiration} day
                    {daysUntilExpiration === 1 ? '' : 's'} on{' '}
                    {new Date(doc.expiresAt).toLocaleDateString()}.
                  </div>
                ) : null
              ) : null}

              {doc.notes ? (
                <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {doc.notes}
                </div>
              ) : null}
            </div>

            <div className="w-full lg:w-56">
              <div className="flex flex-wrap gap-3">
                <a
                  href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/view`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                >
                  View Document
                </a>

                <a
                  href={`${STAFFING_API_BASE_URL}/api/documents/${doc.id}/download`}
                  className="inline-flex w-full justify-center rounded-full border border-cyan-300 bg-cyan-50 px-5 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-100"
                >
                  Download Document
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    })}
  </div>
) : null}
    </div>
  );
}
