export type PayrollSummary = {
  status: 'connected' | 'unavailable';
  currentPayPeriodLabel: string | null;
  latestPaymentAmountLabel: string | null;
  latestPaymentDateLabel: string | null;
  pendingPayrollAmountLabel: string | null;
  ledgerSummaryLabel: string | null;
};

export async function getPayrollSummary(): Promise<PayrollSummary> {
  const res = await fetch('/api/payroll/summary', {
    method: 'GET',
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new Error('Failed to fetch payroll summary');
  }

  return res.json();
}
