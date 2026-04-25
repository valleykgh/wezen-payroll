import Link from 'next/link';
import { AppLogo } from './app-logo';

const links = [
  { href: '/facilities', label: 'Facilities' },
  { href: '/professionals', label: 'Professionals' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Policy' },
];

export function Navbar() {
  return (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur">
  <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5">
	<AppLogo />
	  <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="transition hover:text-slate-950">
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
	    className="inline-flex rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-cyan-700"
	  >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
