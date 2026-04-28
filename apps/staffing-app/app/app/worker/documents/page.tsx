import { AppShell } from '@/components/app/app-shell';
import { WorkerDocumentsClient } from '@/components/worker/worker-documents-client';

export default function WorkerDocumentsPage() {
  return (
    <AppShell role="worker" title="Documents" subtitle="Upload and manage compliance documents.">
      <WorkerDocumentsClient />
    </AppShell>
  );
}
