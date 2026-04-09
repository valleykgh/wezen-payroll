import { NextResponse } from 'next/server';

export async function GET() {
  // Phase 6B scaffold:
  // Later this route can call payroll.wezenstaffing.com API
  // using shared auth or a trusted server-side integration.
  // For now we return a safe placeholder response.

  return NextResponse.json({
    status: 'unavailable',
    currentPayPeriodLabel: 'Available in payroll portal',
    latestPaymentAmountLabel: 'Available in payroll portal',
    latestPaymentDateLabel: 'Available in payroll portal',
    pendingPayrollAmountLabel: 'Available in payroll portal',
    ledgerSummaryLabel: 'Open payroll portal for full ledger details',
  });
}
