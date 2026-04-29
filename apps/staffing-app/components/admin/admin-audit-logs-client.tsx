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

export function AdminAuditLogsClient() {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [message, setMessage] = useState('Loading audit logs...');

  async function loadLogs() {
    try {
      const res = await apiFetch<{ data: AuditLog[] }>('/api/admin/audit-logs?limit=100');
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
    <div className="grid gap-4">
      {message ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          {message}
        </div>
      ) : null}

      {!message && items.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No audit logs yet.
        </div>
      ) : null}

      {items.map((item) => (
        <div key={item.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-700">{item.action}</p>
          <h2 className="mt-2 text-base font-bold text-slate-950">{item.summary}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {new Date(item.createdAt).toLocaleString()}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Admin: <span className="font-semibold text-slate-900">{item.actorEmail || 'Unknown'}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {item.entityType}{item.entityId ? ` • ${item.entityId}` : ''}
          </p>

          {item.detailsJson ? (
            <pre className="mt-3 max-h-44 overflow-auto rounded-2xl bg-slate-950 p-3 text-[11px] text-slate-100">
              {JSON.stringify(item.detailsJson, null, 2)}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}
