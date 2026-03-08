"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../../../lib/api";
import CreateEmployeeForm from "../CreateEmployeeForm";

type Employee = {
  id: string;
  legalName: string;
  preferredName?: string | null;
  email: string;
  hourlyRateCents: number;
  active: boolean;
  title: "CNA" | "LVN" | "RN";
};

export default function AdminCreateEmployeePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Invite
  const [inviteEmployeeId, setInviteEmployeeId] = useState("");
  const [inviteResult, setInviteResult] = useState<any>(null);

  const loadEmployees = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const r = await apiFetch<{ employees: Employee[] }>("/api/admin/employees");
      setEmployees(r.employees || []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load employees");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  async function sendInvite() {
    setErr(null);
    setInviteResult(null);
    if (!inviteEmployeeId) {
      setErr("Select an employee to invite");
      return;
    }

    setLoading(true);
    try {
      const r = await apiFetch("/api/admin/invites", {
        method: "POST",
        body: JSON.stringify({ employeeId: inviteEmployeeId }),
      });
      setInviteResult(r);
    } catch (e: any) {
      setErr(e?.message || "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>Create Employee</h1>

      {err ? <div style={{ marginBottom: 10, color: "#b00020" }}>{err}</div> : null}

      {/* Create Employee */}
      <CreateEmployeeForm onCreated={loadEmployees} />

      {/* Invite */}
      <div style={{ marginTop: 14, padding: 12, border: "1px solid #ddd", borderRadius: 10 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, marginTop: 0 }}>Send Invite</h2>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <div style={{ minWidth: 420 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>Employee</div>
            <select
              value={inviteEmployeeId}
              onChange={(e) => setInviteEmployeeId(e.target.value)}
              style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            >
              <option value="">Select employee…</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.legalName} ({emp.email})
                </option>
              ))}
            </select>
          </div>

          <button
            disabled={loading || !inviteEmployeeId}
            onClick={sendInvite}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #111", background: "#111", color: "#fff", height: 42 }}
          >
            Send Invite
          </button>

          <button
            disabled={loading}
            onClick={loadEmployees}
            style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid #ccc", background: "#fff", height: 42 }}
          >
            Refresh
          </button>
        </div>

        {inviteResult ? (
          <pre style={{ marginTop: 12, padding: 10, background: "#f6f6f6", borderRadius: 10, overflowX: "auto", fontSize: 12 }}>
            {JSON.stringify(inviteResult, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
