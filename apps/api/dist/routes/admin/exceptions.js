"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const prisma_1 = require("../../prisma");
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
router.get("/exceptions", async (req, res) => {
    try {
        const { facilityId, from, to } = req.query;
        if (!from || !to) {
            return res.status(400).json({ error: "from and to required" });
        }
        const fromDate = (0, _shared_1.startOfDayUTC)(from);
        const toExclusive = (0, _shared_1.startOfNextDayUTC)(to);
        const rows = await (0, _shared_1.getBillableWorkRows)({
            prisma: prisma_1.prisma,
            facilityId: facilityId && facilityId !== "ALL" ? String(facilityId) : undefined,
            from: fromDate,
            toExclusive,
        });
        const addedAfterFinalized = rows.filter((r) => r.addedAfterFinalizedWeek);
        const needsSupplemental = rows.filter((r) => !r.billedAt && r.invoiceType !== "REGULAR");
        const unpaid = rows.filter((r) => !r.payrollRunId && !r.paidNow);
        const adjustments = rows.filter((r) => r.sourceType === "PAYROLL_ADJUSTMENT");
        return res.json({
            addedAfterFinalized,
            needsSupplemental,
            unpaid,
            adjustments,
        });
    }
    catch (e) {
        return res.status(500).json({ error: e.message || "Failed to load exceptions" });
    }
});
exports.default = router;
