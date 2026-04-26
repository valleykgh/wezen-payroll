'use client';

import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/app/app-shell';
import { FacilityApplicantDetailClient } from '@/components/facility/facility-applicant-detail-client';

export default function FacilityApplicantDetailPage() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get('requestId') || '';

  return (
    <AppShell role="facility" title="Applicant Detail" subtitle="Review worker profile and documents.">
      <FacilityApplicantDetailClient requestId={requestId} />
    </AppShell>
  );
}
