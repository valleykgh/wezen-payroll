'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type AuditLog = {
  id: string;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  detailsJson?: unknown;
  createdAt: string;
};

export default function AdminAuditLogsPage() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState('Loading audit logs...');

  async function loadLogs() {
    try {
      const res = await apiFetch<{ data: AuditLog[] }>('/api/admin/audit-logs?limit=150');
      setItems(res.data || []);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load audit logs');
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 p-8 text-white shadow-sm">
        <div className="text-sm font-semibold uppercase tracking-[0.25em] text-cyan-200">
          Internal Admin
        </div>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">Audit Logs</h1>
        <p className="mt-3 max-w-3xl text-base text-slate-200">
          Review sensitive admin actions including approvals, password resets, document decisions, and ICA updates.
        </p>
      </div>

      {message ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">
                  {item.action}
                </div>
                <h2 className="mt-2 text-lg font-bold text-slate-950">{item.summary}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  {item.entityType}{item.entityId ? ` • ${item.entityId}` : ''}
                </p>
              </div>

              <div className="text-right text-xs text-slate-500">
                <div>{new Date(item.createdAt).toLocaleString()}</div>
                <div className="mt-1 font-semibold text-slate-700">
                  {item.actorEmail || 'Unknown admin'}
                </div>
              </div>
            </div>

            {item.detailsJson ? (
              <pre className="mt-4 max-h-56 overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                {JSON.stringify(item.detailsJson, null, 2)}
              </pre>
            ) : null}
          </div>
        ))}
      </div>

      {!message && items.length === 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-slate-600">
          No audit logs yet.
        </div>
      ) : null}
    </div>
  );
}
