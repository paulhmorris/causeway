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
  | "note"
  | "status"
  | "refundedAt";

export type ImportField = {
  key: ImportFieldKey;
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
    aliases: ["date", "giftdate", "transactiondate", "createddate", "createdat", "createdatdate"],
  },
  {
    key: "amount",
    label: "Amount",
    required: true,
    help: "Gross gift amount",
    aliases: ["amount", "gross", "grossamount", "giftamount", "totalamount", "total"],
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
  {
    key: "status",
    label: "Payment status",
    required: false,
    help: "Only completed payments are imported",
    aliases: ["status", "transactionstatus", "paymentstatus"],
  },
  {
    key: "refundedAt",
    label: "Refund date",
    required: false,
    help: "Refunded gifts are skipped",
    aliases: ["refundedatdate", "refundedat", "refunddate", "refundeddate"],
  },
];

/** Payment statuses that mean the money actually arrived. */
const COMPLETED_STATUSES = ["succeeded", "success", "completed", "complete", "paid", "settled"];

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

/** Map `key` to `column`, unmapping any other field that was using that column. */
export function assignColumn(mapping: ColumnMapping, key: ImportFieldKey, column: number): ColumnMapping {
  const next = { ...mapping, [key]: column };
  if (column === UNMAPPED) return next;
  for (const field of importFields) {
    if (field.key !== key && next[field.key] === column) next[field.key] = UNMAPPED;
  }
  return next;
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

  // Take the calendar date of an ISO timestamp as written, ignoring its offset.
  const isoDate = /^(\d{4}-\d{2}-\d{2})[T ]/.exec(value)?.[1];
  if (isoDate) return dayjs(isoDate, "YYYY-MM-DD", true).isValid() ? isoDate : null;

  const loose = dayjs(value);
  return loose.isValid() ? loose.format("YYYY-MM-DD") : null;
}

/** One CSV row normalized into the shape the importer works with. */
export type ImportRecord = {
  /** The row's spreadsheet row number; unique within a file, so it doubles as the row's id. */
  rowNumber: number;
  date: string;
  /** The gross gift, before Tithe.ly's processing fee. */
  amountInCents: number;
  feeInCents: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  fund: string | null;
  paymentMethod: string | null;
  note: string | null;
};

export type RowError = { rowNumber: number; message: string };

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

  parsed.rows.forEach((row, i) => {
    const rowNumber = parsed.rowNumbers[i];
    const rawDate = cell(row, mapping.date);
    const rawAmount = cell(row, mapping.amount);

    // Skip rows that are entirely blank rather than reporting them as errors.
    if (row.every((c) => c.trim() === "")) return;

    const status = cell(row, mapping.status);
    if (status && !COMPLETED_STATUSES.includes(status.toLowerCase())) {
      errors.push({ rowNumber, message: `Payment status is "${status}"` });
      return;
    }
    const refundedAt = cell(row, mapping.refundedAt);
    if (refundedAt) {
      errors.push({ rowNumber, message: `Refunded ${refundedAt}` });
      return;
    }

    const date = parseImportDate(rawDate);
    if (!date) {
      errors.push({ rowNumber, message: rawDate ? `Unrecognized date "${rawDate}"` : "Missing date" });
      return;
    }

    const amountInCents = parseCurrencyToCents(rawAmount);
    if (amountInCents === null) {
      errors.push({ rowNumber, message: rawAmount ? `Unrecognized amount "${rawAmount}"` : "Missing amount" });
      return;
    }
    if (amountInCents === 0) {
      errors.push({ rowNumber, message: "Amount is $0.00" });
      return;
    }
    if (amountInCents < 0) {
      errors.push({ rowNumber, message: "Negative amounts (refunds) aren't imported" });
      return;
    }

    const rawFee = cell(row, mapping.fee);
    const fee = rawFee ? parseCurrencyToCents(rawFee) : 0;
    if (fee === null) {
      errors.push({ rowNumber, message: `Unrecognized fee "${rawFee}"` });
      return;
    }
    // Some exports show the fee as a negative deduction.
    const feeInCents = Math.abs(fee);
    if (feeInCents >= amountInCents) {
      errors.push({ rowNumber, message: "Fee is as large as the gift" });
      return;
    }

    records.push({
      rowNumber,
      date,
      amountInCents,
      feeInCents,
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
 * the same day, for the same net amount, against the same contact. Voided
 * transactions are excluded by the caller so a corrected gift can be re-imported.
 *
 * Dates are compared in UTC because transactions are stored at UTC midnight
 * (see the transaction schema); comparing in local time would shift a gift to
 * the previous day west of UTC and let a duplicate through.
 */
export function findDuplicateTransaction(
  record: Pick<ImportRecord, "date" | "amountInCents" | "feeInCents">,
  contactId: string | null,
  transactions: Array<ExistingTransaction>,
): ExistingTransaction | null {
  return (
    transactions.find(
      (t) =>
        t.amountInCents === record.amountInCents - record.feeInCents &&
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

export type RowStatus = "ready" | "duplicate" | "skipped" | "error";

export type RowAnalysis = {
  rowNumber: number;
  status: RowStatus;
  /** Why a row isn't ready; null when it is. */
  message: string | null;
  contactLabel: string;
  matchedContactId: string | null;
  willCreateContact: boolean;
  accountId: string | null;
};

/** `fundAccounts` key for records with no fund (or files with no fund column). */
export const NO_FUND = "__none__";
/** `fundAccounts` value meaning "don't import rows for this fund". */
export const SKIP_FUND = "__skip__";

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
 * `fundAccounts` maps a CSV fund name (or `NO_FUND`) to an account id or `SKIP_FUND`.
 * Each existing transaction can only mark one row as a duplicate, so a donor's
 * second identical gift in the file is still imported.
 */
export function analyzeRecords({
  records,
  contacts,
  transactions,
  fundAccounts,
}: {
  records: Array<ImportRecord>;
  contacts: Array<ExistingContact>;
  transactions: Array<ExistingTransaction>;
  fundAccounts: Record<string, string>;
}): Array<RowAnalysis> {
  const unclaimed = [...transactions];

  return records.map((record) => {
    const matched = matchContact(record, contacts);
    const chosen = fundAccounts[record.fund ?? NO_FUND];
    // Anonymous rows (no name and no email) don't get a contact created.
    const willCreateContact = !matched && Boolean(record.email ?? nameKey(record.firstName, record.lastName));

    const base = {
      rowNumber: record.rowNumber,
      contactLabel: contactLabel(record),
      matchedContactId: matched?.id ?? null,
      willCreateContact,
      accountId: chosen && chosen !== SKIP_FUND ? chosen : null,
    };

    if (chosen === SKIP_FUND) {
      return {
        ...base,
        status: "skipped" as const,
        message: record.fund ? `Fund "${record.fund}" excluded` : "Excluded",
      };
    }
    if (!chosen) {
      return {
        ...base,
        status: "error" as const,
        message: record.fund ? `No account chosen for fund "${record.fund}"` : "No account chosen",
      };
    }

    // A donor who doesn't exist yet can't have given before.
    if (!willCreateContact) {
      const duplicate = findDuplicateTransaction(record, matched?.id ?? null, unclaimed);
      if (duplicate) {
        unclaimed.splice(unclaimed.indexOf(duplicate), 1);
        return { ...base, status: "duplicate" as const, message: "Already in Causeway" };
      }
    }

    return { ...base, status: "ready" as const, message: null };
  });
}
