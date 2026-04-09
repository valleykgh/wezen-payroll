import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export function Button({
  children,
  className,
  variant = 'primary',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base = 'inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold transition';

  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-cyan-600 text-white shadow-lg shadow-cyan-200 hover:-translate-y-0.5 hover:bg-cyan-700',
    secondary: 'border border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
    ghost: 'text-slate-700 hover:bg-slate-100',
  };

  return (
    <button className={clsx(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
