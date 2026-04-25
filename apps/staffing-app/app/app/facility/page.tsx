import { AppShell } from '@/components/app/app-shell';

export default function FacilityApp() {
  return (
    <AppShell
      role="facility"
      title="Facility App"
      subtitle="Post shifts, view applicants, and approve requests."
    >
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xl font-bold text-slate-950">Facility dashboard</h2>
        <p className="mt-2 text-sm text-slate-600">
          Facility shift management will appear here.
        </p>
      </div>
    </AppShell>
  );
}
