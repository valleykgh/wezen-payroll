"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "../lib/auth";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        border: "1px solid #ccc",
        background: active ? "#111" : "#fff",
        color: active ? "#fff" : "#111",
        textDecoration: "none",
        fontWeight: 700,
      }}
    >
      {label}
    </Link>
  );
}

export default function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh" }}>
      <div
        style={{
          padding: 12,
          borderBottom: "1px solid #eee",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <NavLink href="/admin" label="Admin Home" />
          <NavLink href="/admin/users" label="Admin Users" />
          <NavLink href="/admin/time-entry" label="Time Entry" />
          <NavLink href="/admin/time-entries-week" label="Time Entries (Week)" />
 	  <NavLink href="/admin/employees" label="Employees" />
  	  <NavLink href="/admin/employees/new" label="Create Employee" />
  	  <NavLink href="/admin/pay-period-summary" label="Pay Period Summary" />
  	  <NavLink href="/admin/payroll-runs" label="Payroll Runs" />
  	  <NavLink href="/admin/payroll-adjustments" label="Payroll Adjustments" />
	  <NavLink href="/admin/payroll-runs/new" label="Finalize Payroll" />
          <NavLink href="/admin/facilities" label="Facilities" />
          <NavLink href="/admin/loans" label="Loans" />
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            window.location.href = "/admin/login";
          }}
          style={{
            padding: "8px 10px",
            borderRadius: 10,
            border: "1px solid #111",
            background: "#fff",
            fontWeight: 700,
          }}
        >
          Logout
        </button>
      </div>

      <div>{children}</div>
    </div>
  );
}
