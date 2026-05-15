CREATE TABLE IF NOT EXISTS "ShiftTimecard" (
  "id" TEXT PRIMARY KEY,
  "shiftId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,

  "clockInAt" TIMESTAMP NULL,
  "clockOutAt" TIMESTAMP NULL,

  "breakMinutes" INTEGER NOT NULL DEFAULT 0,

  "regularHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "overtimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "doubletimeHours" DOUBLE PRECISION NOT NULL DEFAULT 0,

  "approvedByWorkerAt" TIMESTAMP NULL,
  "approvedByFacilityAt" TIMESTAMP NULL,

  "workerNotes" TEXT NULL,
  "facilityNotes" TEXT NULL,

  "status" TEXT NOT NULL,

  "exportedAt" TIMESTAMP NULL,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE "ShiftTimecard"
ALTER COLUMN "status" SET DEFAULT 'PENDING';

CREATE UNIQUE INDEX IF NOT EXISTS "ShiftTimecard_shiftId_professionalId_key"
ON "ShiftTimecard"("shiftId","professionalId");

CREATE INDEX IF NOT EXISTS "ShiftTimecard_facilityId_status_idx"
ON "ShiftTimecard"("facilityId","status");

CREATE INDEX IF NOT EXISTS "ShiftTimecard_professionalId_idx"
ON "ShiftTimecard"("professionalId");

CREATE TABLE IF NOT EXISTS "FacilityExternalWorker" (
  "id" TEXT PRIMARY KEY,
  "facilityId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,

  "externalSystem" TEXT NOT NULL,
  "externalWorkerId" TEXT NOT NULL,

  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "FacilityExternalWorker_unique_idx"
ON "FacilityExternalWorker"("facilityId","professionalId","externalSystem");

CREATE INDEX IF NOT EXISTS "FacilityExternalWorker_externalWorkerId_idx"
ON "FacilityExternalWorker"("externalWorkerId");

ALTER TABLE "ShiftTimecard"
DROP CONSTRAINT IF EXISTS "ShiftTimecard_shiftId_fkey";

ALTER TABLE "ShiftTimecard"
ADD CONSTRAINT "ShiftTimecard_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
ON DELETE CASCADE;

ALTER TABLE "ShiftTimecard"
DROP CONSTRAINT IF EXISTS "ShiftTimecard_professionalId_fkey";

ALTER TABLE "ShiftTimecard"
ADD CONSTRAINT "ShiftTimecard_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id")
ON DELETE CASCADE;

ALTER TABLE "ShiftTimecard"
DROP CONSTRAINT IF EXISTS "ShiftTimecard_facilityId_fkey";

ALTER TABLE "ShiftTimecard"
ADD CONSTRAINT "ShiftTimecard_facilityId_fkey"
FOREIGN KEY ("facilityId") REFERENCES "Facility"("id")
ON DELETE CASCADE;

ALTER TABLE "FacilityExternalWorker"
DROP CONSTRAINT IF EXISTS "FacilityExternalWorker_facilityId_fkey";

ALTER TABLE "FacilityExternalWorker"
ADD CONSTRAINT "FacilityExternalWorker_facilityId_fkey"
FOREIGN KEY ("facilityId") REFERENCES "Facility"("id")
ON DELETE CASCADE;

ALTER TABLE "FacilityExternalWorker"
DROP CONSTRAINT IF EXISTS "FacilityExternalWorker_professionalId_fkey";

ALTER TABLE "FacilityExternalWorker"
ADD CONSTRAINT "FacilityExternalWorker_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id")
ON DELETE CASCADE;

SELECT 'UKG payroll tables migrated successfully';
