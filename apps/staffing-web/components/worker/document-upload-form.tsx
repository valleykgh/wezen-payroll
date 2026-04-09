'use client';

import { useState } from 'react';
import { SelectInput } from '@/components/ui/select-input';
import { TextInput } from '@/components/ui/text-input';
import { FormField } from '@/components/ui/form-field';

const API_BASE_URL = 'http://localhost:4001';

type Props = {
  professionalId: string;
  onUploaded: () => Promise<void> | void;
};

export function DocumentUploadForm({ professionalId, onUploaded }: Props) {
  const [category, setCategory] = useState('LICENSE');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');

    try {
      if (!file) {
        throw new Error('Please choose a file to upload.');
      }

      const formData = new FormData();
      formData.append('professionalId', professionalId);
      formData.append('category', category);
      formData.append('name', name || file.name);
      formData.append('file', file);

      const res = await fetch(`${API_BASE_URL}/api/worker/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Upload failed');
      }

      setMessage('Document uploaded successfully.');
      setName('');
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
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="LICENSE">License</option>
            <option value="ID">ID</option>
            <option value="CPR">CPR</option>
            <option value="TB_TEST">TB Test</option>
            <option value="PHYSICAL">Physical</option>
            <option value="VACCINATION">Vaccination</option>
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
