-- DropIndex
DROP INDEX "PayrollAdjustment_employeeId_idx";

-- CreateTable
CREATE TABLE "PayrollCorrection" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "payrollRunSnapshotId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "originalSnapshotJson" JSONB NOT NULL,
    "correctedInputJson" JSONB NOT NULL,
    "correctedResultJson" JSONB NOT NULL,
    "adjustmentAmountCents" INTEGER NOT NULL,
    "payrollAdjustmentId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayrollCorrection_payrollAdjustmentId_key" ON "PayrollCorrection"("payrollAdjustmentId");

-- CreateIndex
CREATE INDEX "PayrollCorrection_payrollRunId_idx" ON "PayrollCorrection"("payrollRunId");

-- CreateIndex
CREATE INDEX "PayrollCorrection_employeeId_idx" ON "PayrollCorrection"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollCorrection_workDate_idx" ON "PayrollCorrection"("workDate");

-- AddForeignKey
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_payrollAdjustmentId_fkey" FOREIGN KEY ("payrollAdjustmentId") REFERENCES "PayrollAdjustment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
