-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "reimbursementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reimbursementId_key" ON "Transaction"("reimbursementId");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "ReimbursementRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
