"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "../../../../lib/api";

function dateOnlyUTC(value: string | Date) {
  return new Date(value).toISOString().slice(0, 10);
}

export default function EmployeeLedgerPage() {
  const params = useParams<{ id: string }>();
  const employeeId = String(params?.id || "");

  const [from, setFrom] = useState(() =>
    new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

async function load() {
  if (!employeeId) return;

  setLoading(true);
  try {
    const json = await apiFetch(
      `/api/admin/employees/${employeeId}/ledger?from=${from}&to=${to}`
    );
    setData(json);
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(false);
  }
}
  useEffect(() => {
    load();
  }, [employeeId]);

  return (
    <div style={{ padding: 20 }}>
      <h2>Employee Ledger</h2>

      <div style={{ marginBottom: 16 }}>
        <label>From: </label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <label style={{ marginLeft: 10 }}>To: </label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        <button onClick={load} style={{ marginLeft: 10 }}>
          Load
        </button>
      </div>

      {loading && <div>Loading...</div>}

      {data && (
        <>
          <div style={{ marginBottom: 20 }}>
            <b>{data.employee.legalName}</b>
          </div>

          <div style={{ marginBottom: 20 }}>
  <b>Gross:</b> ${Number(data.totals.grossPay || 0).toFixed(2)} &nbsp; | &nbsp;
  <b>Net:</b> ${Number(data.totals.netPay || 0).toFixed(2)} &nbsp; | &nbsp;
  <b>Early Paid:</b> ${Number(data.totals.earlyPaid || 0).toFixed(2)} &nbsp; | &nbsp;
  <b>Ledger Balance:</b>{" "}
  <span style={{ color: Number(data.totals.ledgerNet || 0) < 0 ? "red" : "green", fontWeight: 700, fontSize: 16, }}>
    ${Number(data.totals.ledgerNet || 0).toFixed(2)}
  </span>
</div>
          <h3 style={{ marginTop: 20 }}>Ledger</h3>
          <table border={1} cellPadding={6}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Note</th>
                <th>Amount</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((l: any) => (
                <tr key={l.id}>
                  <td>{new Date(l.date).toLocaleDateString()}</td>
                  <td>{l.type}</td>
                  <td>{l.note || "-"}</td>
                  <td>${(l.amountCents / 100).toFixed(2)}</td>
                  <td
  		    style={{
			    color: l.runningBalanceCents < 0 ? "red" : "green",
		            fontWeight: 600,
			  }}
			>
			  ${(l.runningBalanceCents / 100).toFixed(2)}
		  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div
  style={{
    marginTop: 14,
    marginBottom: 10,
    fontSize: 13,
    lineHeight: 1.6,
  }}
>
  <div>
    <b>Current total in range:</b> ${Number(data.totals.grossPay || 0).toFixed(2)}
  </div>
  <div>
    <b>Frozen finalized payroll total:</b>{" "}
    ${(
      (data.payrollRuns || []).reduce(
        (sum: number, run: any) => sum + Number(run.grossPayCents || 0),
        0
      ) / 100
    ).toFixed(2)}
  </div>
  <div>
    <b>Post-finalization activity:</b>{" "}
    ${(
      Math.max(
        0,
        Number((data.totals.grossPay || 0) * 100) -
          (data.payrollRuns || []).reduce(
            (sum: number, run: any) => sum + Number(run.grossPayCents || 0),
            0
          )
      ) / 100
    ).toFixed(2)}
  </div>
</div>
      {(data.payrollRuns || []).length > 0 ? (
  <>
    <h3 style={{ marginTop: 20 }}>Frozen Payroll Runs in Range</h3>
    <div
      style={{
        marginTop: 4,
        marginBottom: 10,
        fontSize: 12,
        color: "#6b7280",
        lineHeight: 1.4,
      }}
    >
      These rows show the original finalized payroll snapshots for this date range.
      Later Pay Now activity and post-finalization corrections are reflected in the ledger above.
    </div>
    <table border={1} cellPadding={6}>
      <thead>
        <tr>
          <th>Period</th>
          <th>Gross</th>
          <th>Net</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {(data.payrollRuns || []).map((r: any, i: number) => (
          <tr key={i}>
            <td>
              {dateOnlyUTC(r.periodStart)} - {dateOnlyUTC(r.periodEnd)}
            </td>
            <td>${(r.grossPayCents / 100).toFixed(2)}</td>
            <td>${(r.netPayCents / 100).toFixed(2)}</td>
            <td>{r.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </>
) : null}  
      </>
      )}
    </div>
  );
}
