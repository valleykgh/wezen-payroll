'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AppShell } from '@/components/app/app-shell';
import { meRequest, type AuthMeResponse } from '@/lib/auth-client';

const adminItems = [
  { label: 'Profile & Settings', href: '/app/facility/settings/index.html' },
  { label: 'Favorites', href: '/app/facility/favorites/index.html' },
  { label: 'Alerts', href: '/app/facility/alerts/index.html' },
  { label: 'Compliance', href: '/app/facility/compliance/index.html' },
  { label: 'Notifications', href: '/app/facility/notifications/index.html' },
  { label: 'Workers', href: '/app/facility/workers/index.html' },
  { label: 'Schedule', href: '/app/facility/schedule/index.html' },
];

const staffItems = [
  { label: 'Alerts', href: '/app/facility/alerts/index.html' },
  { label: 'Notifications', href: '/app/facility/notifications/index.html' },
];

export default function FacilityMorePage() {
  const [user, setUser] = useState<AuthMeResponse['data'] | null>(null);

  useEffect(() => {
    meRequest().then((res) => setUser(res.data)).catch(() => setUser(null));
  }, []);

  const items = user?.role === 'FACILITY_STAFF' ? staffItems : adminItems;

  return (
    <AppShell role="facility" title="More" subtitle="Facility settings and tools.">
      <div className="grid gap-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-3xl bg-white p-5 text-base font-extrabold text-slate-950 shadow-sm ring-1 ring-slate-200"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
