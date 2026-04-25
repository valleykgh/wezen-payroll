import { AppShell } from '@/components/app/app-shell';
import { PostShiftForm } from '@/components/facility/post-shift-form';

export default function FacilityPostShiftPage() {
  return (
    <AppShell
      role="facility"
      title="Post Shift"
      subtitle="Create a new AM, PM, or NOC shift."
    >
      <PostShiftForm />
    </AppShell>
  );
}
