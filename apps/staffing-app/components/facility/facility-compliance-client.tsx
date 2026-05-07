'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Alert = {
  workerId: string;
  workerName: string;
  role: string;
  issue: string;
  severity: 'HIGH' | 'MEDIUM';
};

type ComplianceResponse = {
  summary: {
    highPriority: number;
    mediumPriority: number;
    totalAlerts: number;
  };
  alerts: Alert[];
};

export function FacilityComplianceClient() {
  const [data, setData] = useState<ComplianceResponse | null>(null);
  const [message, setMessage] = useState('Loading compliance...');

  useEffect(() => {
    apiFetch<{ data: ComplianceResponse }>('/api/facility/compliance')
      .then((res) => {
        setData(res.data);
        setMessage('');
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : 'Failed to load compliance'));
  }, []);

  if (!data) {
    return <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">{message}</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xl font-extrabold text-rose-700">{data.summary.highPriority}</p>
          <p className="text-xs font-bold text-slate-500">High</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xl font-extrabold text-amber-700">{data.summary.mediumPriority}</p>
          <p className="text-xs font-bold text-slate-500">Medium</p>
        </div>
        <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-xl font-extrabold text-slate-950">{data.summary.totalAlerts}</p>
          <p className="text-xs font-bold text-slate-500">Total</p>
        </div>
      </div>

      {data.alerts.map((alert, index) => (
        <div key={`${alert.workerId}-${index}`} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className={alert.severity === 'HIGH' ? 'text-xs font-extrabold text-rose-700' : 'text-xs font-extrabold text-amber-700'}>
            {alert.severity}
          </p>
          <h2 className="mt-2 text-base font-extrabold text-slate-950">{alert.workerName}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">{alert.role}</p>
          <p className="mt-3 text-sm text-slate-700">{alert.issue}</p>
        </div>
      ))}

      {data.alerts.length === 0 ? (
        <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          No compliance alerts right now.
        </div>
      ) : null}
    </div>
  );
}
