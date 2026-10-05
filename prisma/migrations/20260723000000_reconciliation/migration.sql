-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "Reconciliation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "statementDate" TIMESTAMP(3) NOT NULL,
    "statementBalanceInCents" INTEGER NOT NULL,
    "bookBalanceInCents" INTEGER NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "Reconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationLine" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "amountInCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "orgId" TEXT NOT NULL,

    CONSTRAINT "ReconciliationLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reconciliation_accountId_statementDate_idx" ON "Reconciliation"("accountId", "statementDate");

-- CreateIndex
CREATE INDEX "ReconciliationLine_reconciliationId_idx" ON "ReconciliationLine"("reconciliationId");

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reconciliation" ADD CONSTRAINT "Reconciliation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLine" ADD CONSTRAINT "ReconciliationLine_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "Reconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationLine" ADD CONSTRAINT "ReconciliationLine_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

