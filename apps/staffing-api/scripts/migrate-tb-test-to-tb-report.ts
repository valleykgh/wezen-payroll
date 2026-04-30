import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting TB_TEST -> TB_REPORT migration...');

  const before = await prisma.professionalDocument.count({
    where: { category: 'TB_TEST' as any },
  });

  console.log(`TB_TEST documents found: ${before}`);

  if (before === 0) {
    console.log('No records to migrate.');
    return;
  }

  const result = await prisma.professionalDocument.updateMany({
    where: { category: 'TB_TEST' as any },
    data: { category: 'TB_REPORT' as any },
  });

  const after = await prisma.professionalDocument.count({
    where: { category: 'TB_TEST' as any },
  });

  const tbReportCount = await prisma.professionalDocument.count({
    where: { category: 'TB_REPORT' as any },
  });

  console.log(`Migrated records: ${result.count}`);
  console.log(`Remaining TB_TEST records: ${after}`);
  console.log(`Total TB_REPORT records now: ${tbReportCount}`);
  console.log('Migration complete.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
