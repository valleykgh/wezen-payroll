import express from "express";

import facilitiesRoutes from "./facilities";
import employeesRoutes from "./employees";
import loansRoutes from "./loans";
import billingExportRoutes from "./billingExport";
import timeEntriesRoutes from "./timeEntries";
import payrollRoutes from "./payroll";
import utilsRoutes from "./utils";

const router = express.Router();

router.use("/", facilitiesRoutes);
router.use("/", employeesRoutes);
router.use("/", loansRoutes);
router.use("/", billingExportRoutes);
router.use("/", timeEntriesRoutes);
router.use("/", payrollRoutes);
router.use("/", utilsRoutes);

export default router;
