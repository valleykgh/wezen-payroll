const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Starting live-test reset...");

  await prisma.$transaction(async (tx) => {
    // Delete child/related data first
    try { await tx.loanDeduction.deleteMany({}); } catch {}
    try { await tx.employeeLoan.deleteMany({}); } catch {}
    try { await tx.earlyPayrollPayment.deleteMany({}); } catch {}
    try { await tx.payrollAdjustment.deleteMany({}); } catch {}
    try { await tx.timeEntryBreak.deleteMany({}); } catch {}
    try { await tx.timeEntry.deleteMany({}); } catch {}
    try { await tx.payrollRunItem.deleteMany({}); } catch {}
    try { await tx.payrollRun.deleteMany({}); } catch {}
    try { await tx.ledgerEntry.deleteMany({}); } catch {}
    try { await tx.billingRun.deleteMany({}); } catch {}

    // Finally delete employees
    try { await tx.employee.deleteMany({}); } catch {}
  });

  console.log("Live-test reset completed.");
}

main()
  .catch((e) => {
    console.error("Reset failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
