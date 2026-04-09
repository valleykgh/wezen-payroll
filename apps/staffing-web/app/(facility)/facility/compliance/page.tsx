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
  data: {
    summary: {
      highPriority: number;
      mediumPriority: number;
      totalAlerts: number;
    };
    alerts: Alert[];
  };
};

export default function FacilityCompliancePage() {
  const [data, setData] = useState<ComplianceResponse['data'] | null>(null);
  const [message, setMessage] = useState('Loading compliance alerts...');

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch<ComplianceResponse>('/api/facility/compliance');
        setData(res.data);
        setMessage('');
              } catch (error) {
        const fallback = 'Failed to load dashboard';

        if (
          error instanceof Error &&
          error.message.includes('Facility is inactive')
        ) {
          setMessage(
            'Facility access has been deactivated. Please contact Wezen Staffing support.'
          );
        } else {
          setMessage(error instanceof Error ? error.message : fallback);
        }
      }
    }
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="page-gradient rounded-[2rem] p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">
          Compliance
        </div>
        <h1 className="mt-2 text-3xl font-bold text-slate-950">
          Compliance alerts
        </h1>
        <p className="mt-2 text-slate-600">
          Review worker document issues relevant to staffing decisions.
        </p>
      </div>

      {message && !data ? (
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          {message}
        </div>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">High priority</div>
              <div className="mt-2 text-3xl font-bold text-slate-950">{data.summary.highPriority}</div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">Medium priority</div>
              <div className="mt-2 text-3xl font-bold text-slate-950">{data.summary.mediumPriority}</div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-slate-500">Total alerts</div>
              <div className="mt-2 text-3xl font-bold text-slate-950">{data.summary.totalAlerts}</div>
            </div>
          </div>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold tracking-tight text-slate-950">
              Current alerts
            </h2>

            <div className="mt-6 space-y-4">
              {data.alerts.map((alert, index) => (
                <div
                  key={`${alert.workerId}-${index}`}
                  className="rounded-[1.25rem] border border-slate-200 p-4 transition hover:shadow-sm"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-lg font-semibold text-slate-950">
                        {alert.workerName}
                      </div>
                      <div className="mt-1 text-sm text-slate-600">{alert.role}</div>
                      <div className="mt-2 text-sm text-slate-500">{alert.issue}</div>
                    </div>

                    <div
                      className={
                        alert.severity === 'HIGH'
                          ? 'rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700'
                          : 'rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700'
                      }
                    >
                      {alert.severity}
                    </div>
                  </div>
                </div>
              ))}

              {data.alerts.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-600">
                  No compliance alerts right now.
                </div>
              ) : null}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
