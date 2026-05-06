'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { STAFFING_API_BASE_URL } from '@/lib/api-base';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage('');

    try {
      const res = await fetch(`${STAFFING_API_BASE_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, message: body }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || 'Failed to send message');

      setName('');
      setEmail('');
      setRole('');
      setBody('');
      setMessage('Message sent successfully. Wezen Staffing will contact you soon.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 2500);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <div className="bg-slate-50">
      <Navbar />

      <section className="mx-auto max-w-7xl px-6 pb-20 pt-16">
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-700">
              Contact
            </div>

            <h1 className="mt-4 text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Get in touch with Wezen Staffing
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              Reach out for facility access, professional onboarding questions,
              partnership conversations, or general platform support.
            </p>

            <div className="mt-10 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Support
              </div>
              <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">
                support@wezenstaffing.com
              </div>
              <div className="mt-2 text-sm leading-7 text-slate-600">
                Use this email for facility access, worker onboarding, platform questions,
                compliance support, and general support requests.
              </div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-xl">
            <h2 className="text-3xl font-bold tracking-tight text-slate-950">
              Send us a message
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Professionals and facilities can contact Wezen Staffing directly from this form.
            </p>

            {message ? (
              <div className="mt-5 rounded-2xl bg-red-600 px-4 py-3 text-center text-sm font-extrabold text-white">
                {message}
              </div>
            ) : null}

            <form onSubmit={submitContact} className="mt-6 grid gap-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                required
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">I am contacting as...</option>
                <option value="Professional">Professional</option>
                <option value="Facility">Facility</option>
                <option value="General">General</option>
              </select>

              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="How can we help?"
                rows={7}
                required
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />

              <button
                type="submit"
                disabled={busy}
                className="rounded-full bg-cyan-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:opacity-60"
              >
                {busy ? 'Sending...' : 'Send Email'}
              </button>
            </form>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/login" className="text-sm font-semibold text-cyan-700 underline">
                Go to Login
              </Link>
              <Link href="/how-it-works" className="text-sm font-semibold text-cyan-700 underline">
                See How It Works
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
