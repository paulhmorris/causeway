import dayjs from "dayjs";

import { parseCurrencyToCents, type ParsedCsv } from "~/lib/csv";
import { normalizeHeader, parseImportDate, UNMAPPED, type ImportField } from "~/lib/tithely-import";

/**
 * Bank exports come in two shapes: one signed Amount column, or separate Debit
 * and Credit columns. Both are supported — map whichever your bank provides.
 */
export type StatementFieldKey = "date" | "description" | "amount" | "debit" | "credit";

export type StatementMapping = Record<StatementFieldKey, number>;

export const statementFields: Array<ImportField<StatementFieldKey>> = [
  {
    key: "date",
    label: "Date",
    required: true,
    aliases: ["date", "postdate", "posteddate", "postingdate", "transactiondate", "effectivedate"],
  },
  {
    key: "description",
    label: "Description",
    required: false,
    aliases: ["description", "payee", "memo", "name", "details", "transactiondescription", "originaldescription"],
  },
  {
    key: "amount",
    label: "Amount",
    required: false,
    help: "Use this if your bank exports one signed column",
    aliases: ["amount", "transactionamount", "value"],
  },
  {
    key: "debit",
    label: "Debit (money out)",
    required: false,
    help: "Use these two instead if your bank splits the columns",
    aliases: ["debit", "debits", "withdrawal", "withdrawals", "paymentamount"],
  },
  {
    key: "credit",
    label: "Credit (money in)",
    required: false,
    aliases: ["credit", "credits", "deposit", "deposits", "depositamount"],
  },
];

export function autoDetectStatementMapping(headers: Array<string>): StatementMapping {
  const normalized = headers.map(normalizeHeader);
  const mapping = {} as StatementMapping;
  for (const field of statementFields) {
    mapping[field.key] = normalized.findIndex((h) => field.aliases.includes(h));
  }
  return mapping;
}

/**
 * A statement needs a date plus some way to read an amount: either the single
 * Amount column, or both Debit and Credit — with only one of the pair, rows in
 * the other direction would be unreadable.
 */
export function statementMappingProblem(mapping: StatementMapping): string | null {
  if (mapping.date === UNMAPPED) return "Choose which column holds the date.";
  const hasAmount = mapping.amount !== UNMAPPED;
  const hasDebitCredit = mapping.debit !== UNMAPPED && mapping.credit !== UNMAPPED;
  if (!hasAmount && !hasDebitCredit) {
    return "Choose an Amount column, or both a Debit and a Credit column.";
  }
  return null;
}

export type StatementLine = {
  rowNumber: number;
  date: string;
  description: string | null;
  amountInCents: number;
};

export type StatementRowError = { rowNumber: number; message: string };

function cell(row: Array<string>, index: number): string | null {
  if (index === UNMAPPED) return null;
  const value = (row[index] ?? "").trim();
  return value === "" ? null : value;
}

/**
 * Read the signed amount for a row. With a single Amount column the sign is
 * taken as-is. With Debit/Credit columns, credit is money in (positive) and
 * debit is money out (negative) — a debit already written as negative is not
 * negated twice.
 */
function readAmountInCents(row: Array<string>, mapping: StatementMapping): number | null {
  if (mapping.amount !== UNMAPPED) {
    return parseCurrencyToCents(cell(row, mapping.amount));
  }

  const rawCredit = cell(row, mapping.credit);
  const rawDebit = cell(row, mapping.debit);
  if (rawCredit === null && rawDebit === null) return 0;

  const credit = parseCurrencyToCents(rawCredit);
  const debit = parseCurrencyToCents(rawDebit);

  if (credit !== null && credit !== 0) return credit;
  if (debit !== null && debit !== 0) return debit < 0 ? debit : -debit;

  // Both columns blank or zero — treat as a zero-value row rather than an error.
  if (credit === 0 || debit === 0) return 0;
  return null;
}

/**
 * Turn parsed CSV rows into statement lines. Rows whose date or amount can't be
 * read are reported rather than dropped, so nothing goes missing silently.
 *
 * `reverseSigns` flips every amount, for credit card exports where a charge is
 * published as a positive number.
 */
export function toStatementLines(
  parsed: ParsedCsv,
  mapping: StatementMapping,
  { reverseSigns = false }: { reverseSigns?: boolean } = {},
) {
  const lines: Array<StatementLine> = [];
  const errors: Array<StatementRowError> = [];

  parsed.rows.forEach((row, i) => {
    const rowNumber = parsed.rowNumbers[i];
    if (row.every((c) => c.trim() === "")) return;

    const rawDate = cell(row, mapping.date);
    const date = parseImportDate(rawDate);
    if (!date) {
      errors.push({ rowNumber, message: rawDate ? `Unrecognized date "${rawDate}"` : "Missing date" });
      return;
    }

    const amountInCents = readAmountInCents(row, mapping);
    if (amountInCents === null) {
      errors.push({ rowNumber, message: "Couldn't read an amount" });
      return;
    }

    lines.push({
      rowNumber,
      date,
      description: cell(row, mapping.description),
      amountInCents: reverseSigns ? -amountInCents : amountInCents,
    });
  });

  return { lines, errors };
}

/** Net change represented by a set of statement lines. */
export function sumLines(lines: Array<StatementLine>): number {
  return lines.reduce((total, line) => total + line.amountInCents, 0);
}

/**
 * Lines falling outside the statement period. Banks often export a wider range
 * than the period being reconciled, and those extra rows would distort the
 * comparison if imported unnoticed.
 */
export function linesOutsidePeriod(lines: Array<StatementLine>, statementDate: string): Array<StatementLine> {
  const closing = dayjs(statementDate);
  return lines.filter((line) => dayjs(line.date).isAfter(closing, "day"));
}
