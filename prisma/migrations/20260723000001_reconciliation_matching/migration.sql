-- AlterTable
ALTER TABLE "ReconciliationLine" ADD COLUMN     "ignoredAt" TIMESTAMP(3),
ADD COLUMN     "transactionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ReconciliationLine_transactionId_key" ON "ReconciliationLine"("transactionId");

-- AddForeignKey
ALTER TABLE "ReconciliationLine" ADD CONSTRAINT "ReconciliationLine_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

