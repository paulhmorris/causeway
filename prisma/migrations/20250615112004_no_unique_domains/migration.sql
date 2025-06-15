/*
  Warnings:

  - You are about to drop the column `administratorEmail` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `host` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `inquiriesEmail` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `replyToEmail` on the `Organization` table. All the data in the column will be lost.
  - You are about to drop the column `subdomain` on the `Organization` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Organization_host_key";

-- DropIndex
DROP INDEX "Organization_host_subdomain_key";

-- AlterTable
ALTER TABLE "Organization" DROP COLUMN "administratorEmail",
DROP COLUMN "host",
DROP COLUMN "inquiriesEmail",
DROP COLUMN "replyToEmail",
DROP COLUMN "subdomain",
ADD COLUMN     "primaryEmail" TEXT;

-- AlterTable
ALTER TABLE "_ReceiptToReimbursementRequest" ADD CONSTRAINT "_ReceiptToReimbursementRequest_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ReceiptToReimbursementRequest_AB_unique";

-- AlterTable
ALTER TABLE "_ReceiptToTransaction" ADD CONSTRAINT "_ReceiptToTransaction_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_ReceiptToTransaction_AB_unique";
