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

type PreviewEmployee = {
  employeeId: string;
  employee: {
    id: string;
    legalName: string;
    preferredName?: string | null;
    email?: string | null;
    hourlyRateCents: number;
    title?: string | null;
    active?: boolean;
  };
  entryCount: number;
  workedMinutes: number;
  breakMinutes: number;
  payableMinutes: number;
  regularMinutes: number;
  overtimeMinutes: number;
  doubleMinutes: number;
  grossPayCents: number;
  payStatus: "READY" | "PAID_EARLY";
  earlyPayment: null | {
    id: string;
    employeeId: string;
    amountCents: number;
    paidAt: string;
    note?: string | null;
  };
};

type PreviewResp = {
  periodStart: string;
  periodEnd: string;
  employees: PreviewEmployee[];
  totals: {
    employeeCount: number;
    grossPayCents: number;
    paidEarlyCount: number;
    paidEarlyCents: number;
    remainingCount: number;
    remainingGrossPayCents: number;
  };
};

function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getPreviousPayrollWeek() {
  const today = new Date();
  const day = today.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;

  const thisWeekMonday = new Date(today);
  thisWeekMonday.setHours(0, 0, 0, 0);
  thisWeekMonday.setDate(today.getDate() - daysSinceMonday);

  const prevMonday = new Date(thisWeekMonday);
  prevMonday.setDate(thisWeekMonday.getDate() - 7);

  const prevSunday = new Date(prevMonday);
  prevSunday.setDate(prevMonday.getDate() + 6);

  return {
    periodStart: toISODate(prevMonday),
    periodEnd: toISODate(prevSunday),
  };
}

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

