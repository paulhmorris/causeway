import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { ContactType, TransactionCategory, TransactionItemType } from "~/lib/constants";
import {
  analyzeRecords,
  matchContact,
  matchPaymentMethod,
  type ImportRecord,
  type RowAnalysis,
} from "~/lib/tithely-import";

dayjs.extend(utc);

const logger = createLogger("DonationImportService");

type AnalyzeArgs = {
  records: Array<ImportRecord>;
  fundAccounts: Record<string, string>;
  defaultAccountId: string | null;
  orgId: string;
};

export type ImportSummary = {
  imported: number;
  contactsCreated: number;
  skipped: number;
};

export const DonationImportService = {
  /**
   * Classify every record against the org's current data. Contacts are loaded
   * in full (orgs here have hundreds, not millions) and existing transactions
   * are narrowed to the date range covered by the file.
   */
  async analyze({ records, fundAccounts, defaultAccountId, orgId }: AnalyzeArgs): Promise<Array<RowAnalysis>> {
    if (records.length === 0) return [];

    // UTC to match how transaction dates are stored (see the transaction schema).
    const dates = records.map((r) => r.date).sort();
    const from = dayjs.utc(dates[0]).startOf("day").toDate();
    const to = dayjs
      .utc(dates[dates.length - 1])
      .endOf("day")
      .toDate();

    const [contacts, transactions] = await Promise.all([
      db.contact.findMany({
        where: { orgId },
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      // Voided transactions are excluded so a corrected gift can be re-imported.
      db.transaction.findMany({
        where: { orgId, voidedAt: null, date: { gte: from, lte: to } },
        select: { id: true, date: true, amountInCents: true, contactId: true },
      }),
    ]);

    return analyzeRecords({ records, contacts, transactions, fundAccounts, defaultAccountId });
  },

  /**
   * Import the selected rows. The analysis is re-run server-side rather than
   * trusted from the client, so a row that became a duplicate since the preview
   * — or that points at an account outside this org — is never written.
   */
  async execute({
    records,
    fundAccounts,
    defaultAccountId,
    selectedRowIndexes,
    orgId,
  }: AnalyzeArgs & { selectedRowIndexes: Array<number> }): Promise<ImportSummary> {
    const analyses = await this.analyze({ records, fundAccounts, defaultAccountId, orgId });
    const analysisByRow = new Map(analyses.map((a) => [a.rowIndex, a]));
    const selected = new Set(selectedRowIndexes);

    const toImport = records.filter((record) => {
      const analysis = analysisByRow.get(record.rowIndex);
      return selected.has(record.rowIndex) && analysis?.status === "ready";
    });

    if (toImport.length === 0) {
      return { imported: 0, contactsCreated: 0, skipped: selectedRowIndexes.length };
    }

    // Confirm every target account belongs to this org before writing anything.
    const accountIds = [...new Set(toImport.map((r) => analysisByRow.get(r.rowIndex)!.accountId!))];
    const ownedAccounts = await db.account.findMany({
      where: { id: { in: accountIds }, orgId },
      select: { id: true },
    });
    if (ownedAccounts.length !== accountIds.length) {
      throw new Error("One or more selected accounts do not belong to this organization.");
    }

    let contactsCreated = 0;

    await db.$transaction(async (tx) => {
      // Contacts created during this import, so two rows for the same new donor
      // share one contact instead of colliding on the unique email constraint.
      const created: Array<{ id: string; firstName: string | null; lastName: string | null; email: string | null }> =
        [];

      for (const record of toImport) {
        const analysis = analysisByRow.get(record.rowIndex)!;
        let contactId = analysis.matchedContactId;

        if (!contactId && analysis.willCreateContact) {
          const alreadyCreated = matchContact(record, created);
          if (alreadyCreated) {
            contactId = alreadyCreated.id;
          } else {
            const contact = await tx.contact.create({
              data: {
                orgId,
                typeId: ContactType.Donor,
                firstName: record.firstName,
                lastName: record.lastName,
                email: record.email,
              },
              select: { id: true, firstName: true, lastName: true, email: true },
            });
            created.push(contact);
            contactId = contact.id;
            contactsCreated++;
          }
        }

        await tx.transaction.create({
          data: {
            orgId,
            accountId: analysis.accountId!,
            contactId,
            date: dayjs.utc(record.date).startOf("day").toDate(),
            amountInCents: record.amountInCents,
            categoryId: TransactionCategory.Donation_Standard,
            description: record.note,
            transactionItems: {
              create: {
                orgId,
                amountInCents: record.amountInCents,
                typeId: TransactionItemType.Donation,
                methodId: matchPaymentMethod(record.paymentMethod),
                description: record.note,
              },
            },
          },
        });
      }
    });

    const summary: ImportSummary = {
      imported: toImport.length,
      contactsCreated,
      skipped: selectedRowIndexes.length - toImport.length,
    };
    logger.info("Donation import complete", { orgId, ...summary });
    return summary;
  },
};
