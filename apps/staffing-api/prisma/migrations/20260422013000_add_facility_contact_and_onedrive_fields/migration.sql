ALTER TABLE "Facility"
  ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'StorageProvider'
  ) THEN
    CREATE TYPE "StorageProvider" AS ENUM ('LOCAL', 'ONEDRIVE');
  END IF;
END
$$;

ALTER TABLE "ProfessionalDocument"
  ADD COLUMN IF NOT EXISTS "storageProvider" "StorageProvider" NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "oneDriveItemId" TEXT,
  ADD COLUMN IF NOT EXISTS "oneDriveWebUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "oneDrivePath" TEXT,
  ADD COLUMN IF NOT EXISTS "oneDriveFolder" TEXT,
  ADD COLUMN IF NOT EXISTS "mimeType" TEXT;
