'use client';

import { useMemo, useState } from 'react';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { FormField } from '@/components/ui/form-field';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

type Props = {
  professionalId: string;
  onUploaded: () => Promise<void> | void;
};

const EXPIRING_CATEGORIES = new Set([
  'LICENSE',
  'CPR',
  'PHYSICAL',
  'TB_REPORT',
  'ID',
]);

export function DocumentUploadForm({ professionalId, onUploaded }: Props) {
  const [category, setCategory] = useState('LICENSE');
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requiresExpiryDate = useMemo(
    () => EXPIRING_CATEGORIES.has(category),
    [category]
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      if (!file) {
        throw new Error('Please choose a file to upload.');
      }

      if (requiresExpiryDate && !expiresAt) {
        throw new Error('Please select an expiry date for this document.');
      }

      const formData = new FormData();
      formData.append('professionalId', professionalId);
      formData.append('category', category);
      formData.append('name', name || file.name);
      formData.append('file', file);

      if (requiresExpiryDate && expiresAt) {
        formData.append('expiresAt', expiresAt);
      }

      const res = await fetch(`${STAFFING_API_BASE_URL}/api/worker/documents/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Upload failed');
      }

      setMessage('Document uploaded successfully.');
      setName('');
      setExpiresAt('');
      setFile(null);

      const fileInput = document.getElementById('documentFile') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';

      await onUploaded();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-950">
          Upload document
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Upload compliance documents for review and approval.
        </p>
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
          {message}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <FormField label="Category" htmlFor="category">
          <SelectInput
            id="category"
            value={category}
            onChange={(e) => {
              const nextCategory = e.target.value;
              setCategory(nextCategory);

              if (!EXPIRING_CATEGORIES.has(nextCategory)) {
                setExpiresAt('');
              }
            }}
          >
            <option value="LICENSE">License</option>
            <option value="CPR">CPR / BLS</option>
            <option value="PHYSICAL">Physical Report</option>
            <option value="TB_REPORT">TB Report</option>
            <option value="ID">State ID</option>
            <option value="VACCINATION">Vaccination Record</option>
            <option value="OTHER">Other</option>
          </SelectInput>
        </FormField>

        <FormField label="Document name" htmlFor="name">
          <TextInput
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional custom document name"
          />
        </FormField>

        {requiresExpiryDate ? (
          <FormField label="Expiry date" htmlFor="expiresAt">
            <TextInput
              id="expiresAt"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </FormField>
        ) : (
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            This document type does not require an expiry date.
          </div>
        )}

        <div className="md:col-span-2">
          <FormField label="Choose file" htmlFor="documentFile">
            <input
              id="documentFile"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
            />
          </FormField>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Uploading...' : 'Upload Document'}
        </button>
      </div>
    </form>
  );
}
