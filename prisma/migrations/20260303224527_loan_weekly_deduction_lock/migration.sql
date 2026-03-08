-- AlterTable
ALTER TABLE "EmployeeLoan" ADD COLUMN     "weeklyDeductionCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "weeklyDeductionLocked" BOOLEAN NOT NULL DEFAULT false;
