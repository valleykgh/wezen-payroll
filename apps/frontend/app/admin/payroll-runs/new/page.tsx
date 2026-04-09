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
    paidEarlyCents?: number;
  overpaidCents?: number;
  underpaidCents?: number;
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
  carryForwardOverpaidCents: number;
    overpaidCents?: number;
  underpaidCents?: number;
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

function minutesToDecimalHours(min: number) {
  const m = Math.max(0, Number(min || 0));
  return (m / 60).toFixed(2);
}

function employeeLabel(emp?: PreviewEmployee["employee"] | null) {
  if (!emp) return "Unknown";
  return emp.preferredName ? `${emp.legalName} (${emp.preferredName})` : emp.legalName;
}

function earlyPaidCentsForEmp(emp: any) {
  return Number(emp?.paidEarlyCents ?? emp?.earlyPayment?.amountCents ?? 0);
}

function remainingCentsForEmp(emp: any) {
  return Number(emp?.underpaidCents ?? 0);
}

function overpaidCentsForEmp(emp: any) {
  return Number(emp?.overpaidCents ?? 0);
}

function isFullyCoveredEarly(emp: any) {
  return Number(emp?.underpaidCents ?? 0) <= 0 && Number(emp?.grossPayCents || 0) > 0;
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

function startEarlyPayEdit(emp: any) {
  setEditingEmployeeId(emp.employeeId);

  const grossCents = Number(emp?.grossPayCents || 0);
  const remainingCents = Number(emp?.underpaidCents || 0);
  const overpaidCents = Number(emp?.overpaidCents || 0);

  let suggestedCents = 0;

  if (!emp?.earlyPayment) {
    suggestedCents = grossCents;
  } else if (remainingCents > 0) {
    suggestedCents = remainingCents;
  } else if (overpaidCents > 0) {
    suggestedCents = 0;
  } else {
    suggestedCents = 0;
  }

  setEarlyAmount(suggestedCents > 0 ? (suggestedCents / 100).toFixed(2) : "");
  setEarlyNote(emp?.earlyPayment?.note || "");
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
      setErr("Enter a valid payment amount greater than zero.");
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

const previewGrossCents = Number(preview?.totals?.grossPayCents || 0);
const previewPaidEarlyCents = Number(preview?.totals?.paidEarlyCents || 0);
const previewRemainingCents = Number(preview?.totals?.underpaidCents || 0);
const previewOverpaidCents = Number(preview?.totals?.overpaidCents || 0);
  return (
      <div style={{ padding: 0, maxWidth: 1200, margin: "0 auto" }}>
      <h1
  style={{
    margin: 0,
    fontSize: 30,
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  }}
>
  Finalize Payroll Run
</h1>
        <div style={{ color: "#475569", marginTop: 8, fontSize: 15 }}>
	Preview payroll, mark paid early, then create a frozen payroll snapshot
      </div>

      <div
        style={{
          marginTop: 16,
          border: "1px solid #e2e8f0",
borderRadius: 24,
padding: 20,
background: "#ffffff",
boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
	   display: "grid",
          gap: 14,
        }}
      >
        <label style={{ display: "grid", gap: 6, maxWidth: 220 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Preset</span>
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
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
               style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
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
               style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	    />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this payroll run"
            style={{
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
}}
	  />
        </label>

        <div
          style={{
            border: "1px solid #e2e8f0",
borderRadius: 16,
padding: 14,
background: "#f8fafc",
	    fontSize: 13,
            lineHeight: 1.6,
	    color: "#475569",
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
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid #cbd5e1",
background: "#ffffff",
color: "#0f172a",
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
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid #0f172a",
background: "#0f172a",
color: "#ffffff",
fontWeight: 700,
opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Finalizing..." : "Finalize Payroll Run"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/admin/payroll-runs")}
            style={{
              padding: "10px 16px",
              borderRadius:999,
              border: "1px solid #cbd5e1",
background: "#ffffff",
color: "#0f172a",	
fontWeight: 700,
            }}
          >
            Back to Payroll Runs
          </button>
        </div>

      {ok ? (
  <div
    style={{
      color: "#166534",
      fontSize: 13,
      background: "#f0fdf4",
      border: "1px solid #86efac",
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    {ok}
  </div>
) : null}

{err ? (
  <div
    style={{
      color: "#b91c1c",
      fontSize: 13,
      background: "#fef2f2",
      border: "1px solid #fecaca",
      borderRadius: 12,
      padding: "10px 12px",
    }}
  >
    {err}
  </div>
) : null}


	</div>

      {preview ? (
        <>
          <div
            style={{
              marginTop: 16,
              border: "1px solid #e2e8f0",
borderRadius: 24,
padding: 20,
background: "#ffffff",
boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
	    }}
          >
              <div style={{ fontWeight: 800, marginBottom: 14, fontSize: 22, color: "#0f172a" }}>
	      Payroll Preview Summary
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(160px, 1fr))",
                gap: 12,
              }}
            >
              <SummaryCard label="Employees" value={String(preview.totals.employeeCount)} />
              <SummaryCard label="Gross Payroll" value={dollars(previewGrossCents)} />
	      <SummaryCard label="Paid Early Count" value={String(preview.totals.paidEarlyCount)} />
	      <SummaryCard label="Paid Early Amount" value={dollars(previewPaidEarlyCents)} />
	      <SummaryCard label="Remaining Payroll" value={dollars(previewRemainingCents)} />
	      <SummaryCard label="Overpaid" value={dollars(previewOverpaidCents)} />
            </div>
          </div>

	   <div
  style={{
    marginTop: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 20,
    background: "#ffffff",
    boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
  }}
>	            

	    <div style={{ fontWeight: 800, marginBottom: 12, fontSize: 18 }}>
              Employee Payroll Preview
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1200 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>  
		    <th style={th}>Employee</th>
                    <th style={th}>Title</th>
                    <th style={th}>Entries</th>
                    <th style={th}>Payable</th>
                    <th style={th}>Reg</th>
                    <th style={th}>OT</th>
                    <th style={th}>DT</th>
                    <th style={th}>Gross</th>
                    <th style={th}>Status</th>
                    <th style={th}>Early Pay Summary</th>
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
                            <div style={{ fontSize: 12, color: "#475569" }}>{emp.employee?.email || "-"}</div>
			  </td>
                          <td style={td}>{emp.employee?.title || "-"}</td>
                          <td style={td}>{emp.entryCount}</td>
                          <td style={td}>{minutesToDecimalHours(emp.payableMinutes)}</td>
                          <td style={td}>{minutesToDecimalHours(emp.regularMinutes)}</td>
                          <td style={td}>{minutesToDecimalHours(emp.overtimeMinutes)}</td>
                          <td style={td}>{minutesToDecimalHours(emp.doubleMinutes)}</td>
                          <td style={td}>
                            <b>{dollars(emp.grossPayCents)}</b>
                          </td>
                                

<td style={td}>
  {Number(emp.paidEarlyCents || 0) > 0 && (
    <div>
      <div>Paid Early: {dollars(Number(emp.paidEarlyCents || 0))}</div>
      {Number(emp.overpaidCents || 0) > 0 && (
        <div style={{ color: "#b91c1c" }}>
          Overpayment: {dollars(Number(emp.overpaidCents || 0))}
        </div>
      )}
      {Number(emp.underpaidCents || 0) > 0 && (
        <div style={{ color: "#065f46" }}>
          Remaining: {dollars(Number(emp.underpaidCents || 0))}
        </div>
      )}
    </div>
  )}
</td>

<td style={td}>
  {emp.earlyPayment ? (
    <div>
      <div>
        <b>{dollars(earlyPaidCentsForEmp(emp))}</b> paid early
      </div>

      {overpaidCentsForEmp(emp) > 0 && (
        <div style={{ fontSize: 12, color: "#b91c1c" }}>
          Overpayment to deduct: {dollars(overpaidCentsForEmp(emp))}
        </div>
      )}

      <div style={{ fontSize: 12, color: "#065f46", fontWeight: 700 }}>
        Remaining to pay: {dollars(remainingCentsForEmp(emp))}
      </div>

      {emp.earlyPayment.note && (
      <div style={{ fontSize: 12, color: "#475569" }}>
  {emp.earlyPayment.note}
</div>
	)}
    </div>
  ) : (
    "-"
  )}
</td>

<td style={td}>
  {Number(emp.underpaidCents || 0) > 0 ? (
    <button
      type="button"
      onClick={() => startEarlyPayEdit(emp)}
      style={actionBtn}
    >
      Pay Now
    </button>
  ) : Number(emp.overpaidCents || 0) > 0 ? (
    <span style={{ color: "#b91c1c", fontWeight: 700 }}>
      Recover {dollars(Number(emp.overpaidCents || 0))} next payroll
    </span>
  ) : Number(emp.paidEarlyCents || 0) > 0 ? (
    <button
      type="button"
      onClick={() => startEarlyPayEdit(emp)}
      style={secondaryBtn}
    >
      View / Replace
    </button>
  ) : (
    <button
      type="button"
      onClick={() => startEarlyPayEdit(emp)}
      style={actionBtn}
    >
      Mark Paid Early
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
 				<div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}> 
				Payment To Add Now ($)
				</div> 
 				 <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>
				 Already paid: {dollars(earlyPaidCentsForEmp(emp))} ·
 				 Remaining: {dollars(remainingCentsForEmp(emp))} ·
 				 Overpaid: {dollars(overpaidCentsForEmp(emp))}
				</div>
				 <input
                                    value={earlyAmount}
                                    onChange={(e) => setEarlyAmount(e.target.value)}
                                    placeholder="e.g. 500.00"
                                    style={inputStyle}
                                  />
                                </div>

                                <div>
                                 <div style={{ fontSize: 12, color: "#475569", marginBottom: 6 }}>   
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
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        padding: 16,
        background: "#f8fafc",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6, fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>{value}</div>
    </div>
  );
}
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  verticalAlign: "top",
  color: "#0f172a",
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: 14,
  background: "#ffffff",
  color: "#0f172a",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
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
  padding: "10px 16px",
  borderRadius: 999,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
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
