ALTER TABLE "Employee"
ADD COLUMN IF NOT EXISTS "importSourceSystem" TEXT,
ADD COLUMN IF NOT EXISTS "externalEmployeeId" TEXT,
ADD COLUMN IF NOT EXISTS "staffingProfessionalId" TEXT;

CREATE TABLE IF NOT EXISTS "PayrollImportBatch" (
  "id" TEXT PRIMARY KEY,
  "employeeId" TEXT,
  "sourceSystem" TEXT NOT NULL,
  "externalEmployeeId" TEXT,
  "batchDate" TIMESTAMP,
  "importStartedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "importCompletedAt" TIMESTAMP,
  "totalPunches" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "rawPayload" JSONB,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "ImportedPunch" (
  "id" TEXT PRIMARY KEY,
  "payrollImportBatchId" TEXT,
  "employeeId" TEXT,
  "externalEmployeeId" TEXT NOT NULL,
  "sourceSystem" TEXT NOT NULL,
  "facilityName" TEXT,
  "departmentCode" TEXT,
  "costCenterCode" TEXT,
  "punchTimestamp" TIMESTAMP NOT NULL,
  "punchType" TEXT NOT NULL,
  "rawPayload" JSONB,
  "processed" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_payroll_import_batch_source"
ON "PayrollImportBatch" ("sourceSystem");

CREATE INDEX IF NOT EXISTS "idx_payroll_import_batch_external_employee"
ON "PayrollImportBatch" ("externalEmployeeId");

CREATE INDEX IF NOT EXISTS "idx_payroll_import_batch_status"
ON "PayrollImportBatch" ("status");

CREATE INDEX IF NOT EXISTS "idx_imported_punch_employee"
ON "ImportedPunch" ("employeeId");

CREATE INDEX IF NOT EXISTS "idx_imported_punch_external_employee"
ON "ImportedPunch" ("externalEmployeeId");

CREATE INDEX IF NOT EXISTS "idx_imported_punch_timestamp"
ON "ImportedPunch" ("punchTimestamp");

CREATE INDEX IF NOT EXISTS "idx_imported_punch_processed"
ON "ImportedPunch" ("processed");
