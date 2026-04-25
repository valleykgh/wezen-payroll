import { AppShell } from '@/components/app/app-shell';
import { FacilityApplicantDetailClient } from '@/components/facility/facility-applicant-detail-client';

export default async function FacilityApplicantDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;

  return (
    <AppShell role="facility" title="Applicant Detail" subtitle="Review worker profile and documents.">
      <FacilityApplicantDetailClient requestId={requestId} />
    </AppShell>
  );
}
