import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { ContactType, TransactionCategory, TransactionItemType } from "~/lib/constants";
import {
  analyzeRecords,
  matchContact,
  matchPaymentMethod,
  type ExistingContact,
  type ImportRecord,
  type RowAnalysis,
} from "~/lib/tithely-import";

dayjs.extend(utc);

const logger = createLogger("DonationImportService");

type AnalyzeArgs = {
  records: Array<ImportRecord>;
  fundAccounts: Record<string, string>;
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
  async analyze({ records, fundAccounts, orgId }: AnalyzeArgs): Promise<Array<RowAnalysis>> {
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

    return analyzeRecords({ records, contacts, transactions, fundAccounts });
  },

  /**
   * Import the selected rows. The analysis is re-run server-side rather than
   * trusted from the client, so a row that became a duplicate since the preview
   * — or that points at an account outside this org — is never written.
   *
   * Ids are generated up front so the whole import is three bulk inserts in one
   * batch transaction, which stays well inside Prisma's transaction timeout.
   */
  async execute({
    records,
    fundAccounts,
    selectedRowNumbers,
    orgId,
  }: AnalyzeArgs & { selectedRowNumbers: Array<number> }): Promise<ImportSummary> {
    const analyses = await this.analyze({ records, fundAccounts, orgId });
    const analysisByRow = new Map(analyses.map((a) => [a.rowNumber, a]));
    const selected = new Set(selectedRowNumbers);

    const toImport = records.flatMap((record) => {
      const analysis = analysisByRow.get(record.rowNumber);
      return selected.has(record.rowNumber) && analysis?.status === "ready" && analysis.accountId
        ? [{ record, analysis, accountId: analysis.accountId }]
        : [];
    });

    if (toImport.length === 0) {
      return { imported: 0, contactsCreated: 0, skipped: selectedRowNumbers.length };
    }

    const accountIds = [...new Set(toImport.map((r) => r.accountId))];
    const ownedAccounts = await db.account.count({ where: { id: { in: accountIds }, orgId } });
    if (ownedAccounts !== accountIds.length) {
      throw new Error("One or more selected accounts do not belong to this organization.");
    }

    // Two rows for the same new donor share one contact instead of colliding on the unique email.
    const newContacts: Array<ExistingContact> = [];
    const transactions: Array<Prisma.TransactionCreateManyInput> = [];
    const items: Array<Prisma.TransactionItemCreateManyInput> = [];

    for (const { record, analysis, accountId } of toImport) {
      let contactId = analysis.matchedContactId;
      if (!contactId && analysis.willCreateContact) {
        let contact = matchContact(record, newContacts);
        if (!contact) {
          contact = { id: randomUUID(), firstName: record.firstName, lastName: record.lastName, email: record.email };
          newContacts.push(contact);
        }
        contactId = contact.id;
      }

      const transactionId = randomUUID();
      transactions.push({
        id: transactionId,
        orgId,
        accountId,
        contactId,
        date: dayjs.utc(record.date).startOf("day").toDate(),
        amountInCents: record.amountInCents,
        categoryId: TransactionCategory.Donation_Standard,
        description: record.note,
      });
      items.push({
        orgId,
        transactionId,
        amountInCents: record.amountInCents,
        typeId: TransactionItemType.Donation,
        methodId: matchPaymentMethod(record.paymentMethod),
        description: record.note,
      });
    }

    await db.$transaction([
      db.contact.createMany({ data: newContacts.map((c) => ({ ...c, orgId, typeId: ContactType.Donor })) }),
      db.transaction.createMany({ data: transactions }),
      db.transactionItem.createMany({ data: items }),
    ]);

    const summary: ImportSummary = {
      imported: toImport.length,
      contactsCreated: newContacts.length,
      skipped: selectedRowNumbers.length - toImport.length,
    };
    logger.info("Donation import complete", { orgId, ...summary });
    return summary;
  },
};
