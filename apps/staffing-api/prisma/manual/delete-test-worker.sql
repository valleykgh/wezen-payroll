DELETE FROM "WorkerNotification"
WHERE "professionalId" IN (
  SELECT p.id
  FROM "ProfessionalProfile" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email IN (
    'kanwal.chawla@gmail.com',
    'alisssonrodriguez760@gmail.com',
    'delacruzventura@icloud.com',
    'lexya@wezenstaffing.com',
    'valley.chawla@gmail.com'
  )
);

DELETE FROM "FacilityDnr"
WHERE "professionalId" IN (
  SELECT p.id
  FROM "ProfessionalProfile" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email IN (
    'kanwal.chawla@gmail.com',
    'alisssonrodriguez760@gmail.com',
    'delacruzventura@icloud.com',
    'lexya@wezenstaffing.com',
    'valley.chawla@gmail.com'
  )
);

DELETE FROM "ProfessionalAgreement"
WHERE "professionalId" IN (
  SELECT p.id
  FROM "ProfessionalProfile" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email IN (
    'kanwal.chawla@gmail.com',
    'alisssonrodriguez760@gmail.com',
    'delacruzventura@icloud.com',
    'lexya@wezenstaffing.com',
    'valley.chawla@gmail.com'
  )
);

DELETE FROM "ProfessionalDocument"
WHERE "professionalId" IN (
  SELECT p.id
  FROM "ProfessionalProfile" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email IN (
    'kanwal.chawla@gmail.com',
    'alisssonrodriguez760@gmail.com',
    'delacruzventura@icloud.com',
    'lexya@wezenstaffing.com',
    'valley.chawla@gmail.com'
  )
);

DELETE FROM "ShiftRequest"
WHERE "professionalId" IN (
  SELECT p.id
  FROM "ProfessionalProfile" p
  JOIN "User" u ON u.id = p."userId"
  WHERE u.email IN (
    'kanwal.chawla@gmail.com',
    'alisssonrodriguez760@gmail.com',
    'delacruzventura@icloud.com',
    'lexya@wezenstaffing.com',
    'valley.chawla@gmail.com'
  )
);

DELETE FROM "ProfessionalProfile"
WHERE "userId" IN (
  SELECT id
  FROM "User"
  WHERE email IN (
    'kanwal.chawla@gmail.com',
    'alisssonrodriguez760@gmail.com',
    'delacruzventura@icloud.com',
    'lexya@wezenstaffing.com',
    'valley.chawla@gmail.com'
  )
);

DELETE FROM "User"
WHERE email IN (
  'kanwal.chawla@gmail.com',
  'alisssonrodriguez760@gmail.com',
  'delacruzventura@icloud.com',
  'lexya@wezenstaffing.com',
  'valley.chawla@gmail.com'
);
