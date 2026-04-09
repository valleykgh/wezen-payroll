'use client';

import { useEffect, useState } from 'react';
import { meRequest } from '@/lib/auth-client';
import { apiFetch } from '@/lib/api-client';
import { StatusBadge } from '@/components/shared/status-badge';
import { DocumentUploadForm } from '@/components/worker/document-upload-form';

type WorkerDocument = {
  id: string;
  name: string;
  category: string;
  status: string;
  expiresAt?: string | null;
  notes?: string | null;
  fileUrl: string;
  createdAt: string;
};

export default function WorkerDocumentsPage() {
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [professionalId, setProfessionalId] = useState<string | null>(null);
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
        const me = await meRequest();
        const id = me.data.professionalId;

        if (!id) {
          setMessage('You must be signed in as a professional.');
          return;
        }

        setProfessionalId(id);
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
          {documents.map((doc) => (
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

                  {doc.notes ? (
                    <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      {doc.notes}
                    </div>
                  ) : null}
                </div>

                <div className="w-full lg:w-56">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex w-full justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    View Document
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
