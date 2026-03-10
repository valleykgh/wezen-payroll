import express from "express";

import billingExportRoutes from "./admin/billingExport";
import employeeRoutes from "./admin/employees";
import facilityRoutes from "./admin/facilities";
import facilityRateRoutes from "./admin/facilityRates";
import paySummaryRoutes from "./admin/paySummary";
import payrollAdjustmentRoutes from "./admin/payrollAdjustments";
import loanRoutes from "./admin/loans";
import timeEntryRoutes from "./admin/timeEntries";
import payrollCorrectionsRoutes from "./admin/payrollCorrections";
import earlyPayrollRoutes from "./admin/earlyPayroll";
import payrollPreviewRoutes from "./admin/payrollPreview";
import payrollFinalizeRoutes from "./admin/payrollFinalize";
import payrollRunRoutes from "./admin/payrollRuns";

export const adminTimeRoutes = express.Router();

adminTimeRoutes.use(billingExportRoutes);
adminTimeRoutes.use(employeeRoutes);
adminTimeRoutes.use(facilityRoutes);
adminTimeRoutes.use(facilityRateRoutes);
adminTimeRoutes.use(loanRoutes);
adminTimeRoutes.use(paySummaryRoutes);
adminTimeRoutes.use(payrollAdjustmentRoutes);
adminTimeRoutes.use(timeEntryRoutes);
adminTimeRoutes.use(payrollCorrectionsRoutes);
adminTimeRoutes.use(earlyPayrollRoutes);
adminTimeRoutes.use(payrollPreviewRoutes);
adminTimeRoutes.use(payrollFinalizeRoutes);
adminTimeRoutes.use(payrollRunRoutes);
