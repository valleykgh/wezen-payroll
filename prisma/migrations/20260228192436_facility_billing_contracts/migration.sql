/*
  Warnings:

  - Made the column `punchKey` on table `TimeEntry` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "billingRole" TEXT;

-- AlterTable
ALTER TABLE "TimeEntry" ALTER COLUMN "punchKey" SET DEFAULT '',
ALTER COLUMN "punchKey" SET DEFAULT '';

-- CreateTable
CREATE TABLE "FacilityBillingContract" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Default Contract',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "lockedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityBillingContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityBillingRate" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "regRateCents" INTEGER NOT NULL,
    "otRateCents" INTEGER NOT NULL,
    "dtRateCents" INTEGER NOT NULL,
    "holidayRateCents" INTEGER NOT NULL,

    CONSTRAINT "FacilityBillingRate_pkey" PRIMARY KEY ("id")
);

-- backfill NULL punchKey rows
UPDATE "TimeEntry"
SET "punchKey" =
  'legacy:' ||
  COALESCE(to_char("startTime", 'HH24:MI'), 'NA') || '-' ||
  COALESCE(to_char("endTime", 'HH24:MI'), 'NA') || '__' ||
  COALESCE("id", 'NA')
WHERE "punchKey" IS NULL;

-- now enforce not null
ALTER TABLE "TimeEntry" ALTER COLUMN "punchKey" SET NOT NULL;

-- CreateIndex
CREATE INDEX "FacilityBillingContract_facilityId_effectiveFrom_idx" ON "FacilityBillingContract"("facilityId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityBillingRate_contractId_role_key" ON "FacilityBillingRate"("contractId", "role");

-- AddForeignKey
ALTER TABLE "FacilityBillingContract" ADD CONSTRAINT "FacilityBillingContract_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBillingContract" ADD CONSTRAINT "FacilityBillingContract_lockedById_fkey" FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityBillingRate" ADD CONSTRAINT "FacilityBillingRate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "FacilityBillingContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
