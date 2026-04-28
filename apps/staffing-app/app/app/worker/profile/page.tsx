import { AppShell } from '@/components/app/app-shell';
import { WorkerDocumentsClient } from '@/components/worker/worker-documents-client';
import { WorkerNotificationSettingsClient } from '@/components/worker/worker-notification-settings-client';

export default function WorkerProfilePage() {
  return (
    <AppShell role="worker" title="Profile" subtitle="Upload documents and track compliance.">
      <div className="grid gap-4">
        <WorkerNotificationSettingsClient />
        <WorkerDocumentsClient />
      </div>
    </AppShell>
  );
}
