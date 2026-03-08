/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,workDate,facilityId,shiftType,punchKey]` on the table `TimeEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "punchKey" TEXT,
ALTER COLUMN "shiftType" DROP NOT NULL,
ALTER COLUMN "shiftType" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_employeeId_workDate_facilityId_shiftType_punchKey_key" ON "TimeEntry"("employeeId", "workDate", "facilityId", "shiftType", "punchKey");
