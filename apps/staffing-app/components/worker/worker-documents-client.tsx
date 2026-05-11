'use client';

import { useEffect, useState } from 'react';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';
import { apiFetch, formatApiErrorText } from '@/lib/api-client';
import { getAuthToken } from '@/lib/auth-client';

type DocumentItem = {
  id: string;
  name: string;
  category: string;
  status: string;
  fileUrl: string | null;
  createdAt: string;
  expiresAt?: string | null;
};

export function WorkerDocumentsClient() {
  const [professionalId, setProfessionalId] = useState('');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [category, setCategory] = useState('LICENSE');
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  async function loadDocuments() {
    setLoading(true);
    setMessage('');

    try {
      const me = await apiFetch<{ data: { professionalId?: string | null } }>('/api/auth/me');
      const id = me.data.professionalId || '';
      setProfessionalId(id);

      if (!id) {
        setMessage('Professional profile not found.');
        return;
      }

      const res = await apiFetch<{ data: DocumentItem[] }>(
        `/api/worker/documents?professionalId=${encodeURIComponent(id)}`
      );

      setDocuments(
        (res.data || []).filter(
          (doc) =>
            doc.status !== 'EXPIRED' &&
            !doc.name.includes('-old') &&
            !(doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now())
        )
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  async function uploadDocument(e: React.FormEvent) {
    e.preventDefault();

    if (!file) {
      setMessage('Please select a file.');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('professionalId', professionalId);
      formData.append('category', category);
      formData.append('name', name || file.name);
      if (expiresAt) formData.append('expiresAt', expiresAt);
      formData.append('file', file);

      const token = getAuthToken();

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/worker/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(formatApiErrorText(text, 'Upload failed'));
      }

      setMessage('Document uploaded. It is pending admin approval.');
      setName('');
      setExpiresAt('');
      setFile(null);
      await loadDocuments();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);



  useEffect(() => {
    loadDocuments();
  }, []);

  return (
    <div className="grid gap-4">
      <form onSubmit={uploadDocument} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-bold text-slate-950">Upload Required Document</h2>

        {message ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[86%] -translate-x-1/2 -translate-y-1/2 rounded-3xl border-2 border-red-700 bg-red-600 px-6 py-6 text-center text-lg font-extrabold text-white shadow-2xl">
          {message}
        </div>
      ) : null}

        <div className="mt-4 grid gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-2xl border border-slate-200 px-3 py-3 text-sm"
          >
            <option value="LICENSE">License</option>
            <option value="CPR">CPR / BLS</option>
            <option value="PHYSICAL">Physical Report</option>
            <option value="TB_REPORT">TB Report</option>
            <option value="ID">State ID</option>
            <option value="VACCINATION">Vaccination Record</option>
            <option value="OTHER">Other</option>
          </select>

          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Document name" className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

          <div className="grid gap-1">
            <label className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Expiration date
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-2xl border border-cyan-300 bg-cyan-50 px-4 py-4 text-base font-semibold text-slate-950"
            />
            <p className="text-xs text-slate-500">
              Required for licenses, CPR/BLS, physicals, TB, and vaccination records when applicable.
            </p>
          </div>

          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} className="rounded-2xl border border-slate-200 px-3 py-3 text-sm" />

          <button type="submit" disabled={uploading} className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
            {uploading ? 'Uploading...' : 'Upload document'}
          </button>
        </div>
      </form>

      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-bold text-slate-950">My Documents</h2>

        {loading ? <p className="mt-4 text-sm text-slate-600">Loading documents...</p> : null}

        {!loading && documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No documents uploaded yet.</p>
        ) : null}

        <div className="mt-4 grid gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="rounded-2xl bg-slate-50 p-4">
              <p className="font-bold text-slate-950">{doc.name}</p>
              <p className="mt-1 text-sm text-slate-600">{doc.category} • {doc.status}</p>
              {doc.expiresAt ? (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Expires {new Date(doc.expiresAt).toLocaleDateString()}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
