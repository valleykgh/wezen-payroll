"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = __importDefault(require("fs"));
const sync_1 = require("csv-parse/sync");
const prisma_1 = require("../../prisma");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const requireRole_1 = require("../../middleware/requireRole");
const router = express_1.default.Router();
const upload = (0, multer_1.default)({
    dest: '/tmp/payroll-imports'
});
router.use(authMiddleware_1.requireAuth);
router.use((0, requireRole_1.requireRole)('SUPER_ADMIN'));
router.post('/payroll-imports/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'File is required'
            });
        }
        const sourceSystem = String(req.body.sourceSystem || 'UKG').trim();
        const fileContents = fs_1.default.readFileSync(req.file.path, 'utf8');
        const records = (0, sync_1.parse)(fileContents, {
            columns: true,
            skip_empty_lines: true
        });
        const batch = await prisma_1.prisma.payrollImportBatch.create({
            data: {
                sourceSystem,
                rawPayload: { originalFileName: req.file.originalname },
                status: 'IMPORTED',
                totalPunches: records.length,
            }
        });
        let imported = 0;
        let failed = 0;
        for (const row of records) {
            try {
                const externalEmployeeId = String(row.employeeId ||
                    row.employee_id ||
                    row.badge ||
                    row.badge_id ||
                    '').trim();
                const timestampValue = row.timestamp ||
                    row.punchTime ||
                    row.punch_time;
                const rawPunchType = String(row.punchType ||
                    row.punch_type ||
                    row.type ||
                    '').trim();
                if (!externalEmployeeId || !timestampValue) {
                    failed += 1;
                    continue;
                }
                const punchTimestamp = new Date(timestampValue);
                const mapping = await prisma_1.prisma.employeeExternalMapping.findFirst({
                    where: {
                        externalSystem: sourceSystem,
                        externalEmployeeId,
                        active: true
                    }
                });
                await prisma_1.prisma.importedPunch.create({
                    data: {
                        payrollImportBatchId: batch.id,
                        sourceSystem,
                        externalEmployeeId,
                        employeeId: mapping?.employeeId || null,
                        punchType: rawPunchType,
                        punchTimestamp,
                        rawPayload: row,
                        processed: false
                    }
                });
                imported += 1;
            }
            catch (err) {
                console.error('Punch import failed', err);
                failed += 1;
            }
        }
        await prisma_1.prisma.payrollImportBatch.update({
            where: {
                id: batch.id
            },
            data: {
                status: failed > 0 ? 'PARTIAL' : 'COMPLETED',
                importCompletedAt: new Date()
            }
        });
        return res.json({
            ok: true,
            payrollImportBatchId: batch.id,
            imported,
            failed
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({
            error: 'Payroll import failed'
        });
    }
});
exports.default = router;
