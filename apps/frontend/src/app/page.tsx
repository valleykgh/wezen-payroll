export default async function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "";
  let health: any = null;

  try {
    const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    health = await res.json();
  } catch (e) {
    health = { error: "Could not reach API", apiUrl };
  }

  return (
    <main style={{ padding: 32, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Wezen Payroll</h1>
      <p style={{ marginTop: 8 }}>Frontend is live ✅</p>

      <div style={{ marginTop: 24, padding: 16, border: "1px solid #ddd", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>API Health</h2>
        <pre style={{ marginTop: 12, background: "#f7f7f7", padding: 12, borderRadius: 8, overflowX: "auto" }}>
          {JSON.stringify(health, null, 2)}
        </pre>
      </div>
    </main>
  );
}
