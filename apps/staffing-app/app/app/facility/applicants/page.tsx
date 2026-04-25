import { AppShell } from '@/components/app/app-shell';
import { FacilityApplicantsClient } from '@/components/facility/facility-applicants-client';

export default function FacilityApplicantsPage() {
  return (
    <AppShell role="facility" title="Applicants" subtitle="Review workers who requested your shifts.">
      <FacilityApplicantsClient />
    </AppShell>
  );
}
