import Link from 'next/link';
import { AppShell } from '@/components/app/app-shell';

const links = [
  { label: 'Availability', href: '/app/worker/availability/index.html', helper: 'Set AM / PM / NOC availability.' },
  { label: 'Documents', href: '/app/worker/documents/index.html', helper: 'Upload and review compliance documents.' },
  { label: 'Profile', href: '/app/worker/profile/index.html', helper: 'Manage profile and shift alert settings.' },
];

export default function WorkerMorePage() {
  return (
    <AppShell role="worker" title="More" subtitle="Worker tools and settings.">
      <div className="grid gap-3">
        {links.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-lg font-extrabold text-slate-950">{item.label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-600">{item.helper}</div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
