const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const file = process.argv[2];

  if (!file) {
    throw new Error('SQL file path required');
  }

  const fullPath = path.resolve(file);

  console.log('Running SQL file:', fullPath);

  const sql = fs.readFileSync(fullPath, 'utf8');

  await prisma.$executeRawUnsafe(sql);

  console.log('SQL migration completed successfully');
}

main()
  .catch(async (err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
