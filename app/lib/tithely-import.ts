import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import utc from "dayjs/plugin/utc";

import { TransactionItemMethod } from "~/lib/constants";
import { parseCurrencyToCents, type ParsedCsv } from "~/lib/csv";

dayjs.extend(customParseFormat);
dayjs.extend(utc);

export type ImportFieldKey =
  | "date"
  | "amount"
  | "firstName"
  | "lastName"
  | "email"
  | "fund"
  | "paymentMethod"
  | "fee"
  | "note";

/** Generic over the key so other CSV importers can reuse the mapper shape. */
export type ImportField<K extends string = ImportFieldKey> = {
  key: K;
  label: string;
  required: boolean;
  help?: string;
  /** Normalized header candidates used to auto-detect the source column. */
  aliases: Array<string>;
};

/**
 * The Causeway fields a Tithe.ly giving export can be mapped onto. Only `date`
 * and `amount` are required to create a transaction; the rest enrich the donor
 * contact and the transaction record.
 */
export const importFields: Array<ImportField> = [
  {
    key: "date",
    label: "Gift date",
    required: true,
    aliases: ["date", "giftdate", "transactiondate", "createddate", "createdat"],
  },
  {
    key: "amount",
    label: "Amount",
    required: true,
    help: "Gross gift amount",
    aliases: ["amount", "grossamount", "giftamount", "totalamount", "total"],
  },
  { key: "firstName", label: "Donor first name", required: false, aliases: ["firstname", "first"] },
  { key: "lastName", label: "Donor last name", required: false, aliases: ["lastname", "last"] },
  { key: "email", label: "Donor email", required: false, aliases: ["email", "emailaddress", "giveremail"] },
  {
    key: "fund",
    label: "Fund",
    required: false,
    help: "You'll match this to an account in the next step",
    aliases: ["fund", "fundname", "designation", "category"],
  },
  {
    key: "paymentMethod",
    label: "Payment method",
    required: false,
    aliases: ["paymentmethod", "method", "paymenttype"],
  },
  { key: "fee", label: "Processing fee", required: false, aliases: ["fee", "fees", "processingfee"] },
  { key: "note", label: "Note / memo", required: false, aliases: ["note", "notes", "memo", "comment", "comments"] },
];

/** Sentinel used by the mapper UI to represent "not mapped to any column". */
export const UNMAPPED = -1;

export type ColumnMapping = Record<ImportFieldKey, number>;

export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Guess a source column index for each import field by matching normalized CSV
 * headers against each field's aliases. Unmatched fields map to UNMAPPED.
 */
export function autoDetectMapping(headers: Array<string>): ColumnMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as ColumnMapping;
  for (const field of importFields) {
    mapping[field.key] = normalized.findIndex((h) => field.aliases.includes(h));
  }
  return mapping;
}

/** Import fields whose required source column has not yet been mapped. */
export function missingRequiredFields(mapping: ColumnMapping): Array<ImportField> {
  return importFields.filter((f) => f.required && (mapping[f.key] ?? UNMAPPED) === UNMAPPED);
}

/**
 * Date formats seen in Tithe.ly exports and spreadsheet re-saves, tried in
 * order. Parsed strictly so that "3/4/2026" isn't silently read as a time.
 */
const DATE_FORMATS = ["YYYY-MM-DD", "M/D/YYYY", "MM/DD/YYYY", "M-D-YYYY", "YYYY/MM/DD", "M/D/YY", "MMM D, YYYY"];

/** Parse a date cell into a YYYY-MM-DD string, or null if unrecognizable. */
export function parseImportDate(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(value, format, true);
    if (parsed.isValid()) return parsed.format("YYYY-MM-DD");
  }

  // Fall back to loose parsing so ISO timestamps ("2026-03-04T12:00:00Z") work.
  const loose = dayjs(value);
  return loose.isValid() ? loose.format("YYYY-MM-DD") : null;
}

