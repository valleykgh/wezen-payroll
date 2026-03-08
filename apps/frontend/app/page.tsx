export default function Home() {
  return (
    <div style={{ padding: 16, maxWidth: 600 }}>
      <h1 style={{ marginBottom: 10 }}>Wezen Payroll</h1>
      <div style={{ display: "flex", gap: 12 }}>
        <a href="/admin/login" style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          Admin Portal
        </a>
        <a href="/employee/login" style={{ padding: 12, border: "1px solid #ccc", borderRadius: 8 }}>
          Employee Portal
        </a>
      </div>
    </div>
  );
}
