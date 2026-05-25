INSERT INTO "EmployeeExternalMapping"
(
  "id",
  "employeeId",
  "externalSystem",
  "externalEmployeeId",
  "active",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  e.id,
  'UKG',
  'UKG1001',
  true,
  NOW(),
  NOW()
FROM "Employee" e
LIMIT 1;
