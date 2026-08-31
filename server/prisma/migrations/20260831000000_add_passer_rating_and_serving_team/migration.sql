-- CreateEnum
CREATE TYPE "ServingTeam" AS ENUM ('OWN', 'OPPONENT');

-- AlterTable
ALTER TABLE "StatEvent" ADD COLUMN     "passRating" INTEGER,
ADD COLUMN     "servingTeam" "ServingTeam";

