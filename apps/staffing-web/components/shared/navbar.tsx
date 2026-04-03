import Link from 'next/link';
import { AppLogo } from './app-logo';

const links = [
  { href: '/facilities', label: 'Facilities' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/contact', label: 'Contact' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <AppLogo />

        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-slate-950">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="https://payroll.wezenstaffing.com"
            className="hidden rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 md:inline-flex"
          >
            Payroll
          </a>
          <Link
            href="/login"
            className="inline-flex rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
