'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminFacilityCalendarClient } from '@/components/admin/admin-facility-calendar-client';

function Inner() {
  const searchParams = useSearchParams();
  const facilityId = searchParams.get('facilityId') || '';

  if (!facilityId) {
    return (
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        Facility not selected.
      </div>
    );
  }

  return <AdminFacilityCalendarClient facilityId={facilityId} />;
}

export default function FacilityCalendarPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
