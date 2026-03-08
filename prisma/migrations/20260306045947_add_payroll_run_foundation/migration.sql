-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'FINALIZED', 'VOIDED');

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunEmployee" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "regularMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "doubleMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "payableMinutes" INTEGER NOT NULL DEFAULT 0,
    "regularPayCents" INTEGER NOT NULL DEFAULT 0,
    "overtimePayCents" INTEGER NOT NULL DEFAULT 0,
    "doublePayCents" INTEGER NOT NULL DEFAULT 0,
    "grossPayCents" INTEGER NOT NULL DEFAULT 0,
    "adjustmentsCents" INTEGER NOT NULL DEFAULT 0,
    "loanDeductionCents" INTEGER NOT NULL DEFAULT 0,
    "netPayCents" INTEGER NOT NULL DEFAULT 0,
    "snapshotVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRunEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRunEntrySnapshot" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "timeEntryId" TEXT,
    "workDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "snapshotJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollRunEntrySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollRun_periodStart_periodEnd_idx" ON "PayrollRun"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "PayrollRunEmployee_employeeId_idx" ON "PayrollRunEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRunEmployee_payrollRunId_employeeId_key" ON "PayrollRunEmployee"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollRunEntrySnapshot_payrollRunId_idx" ON "PayrollRunEntrySnapshot"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollRunEntrySnapshot_employeeId_idx" ON "PayrollRunEntrySnapshot"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollRunEntrySnapshot_timeEntryId_idx" ON "PayrollRunEntrySnapshot"("timeEntryId");

-- CreateIndex
CREATE INDEX "PayrollRunEntrySnapshot_workDate_idx" ON "PayrollRunEntrySnapshot"("workDate");

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEntrySnapshot" ADD CONSTRAINT "PayrollRunEntrySnapshot_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRunEntrySnapshot" ADD CONSTRAINT "PayrollRunEntrySnapshot_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
