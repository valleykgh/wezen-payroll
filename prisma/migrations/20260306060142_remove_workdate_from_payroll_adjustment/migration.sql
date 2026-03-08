/*
  Warnings:

  - You are about to drop the column `minutes` on the `PayrollAdjustment` table. All the data in the column will be lost.
  - You are about to drop the column `workDate` on the `PayrollAdjustment` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "PayrollAdjustment_employeeId_workDate_idx";

-- AlterTable
ALTER TABLE "PayrollAdjustment" DROP COLUMN "minutes",
DROP COLUMN "workDate";

-- CreateIndex
CREATE INDEX "PayrollAdjustment_employeeId_idx" ON "PayrollAdjustment"("employeeId");
