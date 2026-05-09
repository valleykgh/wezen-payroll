'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

type Dashboard = {
  totalWorkers: number;
  pendingWorkers: number;
  approvedWorkers: number;
  pendingDocuments: number;
  expiredDocuments: number;
  openShifts: number;
  pendingShiftRequests: number;
  cancellationRequests: number;
  unreadAdminNotifications: number;
  auditLogsToday: number;
};

function StatCard({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

export function AdminDashboardClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [message, setMessage] = useState('Loading dashboard...');

  async function loadDashboard() {
    try {
      const res = await apiFetch<{ data: Dashboard }>('/api/admin/dashboard');
      setData(res.data);
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load dashboard');
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  if (!data) {
    return (
      <div className="rounded-3xl bg-white p-5 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
        {message}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Pending Workers" value={data.pendingWorkers} href="/app/admin/workers/index.html" />
        <StatCard label="Pending Docs" value={data.pendingDocuments} href="/app/admin/workers/index.html" />
        <StatCard label="Expired Docs" value={data.expiredDocuments} href="/app/admin/workers/index.html" />
        <StatCard label="Open Shifts" value={data.openShifts} href="/app/admin/shifts/index.html" />
        <StatCard label="Shift Requests" value={data.pendingShiftRequests} href="/app/admin/shifts/index.html" />
        <StatCard label="Cancellations" value={data.cancellationRequests} href="/app/admin/notifications/index.html" />
        <StatCard label="Unread Alerts" value={data.unreadAdminNotifications} href="/app/admin/notifications/index.html" />
        <StatCard label="Audit Today" value={data.auditLogsToday} href="/app/admin/audit-logs/index.html" />
      </div>

      <Link href="/app/admin/facilities/index.html" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-cyan-700">Facilities</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">Manage facilities</h2>
        <p className="mt-2 text-sm text-slate-600">Review facility setup and account status.</p>
      </Link>

      <Link href="/app/admin/internal-admins/index.html" className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm text-cyan-700">Admins</p>
        <h2 className="mt-2 text-xl font-bold text-slate-950">Manage internal admins</h2>
        <p className="mt-2 text-sm text-slate-600">Default admin controls admin access.</p>
      </Link>
    </div>
  );
}
