import { AppShell } from '@/components/app/app-shell';

export default function WorkerApp() {
  return (
    <AppShell
      role="worker"
      title="Worker App"
      subtitle="Search shifts, book shifts, and view approvals."
    >
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-950">Available shifts</h2>
        <p className="mt-2 text-sm text-slate-600">
          Worker shift search and booking will appear here.
        </p>
      </div>
    </AppShell>
  );
}