/** One CSV row normalized into the shape the importer works with. */
export type ImportRecord = {
  /** Zero-based index into the CSV's data rows, used to tie back to the file. */
  rowIndex: number;
  date: string;
  amountInCents: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  fund: string | null;
  paymentMethod: string | null;
  note: string | null;
};

export type RowError = { rowIndex: number; message: string };

function cell(row: Array<string>, index: number): string | null {
  if (index === UNMAPPED) return null;
  const value = (row[index] ?? "").trim();
  return value === "" ? null : value;
}

/**
 * Turn parsed CSV rows into import records using the admin's column mapping.
 * Rows with an unusable date or amount are collected as errors rather than
 * silently dropped, so the preview can show exactly which lines need attention.
 */
export function toImportRecords(parsed: ParsedCsv, mapping: ColumnMapping) {
  const records: Array<ImportRecord> = [];
  const errors: Array<RowError> = [];

  parsed.rows.forEach((row, rowIndex) => {
    const rawDate = cell(row, mapping.date);
    const rawAmount = cell(row, mapping.amount);

    // Skip rows that are entirely blank rather than reporting them as errors.
    if (row.every((c) => c.trim() === "")) return;

    const date = parseImportDate(rawDate);
    if (!date) {
      errors.push({ rowIndex, message: rawDate ? `Unrecognized date "${rawDate}"` : "Missing date" });
      return;
    }

    const amountInCents = parseCurrencyToCents(rawAmount);
    if (amountInCents === null) {
      errors.push({ rowIndex, message: rawAmount ? `Unrecognized amount "${rawAmount}"` : "Missing amount" });
      return;
    }
    if (amountInCents === 0) {
      errors.push({ rowIndex, message: "Amount is $0.00" });
      return;
    }

    records.push({
      rowIndex,
      date,
      amountInCents,
      firstName: cell(row, mapping.firstName),
      lastName: cell(row, mapping.lastName),
      email: cell(row, mapping.email),
      fund: cell(row, mapping.fund),
      paymentMethod: cell(row, mapping.paymentMethod),
      note: cell(row, mapping.note),
    });
  });

  return { records, errors };
}

/** The distinct fund names in a set of records, in first-seen order. */
export function distinctFunds(records: Array<ImportRecord>): Array<string> {
  const seen = new Set<string>();
  const funds: Array<string> = [];
  for (const record of records) {
    if (record.fund && !seen.has(record.fund)) {
      seen.add(record.fund);
      funds.push(record.fund);
    }
  }
  return funds;
}

export type ExistingContact = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
};

export type ExistingTransaction = {
  id: string;
  date: Date | string;
  amountInCents: number;
  contactId: string | null;
};

function nameKey(firstName: string | null, lastName: string | null): string | null {
  const first = (firstName ?? "").trim().toLowerCase();
  const last = (lastName ?? "").trim().toLowerCase();
  if (!first || !last) return null;
  return `${first} ${last}`;
}

/**
 * Find the contact a donation row belongs to. Email is authoritative because
 * it's unique per org; a full first+last name match is the fallback for rows
 * where Tithe.ly has no email on file. A first name alone is never enough.
 */
export function matchContact(
  record: Pick<ImportRecord, "firstName" | "lastName" | "email">,
  contacts: Array<ExistingContact>,
): ExistingContact | null {
  if (record.email) {
    const email = record.email.toLowerCase();
    const byEmail = contacts.find((c) => c.email?.toLowerCase() === email);
    if (byEmail) return byEmail;
  }

  const key = nameKey(record.firstName, record.lastName);
  if (!key) return null;

  const byName = contacts.filter((c) => nameKey(c.firstName, c.lastName) === key);
  // Ambiguous name matches are left unmatched so the importer doesn't guess.
  return byName.length === 1 ? byName[0] : null;
}

/**
 * A row is treated as already imported when a non-voided transaction exists on
 * the same day, for the same amount, against the same contact. Voided
 * transactions are excluded by the caller so a corrected gift can be re-imported.
 *
 * Dates are compared in UTC because transactions are stored at UTC midnight
 * (see the transaction schema); comparing in local time would shift a gift to
 * the previous day west of UTC and let a duplicate through.
 */
