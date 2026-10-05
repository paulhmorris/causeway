import { ReconciliationStatus } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import type { StatementLine } from "~/lib/bank-statement";
import { matchStatementLines } from "~/lib/reconciliation-match";

dayjs.extend(utc);

const logger = createLogger("ReconciliationService");

/** Widen the engine's date window to the whole period; candidates are already
 * bounded to it, so the window only needs to break ties, not exclude. */
const PERIOD_DATE_WINDOW_DAYS = 45;

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

  /**
   * The transactions eligible to match this reconciliation: same account, not
   * voided, dated within the period, and not already matched to any line. The
   * period runs from the day after the previous reconciliation for this account
   * through the statement date, so old cleared activity can't be re-matched.
   */
  async getCandidateTransactions(reconciliation: {
    id: string;
    accountId: string;
    orgId: string;
    statementDate: Date;
  }) {
    const previous = await db.reconciliation.findFirst({
      where: {
        accountId: reconciliation.accountId,
        orgId: reconciliation.orgId,
        statementDate: { lt: reconciliation.statementDate },
        id: { not: reconciliation.id },
      },
      orderBy: { statementDate: "desc" },
      select: { statementDate: true },
    });

    const gte = previous ? dayjs.utc(previous.statementDate).endOf("day").toDate() : undefined;
    const lte = dayjs.utc(reconciliation.statementDate).endOf("day").toDate();

    return db.transaction.findMany({
      where: {
        accountId: reconciliation.accountId,
        orgId: reconciliation.orgId,
        voidedAt: null,
        reconciliationLine: { is: null },
        date: gte ? { gt: gte, lte } : { lte },
      },
      select: {
        id: true,
        date: true,
        amountInCents: true,
        description: true,
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { date: "asc" },
    });
  },

  /**
   * Auto-match this reconciliation's still-unresolved lines against its
   * candidate transactions, writing the matches. Lines already matched or
   * ignored are left untouched. Returns how many new matches were made.
   */
  async autoMatch(reconciliationId: string, orgId: string): Promise<number> {
    const reconciliation = await db.reconciliation.findUniqueOrThrow({
      where: { id: reconciliationId, orgId },
      select: {
        id: true,
        accountId: true,
        orgId: true,
        statementDate: true,
        lines: {
          where: { transactionId: null, ignoredAt: null },
          select: { id: true, date: true, amountInCents: true },
        },
      },
    });

    if (reconciliation.lines.length === 0) return 0;

    const candidates = await this.getCandidateTransactions(reconciliation);
    const { matches } = matchStatementLines(reconciliation.lines, candidates, {
      dateWindowDays: PERIOD_DATE_WINDOW_DAYS,
    });

    if (matches.length > 0) {
      await db.$transaction(
        matches.map((m) =>
          db.reconciliationLine.update({
            where: { id: m.lineId, orgId },
            data: { transactionId: m.transactionId },
          }),
        ),
      );
    }

    logger.info("Auto-matched reconciliation", { orgId, reconciliationId, matched: matches.length });
    return matches.length;
  },

  /**
   * Manually match one line to one transaction. Guards that both belong to the
   * org and the reconciliation's account, and that neither is already matched,
   * so a manual action can't create a double match the unique index would reject
   * with a raw error.
   */
  async matchLine(reconciliationId: string, lineId: string, transactionId: string, orgId: string) {
    const reconciliation = await db.reconciliation.findUniqueOrThrow({
      where: { id: reconciliationId, orgId },
      select: { accountId: true },
    });

    const line = await db.reconciliationLine.findUniqueOrThrow({
      where: { id: lineId, orgId, reconciliationId },
      select: { id: true, transactionId: true },
    });
    if (line.transactionId) {
      throw new Error("That statement line is already matched.");
    }

    const transaction = await db.transaction.findUniqueOrThrow({
      where: { id: transactionId, orgId },
      select: { id: true, accountId: true, voidedAt: true, reconciliationLine: { select: { id: true } } },
    });
    if (transaction.accountId !== reconciliation.accountId) {
      throw new Error("That transaction belongs to a different account.");
    }
    if (transaction.voidedAt) {
      throw new Error("That transaction has been voided.");
    }
    if (transaction.reconciliationLine) {
      throw new Error("That transaction is already matched to another line.");
    }

    await db.reconciliationLine.update({ where: { id: lineId, orgId }, data: { transactionId } });
    logger.info("Manually matched line", { orgId, reconciliationId, lineId, transactionId });
  },

  /** Clear a line's match, returning its transaction to the candidate pool. */
  async unmatchLine(lineId: string, orgId: string) {
    await db.reconciliationLine.update({ where: { id: lineId, orgId }, data: { transactionId: null } });
    logger.info("Unmatched line", { orgId, lineId });
  },

  /** Toggle whether a line is ignored (needs no matching transaction). */
  async setLineIgnored(lineId: string, orgId: string, ignored: boolean) {
    await db.reconciliationLine.update({
      where: { id: lineId, orgId },
      data: { ignoredAt: ignored ? new Date() : null },
    });
    logger.info("Set line ignored", { orgId, lineId, ignored });
  },
};
