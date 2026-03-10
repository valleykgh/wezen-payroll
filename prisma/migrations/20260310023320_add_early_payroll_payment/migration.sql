-- CreateTable
CREATE TABLE "EarlyPayrollPayment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EarlyPayrollPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EarlyPayrollPayment_employeeId_periodStart_periodEnd_idx" ON "EarlyPayrollPayment"("employeeId", "periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "EarlyPayrollPayment_employeeId_periodStart_periodEnd_key" ON "EarlyPayrollPayment"("employeeId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "EarlyPayrollPayment" ADD CONSTRAINT "EarlyPayrollPayment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarlyPayrollPayment" ADD CONSTRAINT "EarlyPayrollPayment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarlyPayrollPayment" ADD CONSTRAINT "EarlyPayrollPayment_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
