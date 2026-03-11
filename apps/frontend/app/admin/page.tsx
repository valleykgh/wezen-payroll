import Link from "next/link";

const cardStyle: React.CSSProperties = {
  display: "block",
  padding: 16,
  border: "1px solid #d1d5db",
  borderRadius: 12,
  textDecoration: "none",
  color: "#111827",
  background: "#ffffff",
  minWidth: 220,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 6,
};

const descStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#4b5563",
  lineHeight: 1.4,
};

export default function AdminHomePage() {
  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 0, marginBottom: 16 }}>
        Admin Dashboard
      </h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
          maxWidth: 900,
        }}
      >
        <Link href="/admin/time-entry" style={cardStyle}>
          <div style={titleStyle}>Time Entry</div>
          <div style={descStyle}>
            Create and edit employee time entries.
          </div>
        </Link>

        <Link href="/admin/users" style={cardStyle}>
          <div style={titleStyle}>Admin Users</div>
          <div style={descStyle}>
            Create admin accounts, assign roles, and reset passwords.
          </div>
        </Link>
      </div>

      <div style={{ marginTop: 16, fontSize: 13, opacity: 0.8 }}>
        You can create employees, invite them, and enter time from the Time Entry tool.
      </div>
    </div>
  );
}
