"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

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
  workDate: string;
  facilityId: string | null;
  shiftType: string;
  status: EntryStatus;
  minutesWorked?: number | null;
  breakMinutes?: number | null;
  computedBreakMinutes?: number | null;
  payableMinutes?: number | null;
  totalHours_HHMM?: string | null;
  calculatedHours_decimal?: number | null;
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

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.floor(min || 0));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${hh}:${String(mm).padStart(2, "0")}`;
}

function formatEmployeeName(e?: EmployeeLite | null) {
  if (!e) return "Unknown";
  return e.preferredName ? `${e.legalName} (${e.preferredName})` : e.legalName;
}

function startOfWeekISO(baseISO?: string) {
  const d = baseISO ? new Date(`${baseISO}T00:00:00`) : new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day; // make Monday the start
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeekISO(baseISO?: string) {
  return addDaysISO(startOfWeekISO(baseISO), 6);
}

export default function AdminTimeEntriesWeekPage() {
  const [from, setFrom] = useState(() => addDaysISO(todayISO(), -6));
  const [to, setTo] = useState(() => todayISO());

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [preset, setPreset] = useState("");
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
    const [rowStatusFilter, setRowStatusFilter] = useState<"ALL" | EntryStatus>("ALL");  
  function applyPreset(value: string) {
  setPreset(value);

  if (value === "THIS_WEEK") {
    setFrom(startOfWeekISO());
    setTo(endOfWeekISO());
    return;
  }

  if (value === "LAST_WEEK") {
    const thisWeekStart = startOfWeekISO();
    const lastWeekStart = addDaysISO(thisWeekStart, -7);
    setFrom(lastWeekStart);
    setTo(addDaysISO(lastWeekStart, 6));
    return;
  }

  if (value === "LAST_2_WEEKS") {
    const thisWeekStart = startOfWeekISO();
    const start = addDaysISO(thisWeekStart, -14);
    const end = addDaysISO(thisWeekStart, -1);
    setFrom(start);
    setTo(end);
    return;
  }

  if (value === "LAST_7_DAYS") {
    setFrom(addDaysISO(todayISO(), -6));
    setTo(todayISO());
    return;
  }
}
  async function load() {
    setLoading(true);
    setErr("");

    try {
      const qs = new URLSearchParams();
      qs.set("from", from);
      qs.set("to", to);
      qs.set("page", "1");
      qs.set("pageSize", "500");

      const data = await apiFetch<ListResp>(`/api/admin/time-entries?${qs.toString()}`);
      const list = data.entries || [];
      setEntries(list);
      setEmployeeSearch("");
      const employeeIds = Array.from(new Set(list.map((e) => e.employeeId).filter(Boolean)));
      setSelectedEmployeeId((prev) => {
        if (prev && employeeIds.includes(prev)) return prev;
        return employeeIds[0] || "";
      });
    } catch (e: any) {
      setErr(e?.message || "Failed to load entries");
      setEntries([]);
      setSelectedEmployeeId("");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);
  
  const byEmployee = useMemo(() => {
    const map = new Map<
      string,
      {
        employee: EmployeeLite | null;
        entries: EntryRow[];
        payableMinutes: number;
        draftCount: number;
        approvedCount: number;
        lockedCount: number;
      }
    >();

    for (const e of entries) {
      const key = e.employeeId;
      if (!key) continue;

      const cur =
        map.get(key) || {
          employee: e.employee ?? null,
          entries: [],
          payableMinutes: 0,
          draftCount: 0,
          approvedCount: 0,
          lockedCount: 0,
        };

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

      cur.payableMinutes += payable;

      if (e.status === "LOCKED") cur.lockedCount += 1;
      else if (e.status === "APPROVED") cur.approvedCount += 1;
      else cur.draftCount += 1;

      map.set(key, cur);
    }

    for (const [, value] of map) {
      value.entries.sort((a, b) => String(a.workDate).localeCompare(String(b.workDate)));
    }

    return map;
  }, [entries]);

const employeeRows = useMemo(() => {
  const rows = Array.from(byEmployee.entries())
    .map(([employeeId, value]) => ({
      employeeId,
      employee: value.employee,
      entries: value.entries,
      payableMinutes: value.payableMinutes,
      draftCount: value.draftCount,
      approvedCount: value.approvedCount,
      lockedCount: value.lockedCount,
    }))
    .sort((a, b) =>
      formatEmployeeName(a.employee).localeCompare(formatEmployeeName(b.employee))
    );

  const q = employeeSearch.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const name = formatEmployeeName(row.employee).toLowerCase();
    const email = String(row.employee?.email || "").toLowerCase();
    return name.includes(q) || email.includes(q);
  });
}, [byEmployee, employeeSearch]);
const selected = selectedEmployeeId ? byEmployee.get(selectedEmployeeId) : null;
  
const filteredSelectedEntries = useMemo(() => {
  if (!selected) return [];
  if (rowStatusFilter === "ALL") return selected.entries;
  return selected.entries.filter((e) => e.status === rowStatusFilter);
}, [selected, rowStatusFilter]);

  const filteredSelectedSummary = useMemo(() => {
    let workedMinutes = 0;
    let breakMinutes = 0;
    let payableMinutes = 0;

    for (const e of filteredSelectedEntries) {
      const worked = Number(e.minutesWorked ?? 0);
      const breakMins = Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0);
      const payable =
        typeof e.payableMinutes === "number"
          ? e.payableMinutes
          : Math.max(0, worked - breakMins);

      workedMinutes += worked;
      breakMinutes += breakMins;
      payableMinutes += payable;
    }

    return {
      rowCount: filteredSelectedEntries.length,
      workedMinutes,
      breakMinutes,
      payableMinutes,
    };
  }, [filteredSelectedEntries]);

  const draftEntryIdsForSelected = useMemo(() => {
    if (!selected) return [];
    return selected.entries.filter((e) => e.status === "DRAFT").map((e) => e.id);
  }, [selected]);

  const approvableEntryIdsForSelected = useMemo(() => {
    if (!selected) return [];
    return selected.entries
      .filter((e) => e.status === "DRAFT" || e.status === "APPROVED")
      .map((e) => e.id);
  }, [selected]);

  const approvedEntryIdsForSelected = useMemo(() => {
    if (!selected) return [];
    return selected.entries.filter((e) => e.status === "APPROVED").map((e) => e.id);
  }, [selected]);

const allSelectedVisible =
    filteredSelectedEntries.length > 0 &&
    filteredSelectedEntries.every((e) => selectedEntryIds.includes(e.id));



useEffect(() => {
  const validIds = new Set((selected?.entries || []).map((e) => e.id));
  setSelectedEntryIds((prev) => prev.filter((id) => validIds.has(id)));
}, [selected]);

function toggleEntry(id: string) {
  setSelectedEntryIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
}

   function toggleSelectAllVisible() {
    const ids = filteredSelectedEntries.map((e) => e.id);
    if (ids.length === 0) return;

    setSelectedEntryIds((prev) => {
      const allAlreadySelected = ids.every((id) => prev.includes(id));
      if (allAlreadySelected) {
        return prev.filter((id) => !ids.includes(id));
      }
      return Array.from(new Set([...prev, ...ids]));
    });
  } 

 const selectedSummary = useMemo(() => {
    if (!selected) {
      return {
        workedMinutes: 0,
        breakMinutes: 0,
        payableMinutes: 0,
        draftCount: 0,
        approvedCount: 0,
        lockedCount: 0,
      };
    }

    let workedMinutes = 0;
    let breakMinutes = 0;
    let payableMinutes = 0;
    let draftCount = 0;
    let approvedCount = 0;
    let lockedCount = 0;

    for (const e of selected.entries) {
      const worked = Number(e.minutesWorked ?? 0);
      const breakMins = Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0);
      const payable =
        typeof e.payableMinutes === "number"
          ? e.payableMinutes
          : Math.max(0, worked - breakMins);

      workedMinutes += worked;
      breakMinutes += breakMins;
      payableMinutes += payable;

      if (e.status === "LOCKED") lockedCount += 1;
      else if (e.status === "APPROVED") approvedCount += 1;
      else draftCount += 1;
    }

    return {
      workedMinutes,
      breakMinutes,
      payableMinutes,
      draftCount,
      approvedCount,
      lockedCount,
    };
  }, [selected]);

  
  async function approveWeekForSelected() {
    if (!selectedEmployeeId) return;

    const ok = window.confirm("Approve this employee's entries for the selected pay period?");
    if (!ok) return;

    try {
      setLoading(true);
      await apiFetch("/api/admin/time-entry/approve-week", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          startDate: from,
          endDate: to,
        }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to approve week");
    } finally {
      setLoading(false);
    }
  }

  async function lockWeekForSelected() {
    if (!selectedEmployeeId) return;

    const ok = window.confirm("Lock this employee's entries for the selected pay period?");
    if (!ok) return;

    try {
      setLoading(true);
      await apiFetch("/api/admin/time-entry/lock-week", {
        method: "POST",
        body: JSON.stringify({
          employeeId: selectedEmployeeId,
          startDate: from,
          endDate: to,
        }),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to lock week");
    } finally {
      setLoading(false);
    }
  }

   async function approveSelectedEntries() {
    if (selectedEntryIds.length === 0) return;

    const ok = window.confirm(`Approve ${selectedEntryIds.length} selected entr${selectedEntryIds.length === 1 ? "y" : "ies"}?`);
    if (!ok) return;

    try {
      setLoading(true);
      await apiFetch("/api/admin/time-entries/approve-selected", {
        method: "POST",
        body: JSON.stringify({ entryIds: selectedEntryIds }),
      });
      setSelectedEntryIds([]);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to approve selected entries");
    } finally {
      setLoading(false);
    }
  }

  async function lockSelectedEntries() {
    if (selectedEntryIds.length === 0) return;

    const ok = window.confirm(`Lock ${selectedEntryIds.length} selected entr${selectedEntryIds.length === 1 ? "y" : "ies"}?`);
    if (!ok) return;

    try {
      setLoading(true);
      await apiFetch("/api/admin/time-entries/lock-selected", {
        method: "POST",
        body: JSON.stringify({ entryIds: selectedEntryIds }),
      });
      setSelectedEntryIds([]);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to lock selected entries");
    } finally {
      setLoading(false);
    }
  }
 
    async function approveAllDraftsForSelected() {
    if (draftEntryIdsForSelected.length === 0) return;

    const ok = window.confirm(
      `Approve all ${draftEntryIdsForSelected.length} draft entr${
        draftEntryIdsForSelected.length === 1 ? "y" : "ies"
      } for this employee?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await apiFetch("/api/admin/time-entries/approve-selected", {
        method: "POST",
        body: JSON.stringify({ entryIds: draftEntryIdsForSelected }),
      });
      setSelectedEntryIds([]);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to approve all draft entries");
    } finally {
      setLoading(false);
    }
  }

  async function lockAllApprovedForSelected() {
    if (approvedEntryIdsForSelected.length === 0) return;

    const ok = window.confirm(
      `Lock all ${approvedEntryIdsForSelected.length} approved entr${
        approvedEntryIdsForSelected.length === 1 ? "y" : "ies"
      } for this employee?`
    );
    if (!ok) return;

    try {
      setLoading(true);
      await apiFetch("/api/admin/time-entries/lock-selected", {
        method: "POST",
        body: JSON.stringify({ entryIds: approvedEntryIdsForSelected }),
      });
      setSelectedEntryIds([]);
      await load();
    } catch (e: any) {
      setErr(e?.message || "Failed to lock all approved entries");
    } finally {
      setLoading(false);
    }
  } 

  return (
    <div style={{ padding: 16, maxWidth: 1400, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
        Admin — Time Entries (Week)
      </h1>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>From</div>
            <input
              type="date"
              value={from}
              onChange={(e) => { setPreset(""); setFrom(e.target.value)}}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>To</div>
            <input
              type="date"
              value={to}
              onChange={(e) => { setPreset(""); setTo(e.target.value)}}
              style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
            />
          </div>
          <div>
  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Preset</div>
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
</div>
          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: "1px solid #111",
              background: "#111",
              color: "#fff",
              fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Load"}
          </button>
        </div>

        {err ? <div style={{ marginTop: 12, color: "#b00020" }}>{err}</div> : null}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        <aside
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            minHeight: 420,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>
            Employees in pay period
            <input
  value={employeeSearch}
  onChange={(e) => setEmployeeSearch(e.target.value)}
  placeholder="Search employee name/email"
  style={{
    width: "100%",
    padding: 10,
    border: "1px solid #ccc",
    borderRadius: 8,
    marginBottom: 10,
  }}
/>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {employeeRows.map((row) => {
              const active = row.employeeId === selectedEmployeeId;

              return (
                <button
                  key={row.employeeId}
                  type="button"
                  onClick={() => setSelectedEmployeeId(row.employeeId)}
                  style={{
                    textAlign: "left",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: active ? "#f5f5f5" : "#fff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {formatEmployeeName(row.employee)}
                  </div>

                  <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                    {row.employee?.email || "-"}
                  </div>

                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    Entries: <b>{row.entries.length}</b> • Payable:{" "}
                    <b>{minutesToHHMM(row.payableMinutes)}</b>
                  </div>

                  <div style={{ fontSize: 12, marginTop: 4, color: "#666" }}>
                    Draft: <b>{row.draftCount}</b> • Approved: <b>{row.approvedCount}</b> • Locked:{" "}
                    <b>{row.lockedCount}</b>
                  </div>
                </button>
              );
            })}

            {employeeRows.length === 0 ? (
              <div style={{ color: "#666", fontSize: 13 }}>
                No employees found for this pay period.
              </div>
            ) : null}
          </div>
        </aside>

        <main
          style={{
            border: "1px solid #ddd",
            borderRadius: 12,
            padding: 12,
            background: "#fff",
            minHeight: 420,
          }}
        >
          {!selected ? (
            <div style={{ color: "#666" }}>
              Select a pay period to load employees, then click an employee to review entries.
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>
                    {formatEmployeeName(selected.employee)}
                  </div>
                  <div style={{ color: "#666", fontSize: 13 }}>
                    {selected.employee?.email || "-"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    Pay period: <b>{from}</b> → <b>{to}</b>
                  </div>
                </div>
		
		                <div
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 10,
                    padding: 12,
                    background: "#fafafa",
                    minWidth: 280,
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>
                    Employee Summary
                  </div>

                  <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
                    <div>
                      Worked: <b>{minutesToHHMM(selectedSummary.workedMinutes)}</b>
                    </div>
                    <div>
                      Break: <b>{minutesToHHMM(selectedSummary.breakMinutes)}</b>
                    </div>
                    <div>
                      Payable: <b>{minutesToHHMM(selectedSummary.payableMinutes)}</b>
                    </div>
                    <div>
                      Draft: <b>{selectedSummary.draftCount}</b>
                    </div>
                    <div>
                      Approved: <b>{selectedSummary.approvedCount}</b>
                    </div>
                    <div>
                      Locked: <b>{selectedSummary.lockedCount}</b>
                    </div>
                  </div>
                </div>
		
		                  <div>
                    <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
                      Show
                    </div>
                    <select
                      value={rowStatusFilter}
                      onChange={(e) =>
                        setRowStatusFilter(e.target.value as "ALL" | EntryStatus)
                      }
                      style={{
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #ccc",
                        background: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      <option value="ALL">All</option>
                      <option value="DRAFT">Draft only</option>
                      <option value="APPROVED">Approved only</option>
                      <option value="LOCKED">Locked only</option>
                    </select>
                  </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={approveWeekForSelected}
                    disabled={loading}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #1d4ed8",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontWeight: 700,
                    }}
                  >
                    Approve Week
                  </button>

                  <button
                    type="button"
                    onClick={lockWeekForSelected}
                    disabled={loading}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #b91c1c",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    Lock Week
                  </button>

		                    <button
                    type="button"
                    onClick={approveSelectedEntries}
                    disabled={loading || selectedEntryIds.length === 0}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #2563eb",
                      background: "#fff",
                      color: "#2563eb",
                      fontWeight: 700,
                    }}
                  >
                    Approve Selected ({selectedEntryIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={lockSelectedEntries}
                    disabled={loading || selectedEntryIds.length === 0}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #dc2626",
                      background: "#fff",
                      color: "#dc2626",
                      fontWeight: 700,
                    }}
                  >
                    Lock Selected ({selectedEntryIds.length})
                  </button>

                                    <button
                    type="button"
                    onClick={approveAllDraftsForSelected}
                    disabled={loading || draftEntryIdsForSelected.length === 0}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #2563eb",
                      background: "#dbeafe",
                      color: "#1d4ed8",
                      fontWeight: 700,
                    }}
                  >
                    Approve All Drafts ({draftEntryIdsForSelected.length})
                  </button>

                  <button
                    type="button"
                    onClick={lockAllApprovedForSelected}
                    disabled={loading || approvedEntryIdsForSelected.length === 0}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 10,
                      border: "1px solid #dc2626",
                      background: "#fee2e2",
                      color: "#b91c1c",
                      fontWeight: 700,
                    }}
                  >
                    Lock All Approved ({approvedEntryIdsForSelected.length})
                  </button>

                </div>
              </div>
              
                            <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  border: "1px solid #ddd",
                  borderRadius: 10,
                  background: "#fafafa",
                  display: "flex",
                  gap: 18,
                  flexWrap: "wrap",
                  fontSize: 13,
                }}
              >
                <div>
                  Visible Rows: <b>{filteredSelectedSummary.rowCount}</b>
                </div>
                <div>
                  Worked: <b>{minutesToHHMM(filteredSelectedSummary.workedMinutes)}</b>
                </div>
                <div>
                  Break: <b>{minutesToHHMM(filteredSelectedSummary.breakMinutes)}</b>
                </div>
                <div>
                  Payable: <b>{minutesToHHMM(filteredSelectedSummary.payableMinutes)}</b>
                </div>
              </div>

              <div style={{ marginTop: 16, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={th}>
 			 <input
   			 type="checkbox"
   			 checked={allSelectedVisible}
  	 		 onChange={toggleSelectAllVisible}
 			 />
			 </th>
		      <th style={th}>Work Date</th>
                      <th style={th}>Facility</th>
                      <th style={th}>Shift</th>
                      <th style={th}>Worked</th>
                      <th style={th}>Break</th>
                      <th style={th}>Payable</th>
                      <th style={th}>Status</th>
		      <th style={th}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSelectedEntries.map((e) => {
                      const payable =
                        typeof e.payableMinutes === "number"
                          ? e.payableMinutes
                          : Math.max(
                              0,
                              Number(e.minutesWorked ?? 0) -
                                Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0)
                            );

                      return (
                        <tr key={e.id}>
                         <td style={td}>
 			 <input
   			 type="checkbox"
   			 checked={selectedEntryIds.includes(e.id)}
   			 onChange={() => toggleEntry(e.id)}
 			 />
			 </td>
			  <td style={td}>{String(e.workDate).slice(0, 10)}</td>
                          <td style={td}>{e.facility?.name || "-"}</td>
                          <td style={td}>{e.shiftType}</td>
                          <td style={td}>{minutesToHHMM(Number(e.minutesWorked ?? 0))}</td>
                          <td style={td}>
                            {minutesToHHMM(
                              Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0)
                            )}
                          </td>
                          <td style={td}>
                            <b>{minutesToHHMM(payable)}</b>
                          </td>
                          <td style={td}>
                            <span style={statusBadge(e.status)}>{e.status}</span>
                          </td>
			  <td style={td}>
  				<a
   				 href={`/admin/time-entry/${e.id}`}
   				 style={{
     				 display: "inline-block",
     				 padding: "6px 10px",
     				 borderRadius: 8,
     				 border: "1px solid #ccc",
     				 background: "#fff",
     				 color: "#111",
     				 textDecoration: "none",
     				 fontSize: 12,
     				 fontWeight: 700,
   				 }}
 				 >
   				 Edit
 				 </a>
				 </td>
                        </tr>
                      );
                    })}

                    {filteredSelectedEntries.length === 0 ? (
                      <tr>
                        <td style={td} colSpan={8}>
                          No entries match the current filter for this employee in the selected pay period.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
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

function statusBadge(status: EntryStatus): React.CSSProperties {
  if (status === "LOCKED") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "#fef2f2",
      color: "#b91c1c",
      border: "1px solid #fecaca",
      fontSize: 12,
      fontWeight: 700,
    };
  }

  if (status === "APPROVED") {
    return {
      display: "inline-block",
      padding: "4px 8px",
      borderRadius: 999,
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "1px solid #bfdbfe",
      fontSize: 12,
      fontWeight: 700,
    };
  }

  return {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    color: "#374151",
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 700,
  };
}
