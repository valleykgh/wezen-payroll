"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../../lib/api";

type FinalizeResp = {
  ok: true;
  periodStart: string;
  periodEnd: string;
  payrollRunId: string;
  employeeCount: number;
  snapshotCount: number;
};
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function startOfWeekISO(baseISO?: string) {
  const d = baseISO ? new Date(`${baseISO}T00:00:00`) : new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(baseISO?: string) {
  return addDaysISO(startOfWeekISO(baseISO), 6);
}
export default function AdminFinalizePayrollRunPage() {
  const router = useRouter();
  const [preset, setPreset] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function applyPreset(value: string) {
  setPreset(value);

  if (value === "THIS_WEEK") {
    setPeriodStart(startOfWeekISO());
    setPeriodEnd(endOfWeekISO());
    return;
  }

  if (value === "LAST_WEEK") {
    const thisWeekStart = startOfWeekISO();
    const lastWeekStart = addDaysISO(thisWeekStart, -7);
    setPeriodStart(lastWeekStart);
    setPeriodEnd(addDaysISO(lastWeekStart, 6));
    return;
  }

  if (value === "LAST_2_WEEKS") {
    const thisWeekStart = startOfWeekISO();
    const start = addDaysISO(thisWeekStart, -14);
    const end = addDaysISO(thisWeekStart, -1);
    setPeriodStart(start);
    setPeriodEnd(end);
    return;
  }

  if (value === "LAST_7_DAYS") {
    setPeriodStart(addDaysISO(todayISO(), -6));
    setPeriodEnd(todayISO());
    return;
  }
}

  async function finalizeRun() {
    setErr("");
    setOk("");

    if (!periodStart || !periodEnd) {
      setErr("Please select period start and period end.");
      return;
    }

    const confirmFinalize = window.confirm(
      `Finalize payroll run for ${periodStart} → ${periodEnd}? This will create frozen payroll snapshots.`
    );
    if (!confirmFinalize) return;

    setLoading(true);
    try {
      const resp = await apiFetch<FinalizeResp>("/api/admin/payroll-runs/finalize", {
        method: "POST",
        body: JSON.stringify({
          periodStart,
          periodEnd,
          notes: notes.trim() || undefined,
        }),
      });

      setOk(
        `Payroll run finalized. Employees: ${resp.employeeCount}, snapshots: ${resp.snapshotCount}.`
      );

      router.push(`/admin/payroll-runs/${resp.payrollRunId}`);
    } catch (e: any) {
      setErr(e?.message || "Failed to finalize payroll run");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 760, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Finalize Payroll Run</h1>
      <div style={{ color: "#666", marginTop: 4 }}>
        Create a frozen payroll snapshot for a pay period
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
          display: "grid",
          gap: 14,
        }}
      >

       <label style={{ display: "grid", gap: 6, maxWidth: 220 }}>
  <span style={{ fontSize: 13, fontWeight: 600 }}>Preset</span>
  <select
    value={preset}
    onChange={(e) => applyPreset(e.target.value)}
    style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
  >
    <option value="">Custom</option>
    <option value="THIS_WEEK">This Week</option>
    <option value="LAST_WEEK">Last Week</option>
    <option value="LAST_2_WEEKS">Last 2 Weeks</option>
    <option value="LAST_7_DAYS">Last 7 Days</option>
  </select>
</label>       

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Period Start</span>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => {setPreset(""); setPeriodStart(e.target.value)}}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Period End</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => {setPreset(""); setPeriodEnd(e.target.value)}}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this payroll run"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
        </label>

        <div
          style={{
            border: "1px solid #eee",
            borderRadius: 10,
            padding: 12,
            background: "#fafafa",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          This will include time entries in the selected pay period that are currently
          <b> APPROVED </b>
          or
          <b> LOCKED</b>, and create immutable payroll snapshots.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={finalizeRun}
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Finalizing..." : "Finalize Payroll Run"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin/payroll-runs")}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "#fff",
              fontWeight: 700,
            }}
          >
            Back to Payroll Runs
          </button>
        </div>

        {ok ? <div style={{ color: "#0a7a2f", fontSize: 13 }}>{ok}</div> : null}
        {err ? <div style={{ color: "#b00020", fontSize: 13 }}>{err}</div> : null}
      </div>
    </div>
  );
}
