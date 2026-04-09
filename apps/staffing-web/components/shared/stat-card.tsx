import { StatusBadge } from './status-badge';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
};

export function StatCard({
  label,
  value,
  helper,
  tone = 'default',
}: StatCardProps) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm text-slate-500">{label}</div>
          <div className="mt-3 text-3xl font-bold text-slate-950">{value}</div>
        </div>
        {helper ? <StatusBadge label={helper} tone={tone} /> : null}
      </div>
    </div>
  );
}
