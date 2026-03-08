import Link from "next/link";

export default function AdminHomePage() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 0 }}>Admin Dashboard</h1>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <Link href="/admin/time-entry" style={{ padding: 12, border: "1px solid #ddd", borderRadius: 10, textDecoration: "none" }}>
          Time Entry
        </Link>
      </div>
      <div style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
        You can create employees, invite them, and enter time from the Time Entry tool.
      </div>
    </div>
  );
}
