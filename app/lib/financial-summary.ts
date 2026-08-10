/**
 * One transaction reduced to what a financial summary needs. Amounts follow the
 * app-wide convention: positive is money in, negative is money out.
 */
export type SummarizableTransaction = {
  amountInCents: number;
  accountId: string;
  accountCode: string;
  accountDescription: string;
  categoryId: number | null;
  categoryName: string | null;
};

export type Totals = { incomeInCents: number; expenseInCents: number; netInCents: number };

export type FundRow = Totals & { accountId: string; code: string; description: string };
export type CategoryRow = Totals & { categoryId: number | null; name: string };

export type FinancialSummary = {
  byFund: Array<FundRow>;
  byCategory: Array<CategoryRow>;
  totals: Totals;
};

const UNCATEGORIZED = "Uncategorized";

/** Split one signed amount into its income and expense magnitudes. */
function apply(totals: Totals, amountInCents: number): void {
  if (amountInCents >= 0) {
    totals.incomeInCents += amountInCents;
  } else {
    totals.expenseInCents += -amountInCents;
  }
  totals.netInCents += amountInCents;
}

function emptyTotals(): Totals {
  return { incomeInCents: 0, expenseInCents: 0, netInCents: 0 };
}

/**
 * Income/expense/net for a bare list of signed amounts. The same split the full
 * summary uses, for callers (like the dashboard) that only need the headline
 * numbers and don't want to load account and category detail.
 */
export function sumTotals(amountsInCents: Array<number>): Totals {
  const totals = emptyTotals();
  for (const amount of amountsInCents) apply(totals, amount);
  return totals;
}

/**
 * Summarize transactions into income/expense/net totals overall, by fund, and
 * by category. Income is the sum of money in, expense the sum of money out (as a
 * positive figure), and net their difference — the shape a statement of
 * activities and a 990 both want.
 *
 * Funds are ordered by account code; categories by net, largest inflow first,
 * so the biggest revenue lines sit at the top and expenses fall to the bottom.
 */
export function summarizeFinancials(transactions: Array<SummarizableTransaction>): FinancialSummary {
  const totals = emptyTotals();
  const funds = new Map<string, FundRow>();
  const categories = new Map<string, CategoryRow>();

  for (const t of transactions) {
    apply(totals, t.amountInCents);

    let fund = funds.get(t.accountId);
    if (!fund) {
      fund = { accountId: t.accountId, code: t.accountCode, description: t.accountDescription, ...emptyTotals() };
      funds.set(t.accountId, fund);
    }
    apply(fund, t.amountInCents);

    const categoryKey = t.categoryId === null ? UNCATEGORIZED : String(t.categoryId);
    let category = categories.get(categoryKey);
    if (!category) {
      category = { categoryId: t.categoryId, name: t.categoryName ?? UNCATEGORIZED, ...emptyTotals() };
      categories.set(categoryKey, category);
    }
    apply(category, t.amountInCents);
  }

  return {
    byFund: [...funds.values()].sort((a, b) => a.code.localeCompare(b.code)),
    byCategory: [...categories.values()].sort((a, b) => b.netInCents - a.netInCents),
    totals,
  };
}

/** A cell value quoted for CSV only when it contains a comma, quote, or newline. */
function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Render the summary as CSV: a fund section, a category section, and a totals
 * line, with dollars to two decimals. Built from the same summary the page
 * shows, so the download and the screen never disagree.
 */
export function summaryToCsv(summary: FinancialSummary, range: { start: string; end: string }): string {
  const rows: Array<Array<string | number>> = [];

  rows.push(["Financial Summary"]);
  rows.push(["Period", `${range.start} to ${range.end}`]);
  rows.push([]);

  rows.push(["By Fund"]);
  rows.push(["Code", "Fund", "Income", "Expense", "Net"]);
  for (const f of summary.byFund) {
    rows.push([f.code, f.description, dollars(f.incomeInCents), dollars(f.expenseInCents), dollars(f.netInCents)]);
  }
  rows.push([]);

  rows.push(["By Category"]);
  rows.push(["Category", "Income", "Expense", "Net"]);
  for (const c of summary.byCategory) {
    rows.push([c.name, dollars(c.incomeInCents), dollars(c.expenseInCents), dollars(c.netInCents)]);
  }
  rows.push([]);

  rows.push([
    "Totals",
    dollars(summary.totals.incomeInCents),
    dollars(summary.totals.expenseInCents),
    dollars(summary.totals.netInCents),
  ]);

  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
