const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  await client.connect();

  const sql = fs.readFileSync('./ukg-migration.sql', 'utf8');

  await client.query(sql);

  console.log('UKG payroll tables migrated successfully');

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
