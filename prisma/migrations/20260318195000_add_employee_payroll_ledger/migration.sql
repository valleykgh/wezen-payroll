CREATE TABLE "EmployeePayrollLedger" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "type" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeePayrollLedger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeePayrollLedger_employeeId_idx"
ON "EmployeePayrollLedger"("employeeId");

ALTER TABLE "EmployeePayrollLedger"
ADD CONSTRAINT "EmployeePayrollLedger_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
