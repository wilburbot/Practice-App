-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Team_shareToken_key" ON "Team"("shareToken");

