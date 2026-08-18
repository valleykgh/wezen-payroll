ALTER TABLE "Employee"
ADD COLUMN "employeeCode" TEXT,
ADD COLUMN "payrollSourceName" TEXT;

CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");
CREATE UNIQUE INDEX "Employee_payrollSourceName_key" ON "Employee"("payrollSourceName");

CREATE TABLE "PayrollSourceFile" (
  "id" TEXT NOT NULL,
  "driveItemId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "eTag" TEXT,
  "webUrl" TEXT,
  "lastModified" TIMESTAMP(3),
  "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PayrollSourceFile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PayrollSourceFile_driveItemId_key" ON "PayrollSourceFile"("driveItemId");

CREATE TABLE "ImportedPaystubPeriod" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourceFileId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "payDate" TIMESTAMP(3) NOT NULL,
  "record" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ImportedPaystubPeriod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ImportedPaystubPeriod_employeeId_sourceFileId_periodEnd_key" ON "ImportedPaystubPeriod"("employeeId", "sourceFileId", "periodEnd");
CREATE INDEX "ImportedPaystubPeriod_employeeId_periodEnd_idx" ON "ImportedPaystubPeriod"("employeeId", "periodEnd");
ALTER TABLE "ImportedPaystubPeriod" ADD CONSTRAINT "ImportedPaystubPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportedPaystubPeriod" ADD CONSTRAINT "ImportedPaystubPeriod_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "PayrollSourceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaystubAccessLog" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "fromDate" TIMESTAMP(3),
  "toDate" TIMESTAMP(3),
  "periodCount" INTEGER NOT NULL DEFAULT 0,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaystubAccessLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaystubAccessLog_employeeId_createdAt_idx" ON "PaystubAccessLog"("employeeId", "createdAt");
ALTER TABLE "PaystubAccessLog" ADD CONSTRAINT "PaystubAccessLog_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
