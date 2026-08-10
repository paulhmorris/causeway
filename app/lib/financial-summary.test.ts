import { describe, expect, it } from "vitest";

import { summarizeFinancials, summaryToCsv, sumTotals, type SummarizableTransaction } from "~/lib/financial-summary";

function tx(over: Partial<SummarizableTransaction> = {}): SummarizableTransaction {
  return {
    amountInCents: 10000,
    accountId: "acct-1",
    accountCode: "1001",
    accountDescription: "General Fund",
    categoryId: 1,
    categoryName: "Donation: Standard",
    ...over,
  };
}

describe("summarizeFinancials", () => {
  it("splits income and expense from signed amounts", () => {
    const { totals } = summarizeFinancials([tx({ amountInCents: 10000 }), tx({ amountInCents: -4000 })]);
    expect(totals).toEqual({ incomeInCents: 10000, expenseInCents: 4000, netInCents: 6000 });
  });

  it("totals each fund separately, ordered by code", () => {
    const summary = summarizeFinancials([
      tx({ accountId: "b", accountCode: "2001", accountDescription: "Local", amountInCents: 5000 }),
      tx({ accountId: "a", accountCode: "1001", accountDescription: "General", amountInCents: 10000 }),
      tx({ accountId: "a", accountCode: "1001", accountDescription: "General", amountInCents: -3000 }),
    ]);

    expect(summary.byFund.map((f) => f.code)).toEqual(["1001", "2001"]);
    expect(summary.byFund[0]).toMatchObject({ incomeInCents: 10000, expenseInCents: 3000, netInCents: 7000 });
    expect(summary.byFund[1]).toMatchObject({ incomeInCents: 5000, expenseInCents: 0, netInCents: 5000 });
  });

  it("groups by category, largest net first", () => {
    const summary = summarizeFinancials([
      tx({ categoryId: 1, categoryName: "Donation", amountInCents: 8000 }),
      tx({ categoryId: 11, categoryName: "Expense: Other", amountInCents: -2000 }),
      tx({ categoryId: 1, categoryName: "Donation", amountInCents: 2000 }),
    ]);

    expect(summary.byCategory.map((c) => c.name)).toEqual(["Donation", "Expense: Other"]);
    expect(summary.byCategory[0]).toMatchObject({ incomeInCents: 10000, netInCents: 10000 });
    expect(summary.byCategory[1]).toMatchObject({ expenseInCents: 2000, netInCents: -2000 });
  });

  it("buckets null categories as Uncategorized", () => {
    const summary = summarizeFinancials([tx({ categoryId: null, categoryName: null, amountInCents: 1500 })]);
    expect(summary.byCategory[0]).toMatchObject({ categoryId: null, name: "Uncategorized", incomeInCents: 1500 });
  });

  it("treats a zero amount as income of zero, not expense", () => {
    const { totals } = summarizeFinancials([tx({ amountInCents: 0 })]);
    expect(totals).toEqual({ incomeInCents: 0, expenseInCents: 0, netInCents: 0 });
  });

  it("returns empty structures for no transactions", () => {
    expect(summarizeFinancials([])).toEqual({
      byFund: [],
      byCategory: [],
      totals: { incomeInCents: 0, expenseInCents: 0, netInCents: 0 },
    });
  });
});

describe("sumTotals", () => {
  it("splits a list of signed amounts into income, expense, and net", () => {
    expect(sumTotals([10000, -4000, 2500])).toEqual({
      incomeInCents: 12500,
      expenseInCents: 4000,
      netInCents: 8500,
    });
  });

  it("is all zeros for an empty list", () => {
    expect(sumTotals([])).toEqual({ incomeInCents: 0, expenseInCents: 0, netInCents: 0 });
  });
});

describe("summaryToCsv", () => {
  it("renders fund, category, and totals sections with two-decimal dollars", () => {
    const summary = summarizeFinancials([
      tx({ amountInCents: 12345 }),
      tx({ amountInCents: -2000, categoryId: 11, categoryName: "Expense: Other" }),
    ]);
    const csv = summaryToCsv(summary, { start: "2026-01-01", end: "2026-12-31" });

    expect(csv).toContain("Financial Summary");
    expect(csv).toContain("2026-01-01 to 2026-12-31");
    expect(csv).toContain("1001,General Fund,123.45,20.00,103.45");
    expect(csv).toContain("Totals,123.45,20.00,103.45");
  });

  it("quotes cells that contain commas", () => {
    const summary = summarizeFinancials([tx({ accountDescription: "General, Unrestricted", amountInCents: 1000 })]);
    const csv = summaryToCsv(summary, { start: "2026-01-01", end: "2026-12-31" });
    expect(csv).toContain('"General, Unrestricted"');
  });
});
