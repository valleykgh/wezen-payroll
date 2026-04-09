export function GradientCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.75rem] bg-gradient-to-br from-slate-900 to-cyan-700 p-6 text-white shadow-xl">
      {children}
    </div>
  );
}
