import { StatusBadge } from './status-badge';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
};

export function StatCard({ label, value, helper, tone = 'default' }: StatCardProps) {
  return (
    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </div>
        </div>
        {helper ? <StatusBadge label={helper} tone={tone} /> : null}
      </div>
    </div>
  );
}
