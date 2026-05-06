'use client';

import { useEffect } from 'react';

export default function AppHomePage() {
  useEffect(() => {
    window.location.replace('/app/index.html');
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 text-white">
      <section className="mx-auto max-w-md">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
          Wezen Staffing
        </p>
        <h1 className="mt-4 text-3xl font-bold">Opening app...</h1>
      </section>
    </main>
  );
}