export function findDuplicateTransaction(
  record: Pick<ImportRecord, "date" | "amountInCents">,
  contactId: string | null,
  transactions: Array<ExistingTransaction>,
): ExistingTransaction | null {
  return (
    transactions.find(
      (t) =>
        t.amountInCents === record.amountInCents &&
        t.contactId === contactId &&
        dayjs.utc(t.date).format("YYYY-MM-DD") === record.date,
    ) ?? null
  );
}

/**
 * Map a Tithe.ly payment method string onto a Causeway transaction item method.
 * Falls back to Tithe.ly itself when the value is missing or unrecognized, so
 * an imported gift is never silently mislabeled.
 */
export function matchPaymentMethod(value: string | null | undefined): TransactionItemMethod {
  const normalized = (value ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!normalized) return TransactionItemMethod.Tithely;

  if (normalized.includes("paypal")) return TransactionItemMethod.PayPal;
  if (normalized.includes("debit")) return TransactionItemMethod.Debit_Card;
  if (normalized.includes("credit") || normalized === "card" || normalized === "cc") {
    return TransactionItemMethod.Credit_Card;
  }
  if (normalized.includes("ach") || normalized.includes("bank") || normalized.includes("echeck")) {
    return TransactionItemMethod.ACH;
  }
  // Checked after echeck/ach so "eCheck" isn't read as a paper check.
  if (normalized.includes("check")) return TransactionItemMethod.Check;
  if (normalized.includes("cash")) return TransactionItemMethod.Other;

  return TransactionItemMethod.Tithely;
}

export type RowStatus = "ready" | "duplicate" | "error";

export type RowAnalysis = {
  rowIndex: number;
  status: RowStatus;
  /** Why a row is a duplicate or an error; null when the row is ready. */
  message: string | null;
  contactLabel: string;
  matchedContactId: string | null;
  willCreateContact: boolean;
  accountId: string | null;
};

/** Human-readable donor label for the preview table. */
export function contactLabel(record: Pick<ImportRecord, "firstName" | "lastName" | "email">): string {
  const name = [record.firstName, record.lastName].filter(Boolean).join(" ").trim();
  if (name !== "") return name;
  return record.email ?? "Anonymous";
}

/**
 * Classify every record against the org's existing contacts and transactions.
 * Pure so it can be unit tested; the service layer supplies the DB reads.
 *
 * `fundAccounts` maps a CSV fund name to an account id, and `defaultAccountId`
 * covers records with no fund (or files with no fund column at all).
 */
export function analyzeRecords({
  records,
  contacts,
  transactions,
  fundAccounts,
  defaultAccountId,
}: {
  records: Array<ImportRecord>;
  contacts: Array<ExistingContact>;
  transactions: Array<ExistingTransaction>;
  fundAccounts: Record<string, string>;
  defaultAccountId: string | null;
}): Array<RowAnalysis> {
  return records.map((record) => {
    const matched = matchContact(record, contacts);
    const label = contactLabel(record);
    // An empty string is the "don't import rows for this fund" sentinel.
    const chosen = record.fund ? fundAccounts[record.fund] : defaultAccountId;
    const accountId = chosen === undefined || chosen === "" ? null : chosen;

    const base = {
      rowIndex: record.rowIndex,
      contactLabel: label,
      matchedContactId: matched?.id ?? null,
      // Anonymous rows (no name and no email) don't get a contact created.
      willCreateContact: !matched && Boolean(record.email ?? nameKey(record.firstName, record.lastName)),
      accountId,
    };

    if (!accountId) {
      return {
        ...base,
        status: "error" as const,
        message: record.fund ? `No account chosen for fund "${record.fund}"` : "No account chosen",
      };
    }

    const duplicate = findDuplicateTransaction(record, matched?.id ?? null, transactions);
    if (duplicate) {
      return { ...base, status: "duplicate" as const, message: "Already in Causeway" };
    }

    return { ...base, status: "ready" as const, message: null };
  });
}
