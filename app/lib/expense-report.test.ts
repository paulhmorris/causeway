import { describe, expect, it } from "vitest";

import {
  isSubmittable,
  lineProblems,
  reportProblems,
  reportTotalInCents,
  subtotalsByAccount,
  type ExpenseLine,
} from "~/lib/expense-report";

function line(over: Partial<ExpenseLine> = {}): ExpenseLine {
  return {
    key: "k1",
    date: "2026-07-10",
    vendor: "Office Depot",
    description: "Printer paper",
    amountInCents: 2500,
    accountId: "acct-1",
    methodId: 4,
    receiptIds: [],
    ...over,
  };
}

describe("reportTotalInCents", () => {
  it("sums every line", () => {
    expect(reportTotalInCents([line({ amountInCents: 2500 }), line({ amountInCents: 7500 })])).toBe(10000);
  });

  it("is zero for an empty report", () => {
    expect(reportTotalInCents([])).toBe(0);
  });
});

describe("subtotalsByAccount", () => {
  it("groups amounts per account in first-seen order", () => {
    const lines = [
      line({ key: "a", accountId: "acct-1", amountInCents: 1000 }),
      line({ key: "b", accountId: "acct-2", amountInCents: 2000 }),
      line({ key: "c", accountId: "acct-1", amountInCents: 500 }),
    ];

    expect(subtotalsByAccount(lines)).toEqual([
      { accountId: "acct-1", count: 2, totalInCents: 1500 },
      { accountId: "acct-2", count: 1, totalInCents: 2000 },
    ]);
  });

  it("skips lines with no account chosen yet", () => {
    expect(subtotalsByAccount([line({ accountId: "" })])).toEqual([]);
  });
});

describe("lineProblems", () => {
  it("passes a complete line", () => {
    expect(lineProblems(line())).toEqual([]);
  });

  it("flags a missing or malformed date", () => {
    expect(lineProblems(line({ date: "" }))).toContain("Choose a date");
    expect(lineProblems(line({ date: "07/10/2026" }))).toContain("Choose a date");
  });

  it("flags a non-positive amount", () => {
    expect(lineProblems(line({ amountInCents: 0 }))).toContain("Enter an amount over $0.00");
    expect(lineProblems(line({ amountInCents: -100 }))).toContain("Enter an amount over $0.00");
  });

  it("flags a missing account or method", () => {
    expect(lineProblems(line({ accountId: "" }))).toContain("Choose an account");
    expect(lineProblems(line({ methodId: null }))).toContain("Choose a payment method");
  });
});

describe("reportProblems", () => {
  it("collects problems keyed to each line", () => {
    const problems = reportProblems([line({ key: "good" }), line({ key: "bad", amountInCents: 0, accountId: "" })]);
    expect(problems.every((p) => p.key === "bad")).toBe(true);
    expect(problems).toHaveLength(2);
  });
});

describe("isSubmittable", () => {
  it("requires at least one line", () => {
    expect(isSubmittable([])).toBe(false);
  });

  it("is false while any line has a problem", () => {
    expect(isSubmittable([line(), line({ amountInCents: 0 })])).toBe(false);
  });

  it("is true when every line is complete", () => {
    expect(isSubmittable([line({ key: "a" }), line({ key: "b" })])).toBe(true);
  });
});
