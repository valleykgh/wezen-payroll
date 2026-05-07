ALTER TYPE "ShiftStatus" ADD VALUE IF NOT EXISTS 'INVITE_ONLY';

CREATE TABLE IF NOT EXISTS "ShiftInvitation" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "facilityId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SENT',
  "message" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "ShiftInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShiftInvitation_shiftId_professionalId_key"
ON "ShiftInvitation"("shiftId", "professionalId");

CREATE INDEX IF NOT EXISTS "ShiftInvitation_facilityId_idx"
ON "ShiftInvitation"("facilityId");

CREATE INDEX IF NOT EXISTS "ShiftInvitation_professionalId_idx"
ON "ShiftInvitation"("professionalId");

ALTER TABLE "ShiftInvitation"
ADD CONSTRAINT "ShiftInvitation_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftInvitation"
ADD CONSTRAINT "ShiftInvitation_professionalId_fkey"
FOREIGN KEY ("professionalId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftInvitation"
ADD CONSTRAINT "ShiftInvitation_facilityId_fkey"
FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
