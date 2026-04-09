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

type EntryRow = {
  id: string;
  employeeId: string;
  facilityId?: string | null;
  workDate: string;
  status: "DRAFT" | "APPROVED" | "LOCKED";
  shiftType?: string | null;
  minutesWorked?: number | null;
  breakMinutes?: number | null;
  computedBreakMinutes?: number | null;
  payableMinutes?: number | null;
  punchesJson?: any[] | null;
  breaksJson?: any[] | null;
  employee?: any;
  facility?: any;
  buckets?: {
    regularMinutes?: number;
    overtimeMinutes?: number;
    doubleMinutes?: number;
    regular_decimal?: number;
    overtime_decimal?: number;
    double_decimal?: number;
  };
  isMissedAdjustment?: boolean;
  sourceType?: "TIME_ENTRY" | "PAYROLL_ADJUSTMENT";
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
  const m = Math.max(0, Number(min || 0));
  return (m / 60).toFixed(2);
}

function formatEmployeeName(e?: EmployeeLite | null) {
  if (!e) return "Unknown";
  return e.preferredName ? `${e.legalName} (${e.preferredName})` : e.legalName;
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

function statusBadgeClass(status: EntryStatus) {
  if (status === "LOCKED") {
    return "inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700";
  }

  if (status === "APPROVED") {
    return "inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700";
  }

  return "inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700";
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
      qs.set("includeMissedAdjustments", "true");
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
          entries: [] as EntryRow[],
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
    const ok = window.confirm(
      `Approve ${selectedEntryIds.length} selected entr${selectedEntryIds.length === 1 ? "y" : "ies"}?`
    );
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
    const ok = window.confirm(
      `Lock ${selectedEntryIds.length} selected entr${selectedEntryIds.length === 1 ? "y" : "ies"}?`
    );
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
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-gradient-to-r from-slate-900 to-cyan-700 p-8 text-white shadow-xl">
        <div className="max-w-4xl">
          <div className="text-sm font-semibold uppercase tracking-[0.22em] text-cyan-100">
            Weekly Review
          </div>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Time Entries by Pay Period
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-cyan-50/90">
            Review employee time entries across a selected date range, approve records, and lock payroll-ready entries.
          </p>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,220px))_auto] lg:items-end">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("");
                setFrom(e.target.value);
              }}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("");
                setTo(e.target.value);
              }}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Preset</span>
            <select
              value={preset}
              onChange={(e) => applyPreset(e.target.value)}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            >
              <option value="">Custom</option>
              <option value="THIS_WEEK">This Week</option>
              <option value="LAST_WEEK">Last Week</option>
              <option value="LAST_2_WEEKS">Last 2 Weeks</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
            </select>
          </label>

          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load"}
          </button>
        </div>

        {err ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {err}
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-lg font-bold tracking-tight text-slate-950">
            Employees in pay period
          </div>

          <input
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            placeholder="Search employee name/email"
            className="mt-4 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
          />

          <div className="mt-4 flex flex-col gap-3">
            {employeeRows.map((row) => {
              const active = row.employeeId === selectedEmployeeId;

              return (
                <button
                  key={row.employeeId}
                  type="button"
                  onClick={() => setSelectedEmployeeId(row.employeeId)}
                  className={
                    active
                      ? "rounded-[1.5rem] border border-cyan-200 bg-cyan-50 p-4 text-left shadow-sm"
                      : "rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                  }
                >
                  <div className="font-bold text-slate-950">
                    {formatEmployeeName(row.employee)}
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    {row.employee?.email || "-"}
                  </div>

                  <div className="mt-3 text-xs text-slate-600">
                    Entries: <span className="font-semibold text-slate-900">{row.entries.length}</span> · Payable:{" "}
                    <span className="font-semibold text-slate-900">
                      {minutesToHHMM(row.payableMinutes)}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-slate-500">
                    Draft: <span className="font-semibold text-slate-700">{row.draftCount}</span> · Approved:{" "}
                    <span className="font-semibold text-slate-700">{row.approvedCount}</span> · Locked:{" "}
                    <span className="font-semibold text-slate-700">{row.lockedCount}</span>
                  </div>
                </button>
              );
            })}

            {employeeRows.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                No employees found for this pay period.
              </div>
            ) : null}
          </div>
        </aside>

        <main className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          {!selected ? (
            <div className="rounded-2xl bg-slate-50 px-5 py-5 text-sm text-slate-600">
              Select a pay period to load employees, then click an employee to review entries.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-2xl font-bold tracking-tight text-slate-950">
                    {formatEmployeeName(selected.employee)}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {selected.employee?.email || "-"}
                  </div>
                  <div className="mt-2 text-sm text-slate-600">
                    Pay period: <span className="font-semibold text-slate-900">{from}</span> →{" "}
                    <span className="font-semibold text-slate-900">{to}</span>
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 xl:min-w-[280px]">
                  <div className="font-bold text-slate-950">Employee Summary</div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-600">
                    <div>
                      Worked: <span className="font-semibold text-slate-900">{minutesToHHMM(selectedSummary.workedMinutes)}</span>
                    </div>
                    <div>
                      Break: <span className="font-semibold text-slate-900">{minutesToHHMM(selectedSummary.breakMinutes)}</span>
                    </div>
                    <div>
                      Payable: <span className="font-semibold text-slate-900">{minutesToHHMM(selectedSummary.payableMinutes)}</span>
                    </div>
                    <div>
                      Draft: <span className="font-semibold text-slate-900">{selectedSummary.draftCount}</span>
                    </div>
                    <div>
                      Approved: <span className="font-semibold text-slate-900">{selectedSummary.approvedCount}</span>
                    </div>
                    <div>
                      Locked: <span className="font-semibold text-slate-900">{selectedSummary.lockedCount}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-700">Show</div>
                  <select
                    value={rowStatusFilter}
                    onChange={(e) =>
                      setRowStatusFilter(e.target.value as "ALL" | EntryStatus)
                    }
                    className="mt-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  >
                    <option value="ALL">All</option>
                    <option value="DRAFT">Draft only</option>
                    <option value="APPROVED">Approved only</option>
                    <option value="LOCKED">Locked only</option>
                  </select>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={approveWeekForSelected}
                    disabled={loading}
                    className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve Week
                  </button>

                  <button
                    type="button"
                    onClick={lockWeekForSelected}
                    disabled={loading}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Lock Week
                  </button>

                  <button
                    type="button"
                    onClick={approveSelectedEntries}
                    disabled={loading || selectedEntryIds.length === 0}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve Selected ({selectedEntryIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={lockSelectedEntries}
                    disabled={loading || selectedEntryIds.length === 0}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Lock Selected ({selectedEntryIds.length})
                  </button>

                  <button
                    type="button"
                    onClick={approveAllDraftsForSelected}
                    disabled={loading || draftEntryIdsForSelected.length === 0}
                    className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Approve All Drafts ({draftEntryIdsForSelected.length})
                  </button>

                  <button
                    type="button"
                    onClick={lockAllApprovedForSelected}
                    disabled={loading || approvedEntryIdsForSelected.length === 0}
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Lock All Approved ({approvedEntryIdsForSelected.length})
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                <div className="flex flex-wrap gap-5">
                  <div>
                    Visible Rows: <span className="font-semibold text-slate-900">{filteredSelectedSummary.rowCount}</span>
                  </div>
                  <div>
                    Worked: <span className="font-semibold text-slate-900">{minutesToHHMM(filteredSelectedSummary.workedMinutes)}</span>
                  </div>
                  <div>
                    Break: <span className="font-semibold text-slate-900">{minutesToHHMM(filteredSelectedSummary.breakMinutes)}</span>
                  </div>
                  <div>
                    Payable: <span className="font-semibold text-slate-900">{minutesToHHMM(filteredSelectedSummary.payableMinutes)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 overflow-x-auto">
                <table className="min-w-[900px] w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <input
                          type="checkbox"
                          checked={allSelectedVisible}
                          onChange={toggleSelectAllVisible}
                        />
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Work Date
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Facility
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Shift
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Worked
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Break
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Payable
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Status
                      </th>
                      <th className="border-b border-slate-200 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Action
                      </th>
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
                        <tr key={e.id} className="border-b border-slate-100">
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedEntryIds.includes(e.id)}
                              onChange={() => toggleEntry(e.id)}
                            />
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            {String(e.workDate).slice(0, 10)}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            {e.facility?.name || "-"}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            {e.shiftType || "-"}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            {minutesToHHMM(Number(e.minutesWorked ?? 0))}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            {minutesToHHMM(
                              Number(e.computedBreakMinutes ?? e.breakMinutes ?? 0)
                            )}
                          </td>
                          <td className="px-3 py-3 text-sm font-semibold text-slate-900">
                            {minutesToHHMM(payable)}
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <span className={statusBadgeClass(e.status)}>{e.status}</span>
                          </td>
                          <td className="px-3 py-3 text-sm text-slate-700">
                            <a
                              href={
                                e.isMissedAdjustment || e.sourceType === "PAYROLL_ADJUSTMENT"
                                  ? `/admin/time-entry/${e.id}?sourceType=PAYROLL_ADJUSTMENT`
                                  : `/admin/time-entry/${e.id}`
                              }
                              className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                            >
                              {e.isMissedAdjustment || e.sourceType === "PAYROLL_ADJUSTMENT"
                                ? "Create Correction"
                                : "Edit"}
                            </a>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredSelectedEntries.length === 0 ? (
                      <tr>
                        <td className="px-3 py-4 text-sm text-slate-500" colSpan={9}>
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
      </section>
    </div>
  );
}
