"use client";

import React, { useMemo, useState } from "react";

type RecordRow = {
  sourceFile: string;
  facility: string;
  periodStart: string;
  periodEnd: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  holidayHours: number;
  calculatedEarnings: number;
  previousPayment: number;
  actualPayment: number;
  totalPaid: number;
};

type Summary = {
  payPeriods: number;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  holidayHours: number;
  calculatedEarnings: number;
  previousPayments: number;
  actualPayments: number;
  totalPaid: number;
};

// Large multipart payroll uploads go directly to Express. Sending them through
// the Next.js development proxy can abort the request while it is still being
// streamed, especially when selecting many OneDrive-backed workbooks.
function apiBase() {
  return (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/+$/, "");
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
}

async function errorMessage(response: Response) {
  const body = await response.json().catch(() => null);
  return body?.error || "Request failed";
}

export default function PaystubGeneratorPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [employees, setEmployees] = useState<string[]>([]);
  const [employee, setEmployee] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [ssnLast4, setSsnLast4] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [records, setRecords] = useState<RecordRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [syncResult, setSyncResult] = useState("");

  async function syncOneDrive() {
    setBusy("sync"); setError(""); setSyncResult("");
    try {
      const response = await fetch(`${apiBase()}/api/admin/paystub-generator/sync-onedrive`, { method: "POST", credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = await response.json();
      setSyncResult(data.started ? "OneDrive synchronization started. It will continue securely in the background; check again in a few minutes." : data.message);
    } catch (err: any) { setError(err?.message || "OneDrive sync failed"); }
    finally { setBusy(""); }
  }

  const formData = useMemo(() => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    if (employee) form.append("employee", employee);
    form.append("year", year);
    form.append("addressLine1", addressLine1);
    form.append("addressLine2", addressLine2);
    form.append("ssnLast4", ssnLast4);
    form.append("employeeId", employeeId);
    form.append("candidateEmail", candidateEmail);
    return form;
  }, [files, employee, year, addressLine1, addressLine2, ssnLast4, employeeId, candidateEmail]);

  const candidateReady = Boolean(
    addressLine1.trim() && addressLine2.trim() && /^\d{4}$/.test(ssnLast4) && employeeId.trim(),
  );
  const emailReady = candidateReady && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidateEmail.trim());

  async function scan(selected: File[]) {
    setFiles(selected);
    setEmployees([]);
    setEmployee("");
    setSummary(null);
    setRecords([]);
    setError("");
    if (!selected.length) return;
    setBusy("scan");
    try {
      const form = new FormData();
      selected.forEach((file) => form.append("files", file));
      const response = await fetch(`${apiBase()}/api/admin/paystub-generator/scan`, { method: "POST", body: form, credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = await response.json();
      setEmployees(data.employees || []);
      setWarnings(data.warnings || []);
    } catch (err: any) {
      setError(err?.message || "Failed to scan payroll files");
    } finally {
      setBusy("");
    }
  }

  async function preview() {
    setBusy("preview");
    setError("");
    try {
      const response = await fetch(`${apiBase()}/api/admin/paystub-generator/preview`, { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = await response.json();
      setSummary(data.summary);
      setRecords(data.records || []);
      setWarnings(data.warnings || []);
    } catch (err: any) {
      setError(err?.message || "Failed to generate summary");
    } finally {
      setBusy("");
    }
  }

  async function downloadFile(format: "workbook" | "pdf") {
    setBusy(format);
    setError("");
    try {
      const response = await fetch(`${apiBase()}/api/admin/paystub-generator/${format}`, { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const extension = format === "pdf" ? "pdf" : "xlsx";
      const name = disposition.match(/filename="([^"]+)"/)?.[1] || `${employee}-${year}-paystubs.${extension}`;
      const link = document.createElement("a");
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (err: any) {
      setError(err?.message || `Failed to download ${format === "pdf" ? "PDF" : "workbook"}`);
    } finally {
      setBusy("");
    }
  }

  async function emailPaystubs() {
    const recipient = candidateEmail.trim().toLowerCase();
    if (!window.confirm(`Email ${employee}'s private paystub PDF to ${recipient}?`)) return;
    setBusy("email");
    setError("");
    try {
      const response = await fetch(`${apiBase()}/api/admin/paystub-generator/email`, { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) throw new Error(await errorMessage(response));
      const data = await response.json();
      window.alert(`Paystub PDF emailed to ${data.email}.`);
    } catch (err: any) {
      setError(err?.message || "Failed to email paystub PDF");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Employee self-service source</h2>
        <p className="mt-2 text-sm text-slate-600">Import the configured private OneDrive payroll folder after employee codes and exact Excel names are mapped under Employees.</p>
        <button type="button" onClick={syncOneDrive} disabled={Boolean(busy)} className="mt-4 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
          {busy === "sync" ? "Synchronizing…" : "Sync payroll files from OneDrive"}
        </button>
        {syncResult ? <p className="mt-3 text-sm font-semibold text-green-700">{syncResult}</p> : null}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">Admin tool</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Paystub Generator</h2>
        <p className="mt-2 text-sm text-slate-600">Upload weekly payroll workbooks. Files are processed in memory and are not saved by the server.</p>

        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <label className="md:col-span-3 block text-sm font-semibold text-slate-700">
            Payroll files (.xlsx)
            <input type="file" accept=".xlsx" multiple onChange={(event) => scan(Array.from(event.target.files || []))} className="mt-2 block w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm" />
            <span className="mt-2 block font-normal text-slate-500">{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "No files selected"}</span>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Employee
            <select value={employee} onChange={(event) => setEmployee(event.target.value)} disabled={!employees.length} className="mt-2 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100">
              <option value="">Select an employee</option>
              {employees.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
            Candidate street address
            <input type="text" value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} placeholder="Street address and apartment/unit" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            City, state and ZIP
            <input type="text" value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} placeholder="Oakland, CA 94601" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Last 4 digits of SSN
            <input type="text" inputMode="numeric" maxLength={4} value={ssnLast4} onChange={(event) => setSsnLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Employee ID
            <input type="text" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="WS0001" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Candidate email
            <input type="email" value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} placeholder="candidate@example.com" className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <div className="flex items-end text-sm text-slate-500">
            Pay date is automatically set to five days after the pay-period end date.
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            Payroll year
            <input type="number" min="2000" max="2100" value={year} onChange={(event) => setYear(event.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3" />
          </label>
          <div className="flex items-end">
            <button type="button" onClick={preview} disabled={!employee || !files.length || Boolean(busy)} className="w-full rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
              {busy === "scan" ? "Scanning…" : busy === "preview" ? "Generating…" : "Generate Summary"}
            </button>
          </div>
        </div>
        {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
        {warnings.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
      </section>

      {summary && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Pay periods", summary.payPeriods], ["Regular hours", summary.regularHours.toFixed(2)],
              ["Overtime hours", summary.overtimeHours.toFixed(2)], ["Double-time hours", summary.doubleTimeHours.toFixed(2)],
              ["Holiday hours", summary.holidayHours.toFixed(2)], ["Calculated earnings", money(summary.calculatedEarnings)],
              ["Previous payments (K)", money(summary.previousPayments)], ["YTD paid (K + N)", money(summary.totalPaid)],
            ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-2xl font-bold text-slate-950">{value}</div></div>)}
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h3 className="text-lg font-bold text-slate-950">Pay-period detail</h3><p className="text-sm text-slate-500">Net pay uses the source rule: Column K + Column N.</p></div>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => downloadFile("pdf")} disabled={Boolean(busy) || !candidateReady} className="rounded-xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{busy === "pdf" ? "Preparing PDF…" : "Download PDF Paystubs"}</button>
                <button type="button" onClick={() => downloadFile("workbook")} disabled={Boolean(busy) || !candidateReady} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{busy === "workbook" ? "Preparing Excel…" : "Download Excel Paystubs"}</button>
                <button type="button" onClick={emailPaystubs} disabled={Boolean(busy) || !emailReady} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">{busy === "email" ? "Emailing…" : "Email PDF Paystubs"}</button>
              </div>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm"><thead className="bg-slate-100 text-slate-700"><tr>{["Period", "Facility", "Reg", "OT", "DT", "Holiday", "Calculated", "K", "N", "Paid"].map((heading) => <th key={heading} className="whitespace-nowrap px-3 py-2 font-semibold">{heading}</th>)}</tr></thead>
                <tbody>{records.map((record) => <tr key={`${record.sourceFile}-${record.periodEnd}`} className="border-t border-slate-100"><td className="whitespace-nowrap px-3 py-3">{record.periodStart.slice(0, 10)} – {record.periodEnd.slice(0, 10)}</td><td className="px-3 py-3">{record.facility || "—"}</td><td className="px-3 py-3">{record.regularHours.toFixed(2)}</td><td className="px-3 py-3">{record.overtimeHours.toFixed(2)}</td><td className="px-3 py-3">{record.doubleTimeHours.toFixed(2)}</td><td className="px-3 py-3">{record.holidayHours.toFixed(2)}</td><td className="px-3 py-3">{money(record.calculatedEarnings)}</td><td className="px-3 py-3">{money(record.previousPayment)}</td><td className="px-3 py-3">{money(record.actualPayment)}</td><td className="px-3 py-3 font-semibold">{money(record.totalPaid)}</td></tr>)}</tbody>
              </table>
            </div>
            <p className="mt-5 text-xs text-slate-500">The PDF contains one completed paystub page per pay period. Excel remains available for audit and reconciliation.</p>
          </section>
        </>
      )}
    </div>
  );
}
