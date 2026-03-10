-- AlterTable
ALTER TABLE "PayrollRunEmployee" ADD COLUMN     "paidEarly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidEarlyAmountCents" INTEGER NOT NULL DEFAULT 0;
