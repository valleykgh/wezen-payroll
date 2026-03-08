/*
  Warnings:

  - A unique constraint covering the columns `[employeeId,facilityId,workDate,shiftType]` on the table `TimeEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_employeeId_facilityId_workDate_shiftType_key" ON "TimeEntry"("employeeId", "facilityId", "workDate", "shiftType");
