import { apiFetch } from '@/lib/api-client';

type Notification = {
  id: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

export default async function WorkerNotificationsPage() {
  const res = await apiFetch<{ data: Notification[] }>(
    '/api/worker/notifications'
  );

  const notifications = res.data;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Notifications</h1>

      {!notifications.length && (
        <p className="text-gray-500">No notifications yet</p>
      )}

      <div className="space-y-3">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border ${
              n.isRead ? 'bg-gray-50' : 'bg-blue-50 border-blue-300'
            }`}
          >
            <p className="text-sm">{n.message}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(n.createdAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
