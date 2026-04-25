import { AppShell } from '@/components/app/app-shell';
import { WorkerDocumentsClient } from '@/components/worker/worker-documents-client';

export default function WorkerProfilePage() {
  return (
    <AppShell role="worker" title="Profile" subtitle="Upload documents and track compliance.">
      <WorkerDocumentsClient />
    </AppShell>
  );
}
