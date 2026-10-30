import { ReimbursementRequestStatus } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import type { ExpenseLine } from "~/lib/expense-report";

dayjs.extend(utc);

const logger = createLogger("ExpenseReportService");

export type ExpenseReportSummary = { created: number; totalInCents: number };

export const ExpenseReportService = {
  /**
   * Submit an expense report as a batch of reimbursement requests — one per
   * line — in a single database transaction, so the report is all-or-nothing.
   *
   * Every referenced account and receipt is re-checked against the org here
   * rather than trusted from the client, so a tampered payload can't attach
   * another org's receipt or bill another org's account.
   */
  async submit({ lines, userId, orgId }: { lines: Array<ExpenseLine>; userId: string; orgId: string }) {
    if (lines.length === 0) {
      throw new Error("An expense report needs at least one line.");
    }

    const accountIds = [...new Set(lines.map((l) => l.accountId))];
    const ownedAccounts = await db.account.findMany({
      where: { id: { in: accountIds }, orgId },
      select: { id: true },
    });
    if (ownedAccounts.length !== accountIds.length) {
      throw new Error("One or more accounts do not belong to this organization.");
    }

    const receiptIds = [...new Set(lines.flatMap((l) => l.receiptIds))];
    if (receiptIds.length > 0) {
      const ownedReceipts = await db.receipt.findMany({
        where: { id: { in: receiptIds }, orgId },
        select: { id: true },
      });
      if (ownedReceipts.length !== receiptIds.length) {
        throw new Error("One or more receipts could not be found.");
      }
    }

    const created = await db.$transaction(
      lines.map((line) =>
        db.reimbursementRequest.create({
          data: {
            orgId,
            userId,
            status: ReimbursementRequestStatus.PENDING,
            date: dayjs.utc(line.date).startOf("day").toDate(),
            vendor: line.vendor.trim() || null,
            description: line.description.trim() || null,
            amountInCents: line.amountInCents,
            accountId: line.accountId,
            methodId: line.methodId!,
            receipts: line.receiptIds.length ? { connect: line.receiptIds.map((id) => ({ id })) } : undefined,
          },
          select: { id: true },
        }),
      ),
    );

    const summary: ExpenseReportSummary = {
      created: created.length,
      totalInCents: lines.reduce((total, line) => total + line.amountInCents, 0),
    };
    logger.info("Expense report submitted", { orgId, userId, ...summary });
    return summary;
  },
};
