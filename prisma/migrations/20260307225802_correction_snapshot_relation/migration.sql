-- AddForeignKey
ALTER TABLE "PayrollCorrection" ADD CONSTRAINT "PayrollCorrection_payrollRunSnapshotId_fkey" FOREIGN KEY ("payrollRunSnapshotId") REFERENCES "PayrollRunEntrySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
