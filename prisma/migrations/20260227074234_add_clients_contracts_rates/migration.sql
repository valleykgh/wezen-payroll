/*
  Warnings:

  - The `title` column on the `Employee` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EmployeeTitle" AS ENUM ('CNA', 'LVN', 'RN');

-- DropIndex
DROP INDEX "TimeEntry_employeeId_workDate_idx";

-- AlterTable
ALTER TABLE "Employee" DROP COLUMN "title",
ADD COLUMN     "title" "EmployeeTitle" NOT NULL DEFAULT 'CNA';

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractRate" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "title" "EmployeeTitle" NOT NULL,
    "billRegRateCents" INTEGER NOT NULL,
    "billOtRateCents" INTEGER NOT NULL,
    "billDtRateCents" INTEGER NOT NULL,

    CONSTRAINT "ContractRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Contract_clientId_effectiveFrom_idx" ON "Contract"("clientId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRate_contractId_title_key" ON "ContractRate"("contractId", "title");

-- CreateIndex
CREATE INDEX "TimeEntry_clientId_employeeId_workDate_idx" ON "TimeEntry"("clientId", "employeeId", "workDate");

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractRate" ADD CONSTRAINT "ContractRate_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
