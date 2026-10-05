-- Backfill Transaction.reimbursementId from the pre-FK convention, where a reimbursement-linked
-- transaction was identified only by its item description: 'Reimbursement ID: <cuid>'.
-- Without this, every reimbursement approved before this migration loses its transaction link.
--
-- Three things make a naive UPDATE...FROM unsafe here:
--   1. The old approval handler always INSERTed a new Transaction, so a reimbursement that was
--      reopened and re-approved has several matching transactions. reimbursementId is UNIQUE,
--      so we keep only the most recent and leave the rest NULL.
--   2. Descriptions may reference reimbursements that no longer exist. The FK would reject those,
--      so the JOIN filters them out.
--   3. Descriptions are free text and not org-scoped, so we require the transaction and the
--      reimbursement to belong to the same org before linking them.

WITH pairs AS (
    SELECT DISTINCT
        t.id         AS transaction_id,
        r.id         AS reimbursement_id,
        t."date"     AS trx_date,
        t."createdAt" AS trx_created
    FROM "Transaction" t
    JOIN "TransactionItem" ti
      ON ti."transactionId" = t.id
    JOIN "ReimbursementRequest" r
      ON r.id = substring(ti.description FROM '^Reimbursement ID: (.+)$')
     AND r."orgId" = t."orgId"
    WHERE ti.description LIKE 'Reimbursement ID: %'
),
ranked AS (
    SELECT
        transaction_id,
        reimbursement_id,
        -- one transaction per reimbursement (newest wins)
        ROW_NUMBER() OVER (
            PARTITION BY reimbursement_id
            ORDER BY trx_date DESC, trx_created DESC, transaction_id DESC
        ) AS rank_per_reimbursement,
        -- one reimbursement per transaction, for the pathological multi-item case
        ROW_NUMBER() OVER (
            PARTITION BY transaction_id
            ORDER BY reimbursement_id
        ) AS rank_per_transaction
    FROM pairs
)
UPDATE "Transaction" t
SET "reimbursementId" = ranked.reimbursement_id
FROM ranked
WHERE t.id = ranked.transaction_id
  AND ranked.rank_per_reimbursement = 1
  AND ranked.rank_per_transaction = 1
  AND t."reimbursementId" IS NULL;
