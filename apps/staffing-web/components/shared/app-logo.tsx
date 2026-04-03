import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-sm">
        W
      </div>
      <div>
        <div className="text-base font-bold tracking-tight text-slate-950">
          Wezen Staffing
        </div>
        <div className="text-xs text-slate-500">Healthcare staffing marketplace</div>
      </div>
    </Link>
  );
}
