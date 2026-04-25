import clsx from 'clsx';

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        'rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md',
        className
      )}
    >
      {children}
    </div>
  );
}
