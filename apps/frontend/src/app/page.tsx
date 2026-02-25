"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL || "https://api.payroll.wezenstaffing.com";

  const [health, setHealth] = useState<any>(null);
  const [err, setErr] = useState<any>(null);

  useEffect(() => {
    fetch(`${apiUrl}/api/health`, { mode: "cors" })
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) throw new Error(`${r.status} ${text}`);
        return JSON.parse(text);
      })
      .then(setHealth)
      .catch(() => {
        setErr({ error: "Could not reach API", apiUrl });
      });
  }, [apiUrl]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 10 }}>Wezen Payroll</h1>

      <div style={{ marginBottom: 18, fontSize: 16 }}>
        Frontend is live ✅
      </div>

      <section style={{ padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>API Health</h2>

        {!health && !err && <div>Checking…</div>}

        {(health || err) && (
          <pre style={{ background: "#f6f6f6", padding: 12, borderRadius: 8, overflowX: "auto" }}>
            {JSON.stringify(health || err, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
