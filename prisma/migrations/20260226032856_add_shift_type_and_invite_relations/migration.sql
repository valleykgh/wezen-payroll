-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('AM', 'PM', 'NOC');

-- AlterTable
ALTER TABLE "Invite" ADD COLUMN     "createdById" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "shiftType" "ShiftType" NOT NULL DEFAULT 'AM';

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "mustChangePassword" SET DEFAULT false;

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
