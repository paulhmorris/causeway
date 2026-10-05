import { ReconciliationStatus } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import type { StatementLine } from "~/lib/bank-statement";

dayjs.extend(utc);

const logger = createLogger("ReconciliationService");

export const ReconciliationService = {
  /**
   * Causeway's balance for an account through the end of `statementDate`.
   * Voided transactions are excluded, matching every other balance in the app.
   *
   * Dates are handled in UTC because transactions are stored at UTC midnight
   * (see the transaction schema); using local time would drop or include a
   * day's activity depending on the server's timezone.
   */
  async getBookBalanceInCents(accountId: string, orgId: string, statementDate: Date | string): Promise<number> {
    const through = dayjs.utc(statementDate).endOf("day").toDate();

    const result = await db.transaction.aggregate({
      where: { accountId, orgId, voidedAt: null, date: { lte: through } },
      _sum: { amountInCents: true },
    });

    return result._sum.amountInCents ?? 0;
  },

  /**
   * Create a reconciliation, storing the book balance as of the statement date
   * so the comparison stays reproducible even as later transactions are added.
   * Statement lines are optional — an account can be reconciled on its closing
   * balance alone.
   */
  async create({
    accountId,
    orgId,
    statementDate,
    statementBalanceInCents,
    notes,
    lines,
  }: {
    accountId: string;
    orgId: string;
    statementDate: Date;
    statementBalanceInCents: number;
    notes?: string;
    lines: Array<StatementLine>;
  }) {
    // Confirm the account belongs to this org before writing anything.
    await db.account.findUniqueOrThrow({ where: { id: accountId, orgId }, select: { id: true } });

    const bookBalanceInCents = await this.getBookBalanceInCents(accountId, orgId, statementDate);

    const reconciliation = await db.reconciliation.create({
      data: {
        orgId,
        accountId,
        statementDate,
        statementBalanceInCents,
        bookBalanceInCents,
        notes,
        status: ReconciliationStatus.IN_PROGRESS,
        lines: {
          createMany: {
            data: lines.map((line) => ({
              orgId,
              date: dayjs.utc(line.date).startOf("day").toDate(),
              description: line.description,
              amountInCents: line.amountInCents,
            })),
          },
        },
      },
      select: { id: true, statementBalanceInCents: true, bookBalanceInCents: true },
    });

    logger.info("Reconciliation created", {
      orgId,
      accountId,
      reconciliationId: reconciliation.id,
      lineCount: lines.length,
      differenceInCents: reconciliation.statementBalanceInCents - reconciliation.bookBalanceInCents,
    });

    return reconciliation;
  },
};
