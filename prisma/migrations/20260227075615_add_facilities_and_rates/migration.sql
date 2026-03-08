-- CreateTable
CREATE TABLE "Facility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Facility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityRate" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "title" "EmployeeTitle" NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "regRateCents" INTEGER NOT NULL,
    "otRateCents" INTEGER NOT NULL,
    "dtRateCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Facility_name_key" ON "Facility"("name");

-- CreateIndex
CREATE INDEX "FacilityRate_facilityId_title_effectiveFrom_idx" ON "FacilityRate"("facilityId", "title", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "FacilityRate" ADD CONSTRAINT "FacilityRate_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
