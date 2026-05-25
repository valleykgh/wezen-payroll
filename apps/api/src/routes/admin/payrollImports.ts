import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

import { prisma } from '../../prisma';
import { requireAuth } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

const upload = multer({
  dest: '/tmp/payroll-imports'
});

router.use(requireAuth);

router.use(
  requireRole('SUPER_ADMIN'),
);

type CsvRow = Record<string, string>;

router.post(
  '/payroll-imports/upload',
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'File is required'
        });
      }

      const sourceSystem =
        String(req.body.sourceSystem || 'UKG').trim();

      const fileContents = fs.readFileSync(
        req.file.path,
        'utf8'
      );

      const records = parse(fileContents, {
        columns: true,
        skip_empty_lines: true
      }) as CsvRow[];

      const batch = await prisma.payrollImportBatch.create({
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
          const externalEmployeeId =
            String(
              row.employeeId ||
              row.employee_id ||
              row.badge ||
              row.badge_id ||
              ''
            ).trim();

          const timestampValue =
            row.timestamp ||
            row.punchTime ||
            row.punch_time;

          const rawPunchType =
            String(
              row.punchType ||
              row.punch_type ||
              row.type ||
              ''
            ).trim();

          if (!externalEmployeeId || !timestampValue) {
            failed += 1;
            continue;
          }

          const punchTimestamp =
            new Date(timestampValue);

          const mapping =
            await prisma.employeeExternalMapping.findFirst({
              where: {
                externalSystem: sourceSystem,
                externalEmployeeId,
                active: true
              }
            });

          await prisma.importedPunch.create({
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
        } catch (err) {
          console.error('Punch import failed', err);
          failed += 1;
        }
      }

      await prisma.payrollImportBatch.update({
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
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        error: 'Payroll import failed'
      });
    }
  }
);

export default router;
