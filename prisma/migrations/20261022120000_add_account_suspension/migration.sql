-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'USER_SUSPENDED';

-- AlterEnum
ALTER TYPE "EventType" ADD VALUE 'USER_REINSTATED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspended_at" TIMESTAMP(3),
ADD COLUMN     "suspension_reason" TEXT;

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");
