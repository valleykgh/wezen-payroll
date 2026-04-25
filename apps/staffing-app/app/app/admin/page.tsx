import { AppShell } from '@/components/app/app-shell';

export default function AdminApp() {
  return (
    <AppShell
      role="admin"
      title="Internal Admin"
      subtitle="Manage workers, facilities, onboarding, and shifts."
    >
      <div className="grid gap-4">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm text-slate-500">Today</p>
          <h2 className="mt-2 text-xl font-bold text-slate-950">Admin workspace</h2>
          <p className="mt-2 text-sm text-slate-600">
            Quick access to worker onboarding, facility management, and shift activity.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
