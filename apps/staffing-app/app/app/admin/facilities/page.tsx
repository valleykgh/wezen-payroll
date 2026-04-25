import { AppShell } from '@/components/app/app-shell';

export default function AdminFacilitiesPage() {
  return (
    <AppShell role="admin" title="Facilities" subtitle="Manage facility accounts and access.">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-bold text-slate-950">Facilities menu</h2>
        <p className="mt-2 text-sm text-slate-600">Facility list and settings will appear here.</p>
      </div>
    </AppShell>
  );
}
