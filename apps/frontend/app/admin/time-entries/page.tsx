// apps/frontend/app/admin/time-entries/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

type EntryStatus = "DRAFT" | "APPROVED" | "LOCKED";

type EmployeeLite = {
  id: string;
  legalName: string;
  preferredName?: string | null;
  email?: string | null;
};

type FacilityLite = {
  id: string;
  name: string;
};

type EntryRow = {
  id: string;
  employeeId: string;
  workDate: string; // ISO
  facilityId: string | null;
  shiftType: string;
  status: EntryStatus;
  minutesWorked?: number | null;
  breakMinutes?: number | null;
  computedBreakMinutes?: number | null; // your API sets this
  payableMinutes?: number | null; // your API sets this
  totalHours_HHMM?: string | null; // your API sets this
  calculatedHours_decimal?: number | null; // your API sets this
  notes?: string | null;

  employee?: EmployeeLite | null;
  facility?: FacilityLite | null;
};

type ListResp = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  entries: EntryRow[];
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

function formatEmployeeName(e?: EmployeeLite | null) {
  if (!e) return "Unknown";
  const pref = e.preferredName ? ` (${e.preferredName})` : "";
  return `${e.legalName}${pref}`;
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.floor(min || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

export default function AdminTimeEntriesWeekPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // default pay period: last 7 days
  const [from, setFrom] = useState(() => addDaysISO(todayISO(), -6));
  const [to, setTo] = useState(() => todayISO());

  const [status, setStatus] = useState<string>("ALL");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  // selection
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // optional: allow deep-link: ?employeeId=...
  useEffect(() => {
    const eid = searchParams.get("employeeId");
    if (eid) setSelectedEmployeeId(eid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);
      // IMPORTANT: for sidebar UX we want ALL employees; keep pagination huge
      qs.set("page", "1");
      qs.set("pageSize", "100");

      if (status && status !== "ALL") qs.set("status", status);

      // We DO NOT pass q to server by default because we want all employees in sidebar.
      // (We filter sidebar locally.) If later you want server-side search, you can add a toggle.

      const data = await apiFetch<ListResp>(`/api/admin/time-entries?${qs.toString()}`);
      setEntries(data.entries || []);

      // auto-select first employee with entries if none selected (or selection not in results)
      const empIds = Array.from(
        new Set((data.entries || []).map((e) => e.employeeId).filter(Boolean))
      );

      if (empIds.length > 0) {
        if (!selectedEmployeeId || !empIds.includes(selectedEmployeeId)) {
          setSelectedEmployeeId(empIds[0]);
        }
      } else {
        setSelectedEmployeeId(null);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load time entries");
    } finally {
      setLoading(false);
    }
  }

  // Build employee groups
  const byEmployee = useMemo(() => {
    const map = new Map<
      string,
      { employee: EmployeeLite | null; entries: EntryRow[]; totals: { payableMinutes: number } }
    >();

    for (const e of entries) {
      const key = e.employeeId;
      if (!key) continue;

      const cur =
        map.get(key) || { employee: e.employee ?? null, entries: [], totals: { payableMinutes: 0 } };

      cur.employee = cur.employee || e.employee || null;
      cur.entries.push(e);

      const payable =
        typeof e.payableMinutes === "number"
          ? e.payableMinutes
          : Math.max(
              0,
              Number(e.minutesWorked ?? 0) -
                Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0)
            );

      cur.totals.payableMinutes += payable;

      map.set(key, cur);
    }

    // sort entries inside each employee
    for (const [_, v] of map) {
      v.entries.sort((a, b) => String(a.workDate).localeCompare(String(b.workDate)));
    }

    return map;
  }, [entries]);

  const employeeRows = useMemo(() => {
    const arr = Array.from(byEmployee.entries()).map(([employeeId, v]) => {
      const name = formatEmployeeName(v.employee);
      const email = v.employee?.email || "";
      return {
        employeeId,
        employee: v.employee,
        name,
        email,
        entryCount: v.entries.length,
        payableMinutes: v.totals.payableMinutes,
      };
    });

    // sort by name
    arr.sort((a, b) => a.name.localeCompare(b.name));

    // local sidebar filter
    const s = q.trim().toLowerCase();
    if (!s) return arr;
    return arr.filter((x) => {
      return (
        x.name.toLowerCase().includes(s) ||
        (x.email || "").toLowerCase().includes(s) ||
        x.employeeId.toLowerCase().includes(s)
      );
    });
  }, [byEmployee, q]);

  const selected = selectedEmployeeId ? byEmployee.get(selectedEmployeeId) : null;

  // load once by default
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ display: "flex", height: "calc(100vh - 80px)" }}>
      {/* LEFT SIDEBAR */}
      <aside
        style={{
          width: 340,
          borderRight: "1px solid #eee",
          padding: 12,
          overflow: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Time Entries (Week)</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>From</span>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                style={{ padding: 8 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>To</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                style={{ padding: 8 }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, color: "#666" }}>Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{ padding: 8 }}
              >
                <option value="ALL">ALL</option>
                <option value="DRAFT">DRAFT</option>
                <option value="APPROVED">APPROVED</option>
                <option value="LOCKED">LOCKED</option>
              </select>
            </label>

            <button
              onClick={load}
              disabled={loading}
              style={{
                marginTop: 18,
                padding: 10,
                fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading..." : "Load"}
            </button>
          </div>

          <input
            placeholder="Search employee name/email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ padding: 10, marginTop: 6 }}
          />

          {error ? (
            <div style={{ color: "crimson", fontSize: 13, whiteSpace: "pre-wrap" }}>{error}</div>
          ) : null}

          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>
            Employees with entries: <b>{employeeRows.length}</b>
          </div>
        </div>

        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {employeeRows.map((x) => {
            const active = x.employeeId === selectedEmployeeId;
            return (
              <button
                key={x.employeeId}
                onClick={() => {
                  setSelectedEmployeeId(x.employeeId);
                  router.replace(`/admin/time-entries?employeeId=${encodeURIComponent(x.employeeId)}`);
                }}
                style={{
                  textAlign: "left",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid #ddd",
                  background: active ? "#f5f5f5" : "white",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{x.name}</div>
                <div style={{ fontSize: 12, color: "#666" }}>{x.email}</div>

                <div style={{ display: "flex", gap: 10, marginTop: 6, fontSize: 12 }}>
                  <span>
                    Entries: <b>{x.entryCount}</b>
                  </span>
                  <span>
                    Payable: <b>{minutesToHHMM(x.payableMinutes)}</b>
                  </span>
                </div>
              </button>
            );
          })}

          {employeeRows.length === 0 && !loading ? (
            <div style={{ color: "#666", padding: 10 }}>
              No entries found for this pay period.
            </div>
          ) : null}
        </div>
      </aside>

      {/* MAIN PANEL */}
      <main style={{ flex: 1, padding: 16, overflow: "auto" }}>
        {!selectedEmployeeId ? (
          <div style={{ padding: 16, color: "#666" }}>
            Select a pay period and load entries.
          </div>
        ) : !selected ? (
          <div style={{ padding: 16, color: "#666" }}>
            Employee not found in current results.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>
                  {formatEmployeeName(selected.employee)}
                </div>
                <div style={{ color: "#666" }}>{selected.employee?.email}</div>
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  Pay period: <b>{from}</b> → <b>{to}</b>
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 13, color: "#666" }}>Payable total</div>
                <div style={{ fontSize: 22, fontWeight: 900 }}>
                  {minutesToHHMM(selected.totals.payableMinutes)}
                </div>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #eee" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {selected.entries.map((e) => {
                const workDate = new Date(e.workDate).toISOString().slice(0, 10);
                const payable =
                  typeof e.payableMinutes === "number"
                    ? e.payableMinutes
                    : Math.max(
                        0,
                        Number(e.minutesWorked ?? 0) -
                          Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0)
                      );

                return (
                  <div
                    key={e.id}
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {workDate} • {e.shiftType} • {e.facility?.name || "Facility"}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                        Status: <b>{e.status}</b> • Worked:{" "}
                        <b>{minutesToHHMM(Number(e.minutesWorked ?? 0))}</b> • Breaks:{" "}
                        <b>{minutesToHHMM(Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0))}</b> • Payable:{" "}
                        <b>{minutesToHHMM(payable)}</b>
                      </div>
                      {e.notes ? (
                        <div style={{ marginTop: 6, fontSize: 13 }}>
                          Notes: <span style={{ color: "#444" }}>{e.notes}</span>
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        onClick={() => router.push(`/admin/time-entry/${e.id}`)}
                        style={{ padding: "10px 12px", fontWeight: 800, cursor: "pointer" }}
                      >
                        Edit
                      </button>

                      {/* optional quick view */}
                      <button
                        onClick={async () => {
                          try {
                            const data = await apiFetch<{ entry: any }>(`/api/admin/time-entry/${e.id}`);
                            alert(
                              `Entry ${data.entry.id}\n\npunchesJson: ${
                                Array.isArray(data.entry.punchesJson) ? data.entry.punchesJson.length : 0
                              }\nbreaksJson: ${
                                Array.isArray(data.entry.breaksJson) ? data.entry.breaksJson.length : 0
                              }`
                            );
                          } catch (err: any) {
                            alert(err?.message || "Failed");
                          }
                        }}
                        style={{ padding: "10px 12px", cursor: "pointer" }}
                      >
                        Debug JSON
                      </button>
                    </div>
                  </div>
                );
              })}

              {selected.entries.length === 0 ? (
                <div style={{ color: "#666", padding: 10 }}>No entries for this employee.</div>
              ) : null}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