function dollars(cents: number) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.floor(min || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function employeeLabel(emp?: PreviewEmployee["employee"] | null) {
  if (!emp) return "Unknown";
  return emp.preferredName ? `${emp.legalName} (${emp.preferredName})` : emp.legalName;
}

export default function AdminFinalizePayrollRunPage() {
  const router = useRouter();

  const [preset, setPreset] = useState("");
  const [periodStart, setPeriodStart] = useState("");
const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingEarly, setSavingEarly] = useState<string>("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const [preview, setPreview] = useState<PreviewResp | null>(null);

  const [editingEmployeeId, setEditingEmployeeId] = useState<string>("");
  const [earlyAmount, setEarlyAmount] = useState("");
  const [earlyNote, setEarlyNote] = useState("");

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

  async function loadPreview() {
    setErr("");
    setOk("");

    if (!periodStart || !periodEnd) {
      setErr("Please select period start and period end.");
      return;
    }

    setPreviewLoading(true);
    try {
      const qs = new URLSearchParams({
        periodStart,
        periodEnd,
      });

      const resp = await apiFetch<PreviewResp>(
        `/api/admin/payroll-runs/preview?${qs.toString()}`
      );

      setPreview(resp);
    } catch (e: any) {
      setErr(e?.message || "Failed to load payroll preview");
    } finally {
      setPreviewLoading(false);
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

  function startEarlyPayEdit(emp: PreviewEmployee) {
    setEditingEmployeeId(emp.employeeId);
    setEarlyAmount(
      emp.earlyPayment ? (Number(emp.earlyPayment.amountCents || 0) / 100).toFixed(2) : ""
    );
    setEarlyNote(emp.earlyPayment?.note || "");
    setErr("");
    setOk("");
  }

  function cancelEarlyPayEdit() {
    setEditingEmployeeId("");
    setEarlyAmount("");
    setEarlyNote("");
  }

  async function saveEarlyPayment(employeeId: string) {
    setErr("");
    setOk("");

    if (!periodStart || !periodEnd) {
      setErr("Please choose payroll period first.");
      return;
    }

    const amountCents = Math.round(Number(earlyAmount || 0) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setErr("Enter a valid early payment amount greater than zero.");
      return;
    }

      const pin = window.prompt("Enter Admin PIN");
if (!pin) return;

setSavingEarly(employeeId);

try {
  await apiFetch("/api/admin/early-payroll", {
    method: "POST",
    body: JSON.stringify({
      employeeId,
      periodStart,
      periodEnd,
      amountCents,
      note: earlyNote.trim() || undefined,
      pin,
    }),
  });

      setOk("Early payroll payment saved.");
      cancelEarlyPayEdit();
      await loadPreview();
    } catch (e: any) {
      setErr(e?.message || "Failed to save early payroll payment");
    } finally {
      setSavingEarly("");
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 24 }}>Finalize Payroll Run</h1>
      <div style={{ color: "#666", marginTop: 4 }}>
        Preview payroll, mark paid early, then create a frozen payroll snapshot
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
              onChange={(e) => {
                setPreset("");
                setPeriodStart(e.target.value);
              }}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Period End</span>
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => {
                setPreset("");
                setPeriodEnd(e.target.value);
              }}
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
          <b> LOCKED</b>. You can also mark employees as <b>Paid Early</b> before finalizing.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={loadPreview}
            disabled={previewLoading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#fff",
              color: "#111",
              fontWeight: 700,
              cursor: previewLoading ? "not-allowed" : "pointer",
            }}
          >
            {previewLoading ? "Loading Preview..." : "Load Preview"}
          </button>

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

      {preview ? (
        <>
          <div
            style={{
              marginTop: 16,
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 18 }}>
              Payroll Preview Summary
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              <SummaryCard label="Employees" value={String(preview.totals.employeeCount)} />
              <SummaryCard label="Gross Payroll" value={dollars(preview.totals.grossPayCents)} />
              <SummaryCard label="Paid Early Count" value={String(preview.totals.paidEarlyCount)} />
              <SummaryCard label="Paid Early Amount" value={dollars(preview.totals.paidEarlyCents)} />
              <SummaryCard
                label="Remaining Payroll"
                value={dollars(preview.totals.remainingGrossPayCents)}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 16,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 18 }}>
              Employee Payroll Preview
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    <th style={th}>Employee</th>
                    <th style={th}>Title</th>
                    <th style={th}>Entries</th>
                    <th style={th}>Payable</th>
                    <th style={th}>Reg</th>
                    <th style={th}>OT</th>
                    <th style={th}>DT</th>
                    <th style={th}>Gross</th>
                    <th style={th}>Status</th>
                    <th style={th}>Early Paid</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.employees.map((emp) => {
                    const isEditing = editingEmployeeId === emp.employeeId;

                    return (
                      <React.Fragment key={emp.employeeId}>
                        <tr>
                          <td style={td}>
                            <div style={{ fontWeight: 700 }}>{employeeLabel(emp.employee)}</div>
                            <div style={{ fontSize: 12, color: "#666" }}>{emp.employee?.email || "-"}</div>
                          </td>
                          <td style={td}>{emp.employee?.title || "-"}</td>
                          <td style={td}>{emp.entryCount}</td>
                          <td style={td}>{minutesToHHMM(emp.payableMinutes)}</td>
                          <td style={td}>{minutesToHHMM(emp.regularMinutes)}</td>
                          <td style={td}>{minutesToHHMM(emp.overtimeMinutes)}</td>
                          <td style={td}>{minutesToHHMM(emp.doubleMinutes)}</td>
                          <td style={td}>
                            <b>{dollars(emp.grossPayCents)}</b>
                          </td>
                          <td style={td}>
                            {emp.payStatus === "PAID_EARLY" ? (
                              <span style={paidEarlyBadge}>PAID EARLY</span>
                            ) : (
                              <span style={readyBadge}>READY</span>
                            )}
                          </td>
                          <td style={td}>
                            {emp.earlyPayment ? (
                              <div>
                                <div>
                                  <b>{dollars(emp.earlyPayment.amountCents)}</b>
                                </div>
                                <div style={{ fontSize: 12, color: "#666" }}>
                                  {emp.earlyPayment.note || "-"}
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td style={td}>
                            {!emp.earlyPayment ? (
                              <button
                                type="button"
                                onClick={() => startEarlyPayEdit(emp)}
                                style={actionBtn}
                              >
                                Mark Paid Early
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEarlyPayEdit(emp)}
                                style={secondaryBtn}
                              >
                                View / Replace
                              </button>
                            )}
                          </td>
                        </tr>

                        {isEditing ? (
                          <tr>
                            <td style={{ ...td, background: "#fafafa" }} colSpan={11}>
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "220px 1fr auto auto",
                                  gap: 10,
                                  alignItems: "end",
                                }}
                              >
                                <div>
                                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                                    Early Payment Amount ($)
                                  </div>
                                  <input
                                    value={earlyAmount}
                                    onChange={(e) => setEarlyAmount(e.target.value)}
                                    placeholder="e.g. 500.00"
                                    style={inputStyle}
                                  />
                                </div>

                                <div>
                                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                                    Note
                                  </div>
                                  <input
                                    value={earlyNote}
                                    onChange={(e) => setEarlyNote(e.target.value)}
                                    placeholder="Optional note"
                                    style={{ ...inputStyle, width: "100%" }}
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => saveEarlyPayment(emp.employeeId)}
                                  disabled={savingEarly === emp.employeeId}
                                  style={actionBtn}
                                >
                                  {savingEarly === emp.employeeId ? "Saving..." : "Save"}
                                </button>

                                <button type="button" onClick={cancelEarlyPayEdit} style={secondaryBtn}>
                                  Cancel
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    );
                  })}

                  {preview.employees.length === 0 ? (
                    <tr>
                      <td style={td} colSpan={11}>
                        No employees found in preview.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #eee",
        borderRadius: 10,
        padding: 12,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #ddd",
  fontSize: 13,
};

const td: React.CSSProperties = {
  padding: "10px 12px",
  borderBottom: "1px solid #eee",
  fontSize: 13,
  verticalAlign: "top",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: 10,
  border: "1px solid #ccc",
  borderRadius: 8,
};

const actionBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #111",
  background: "#111",
  color: "#fff",
  fontWeight: 700,
  cursor: "pointer",
};

const secondaryBtn: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ccc",
  background: "#fff",
  color: "#111",
  fontWeight: 700,
  cursor: "pointer",
};

const paidEarlyBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#ecfdf5",
  color: "#065f46",
  border: "1px solid #a7f3d0",
  fontSize: 12,
  fontWeight: 700,
};

const readyBadge: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 8px",
  borderRadius: 999,
  background: "#f3f4f6",
  color: "#374151",
  border: "1px solid #e5e7eb",
  fontSize: 12,
  fontWeight: 700,
};
