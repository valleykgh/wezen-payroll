const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  await client.connect();

  await client.query(`
    UPDATE "User" u
    SET "workerCode" =
      'WZN-' || FLOOR(RANDOM()*900000+100000)::text
    FROM "ProfessionalProfile" p
    WHERE p."userId" = u.id
      AND p."approvedByWezen" = true
      AND u."workerCode" IS NULL
  `);

  const result = await client.query(`
    SELECT COUNT(*) AS count
    FROM "User"
    WHERE "workerCode" IS NOT NULL
  `);

  console.log(result.rows);

  await client.end();
}

main().catch(console.error);
