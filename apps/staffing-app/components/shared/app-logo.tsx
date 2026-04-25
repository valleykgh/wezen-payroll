import Image from 'next/image';
import Link from 'next/link';

export function AppLogo() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <Image
        src="/logo.svg"
        alt="Wezen Staffing"
        width={260}
        height={72}
        className="h-16 w-auto object-contain"
        priority
      />

      <div className="leading-tight">
        <div className="text-base font-semibold text-slate-950">
          Wezen Staffing
        </div>
        <div className="text-xs text-slate-500">
          Healthcare staffing marketplace
        </div>
      </div>
    </Link>
  );
}
