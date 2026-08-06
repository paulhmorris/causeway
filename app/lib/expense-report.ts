/**
 * A single line in an expense report. Mirrors the fields of a reimbursement
 * request, since submitting a report creates one request per line — category is
 * deliberately absent because an admin assigns it at approval time.
 */
export type ExpenseLine = {
  /** Stable client-side id so React keys and edits survive reordering. */
  key: string;
  date: string;
  vendor: string;
  description: string;
  amountInCents: number;
  accountId: string;
  methodId: number | null;
  receiptIds: Array<string>;
};

export type LineProblem = { key: string; message: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Grand total of every line, in cents. */
export function reportTotalInCents(lines: Array<ExpenseLine>): number {
  return lines.reduce((total, line) => total + line.amountInCents, 0);
}

export type AccountSubtotal = { accountId: string; count: number; totalInCents: number };

/**
 * Subtotals per account, in first-seen order. An expense report often draws
 * from more than one fund, and each fund's admin needs its own total.
 */
export function subtotalsByAccount(lines: Array<ExpenseLine>): Array<AccountSubtotal> {
  const order: Array<string> = [];
  const byAccount = new Map<string, AccountSubtotal>();

  for (const line of lines) {
    if (!line.accountId) continue;
    let entry = byAccount.get(line.accountId);
    if (!entry) {
      entry = { accountId: line.accountId, count: 0, totalInCents: 0 };
      byAccount.set(line.accountId, entry);
      order.push(line.accountId);
    }
    entry.count += 1;
    entry.totalInCents += line.amountInCents;
  }

  return order.map((id) => byAccount.get(id)!);
}

/** Everything wrong with one line, as reader-facing messages. */
export function lineProblems(line: ExpenseLine): Array<string> {
  const problems: Array<string> = [];
  if (!ISO_DATE.test(line.date)) problems.push("Choose a date");
  if (!Number.isInteger(line.amountInCents) || line.amountInCents <= 0) problems.push("Enter an amount over $0.00");
  if (!line.accountId) problems.push("Choose an account");
  if (line.methodId === null) problems.push("Choose a payment method");
  return problems;
}

/** Per-line problems across the whole report, keyed to each line. */
export function reportProblems(lines: Array<ExpenseLine>): Array<LineProblem> {
  return lines.flatMap((line) => lineProblems(line).map((message) => ({ key: line.key, message })));
}

/** A report is submittable when it has at least one line and no line problems. */
export function isSubmittable(lines: Array<ExpenseLine>): boolean {
  return lines.length > 0 && reportProblems(lines).length === 0;
}
