-- CreateTable
CREATE TABLE "TimeEntryBreak" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "minutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeEntryBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeEntryBreak_timeEntryId_idx" ON "TimeEntryBreak"("timeEntryId");

-- AddForeignKey
ALTER TABLE "TimeEntryBreak" ADD CONSTRAINT "TimeEntryBreak_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
