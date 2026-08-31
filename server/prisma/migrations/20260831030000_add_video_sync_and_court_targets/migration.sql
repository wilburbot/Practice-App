-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "videoStartedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StatEvent" ADD COLUMN     "targetX" DOUBLE PRECISION,
ADD COLUMN     "targetY" DOUBLE PRECISION;

