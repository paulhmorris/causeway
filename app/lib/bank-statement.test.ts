import { describe, expect, it } from "vitest";

import {
  autoDetectStatementMapping,
  linesOutsidePeriod,
  statementMappingProblem,
  sumLines,
  toStatementLines,
  type StatementMapping,
} from "~/lib/bank-statement";
import { UNMAPPED } from "~/lib/tithely-import";

describe("autoDetectStatementMapping", () => {
  it("matches a single-amount export", () => {
    const mapping = autoDetectStatementMapping(["Date", "Description", "Amount"]);
    expect(mapping.date).toBe(0);
    expect(mapping.description).toBe(1);
    expect(mapping.amount).toBe(2);
    expect(mapping.debit).toBe(UNMAPPED);
  });

  it("matches a debit/credit export", () => {
    const mapping = autoDetectStatementMapping(["Posted Date", "Payee", "Debit", "Credit"]);
    expect(mapping.date).toBe(0);
    expect(mapping.description).toBe(1);
    expect(mapping.debit).toBe(2);
    expect(mapping.credit).toBe(3);
    expect(mapping.amount).toBe(UNMAPPED);
  });
});

describe("statementMappingProblem", () => {
  const none: StatementMapping = {
    date: UNMAPPED,
    description: UNMAPPED,
    amount: UNMAPPED,
    debit: UNMAPPED,
    credit: UNMAPPED,
  };

  it("requires a date", () => {
    expect(statementMappingProblem({ ...none, amount: 1 })).toContain("date");
  });

  it("requires an amount or a debit/credit pair", () => {
    expect(statementMappingProblem({ ...none, date: 0 })).toContain("Amount");
    expect(statementMappingProblem({ ...none, date: 0, amount: 1 })).toBeNull();
    expect(statementMappingProblem({ ...none, date: 0, credit: 1 })).toContain("Debit");
    expect(statementMappingProblem({ ...none, date: 0, debit: 1 })).toContain("Credit");
    expect(statementMappingProblem({ ...none, date: 0, debit: 1, credit: 2 })).toBeNull();
  });
});

describe("toStatementLines", () => {
  it("reads a single signed amount column", () => {
    const parsed = {
      headers: ["Date", "Description", "Amount"],
      rows: [
        ["7/1/2026", "Deposit", "$1,200.00"],
        ["7/2/2026", "Office supplies", "-45.30"],
      ],
      rowNumbers: [2, 3],
    };
    const { lines, errors } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers));

    expect(errors).toEqual([]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      date: "2026-07-01",
      description: "Deposit",
      amountInCents: 120000,
    });
    expect(lines[1].amountInCents).toBe(-4530);
  });

  it("treats credit as money in and debit as money out", () => {
    const parsed = {
      headers: ["Date", "Payee", "Debit", "Credit"],
      rows: [
        ["7/1/2026", "Donation deposit", "", "500.00"],
        ["7/2/2026", "Utility bill", "120.00", ""],
      ],
      rowNumbers: [2, 3],
    };
    const { lines } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers));

    expect(lines[0].amountInCents).toBe(50000);
    expect(lines[1].amountInCents).toBe(-12000);
  });

  it("does not negate a debit that is already negative", () => {
    const parsed = {
      headers: ["Date", "Payee", "Debit", "Credit"],
      rows: [["7/2/2026", "Utility bill", "-120.00", ""]],
      rowNumbers: [2],
    };
    const { lines } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers));
    expect(lines[0].amountInCents).toBe(-12000);
  });

  it("flips every amount when reverseSigns is set", () => {
    const parsed = {
      headers: ["Date", "Description", "Amount"],
      rows: [
        ["7/1/2026", "Card charge", "75.00"],
        ["7/2/2026", "Payment received", "-200.00"],
      ],
      rowNumbers: [2, 3],
    };
    const { lines } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers), { reverseSigns: true });

    expect(lines[0].amountInCents).toBe(-7500);
    expect(lines[1].amountInCents).toBe(20000);
  });

  it("reports rows whose date or amount can't be read", () => {
    const parsed = {
      headers: ["Date", "Description", "Amount"],
      rows: [
        ["not a date", "Deposit", "10.00"],
        ["7/2/2026", "Mystery", "n/a"],
        ["7/3/2026", "Good row", "10.00"],
      ],
      rowNumbers: [2, 3, 4],
    };
    const { lines, errors } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers));

    expect(lines).toHaveLength(1);
    expect(errors.map((e) => e.rowNumber)).toEqual([2, 3]);
  });

  it("reads a row with blank debit and credit as zero", () => {
    const parsed = {
      headers: ["Date", "Description", "Debit", "Credit"],
      rows: [["7/1/2026", "Balance forward", "", ""]],
      rowNumbers: [2],
    };
    const { lines, errors } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers));
    expect(lines.map((l) => l.amountInCents)).toEqual([0]);
    expect(errors).toEqual([]);
  });

  it("ignores fully blank rows", () => {
    const parsed = {
      headers: ["Date", "Description", "Amount"],
      rows: [["", "", ""]],
      rowNumbers: [2],
    };
    const { lines, errors } = toStatementLines(parsed, autoDetectStatementMapping(parsed.headers));
    expect(lines).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe("sumLines", () => {
  it("nets deposits against withdrawals", () => {
    expect(
      sumLines([
        {
          rowNumber: 2,
          date: "2026-07-01",
          description: null,
          amountInCents: 10000,
        },
      ]),
    ).toBe(10000);
    expect(
      sumLines([
        {
          rowNumber: 2,
          date: "2026-07-01",
          description: null,
          amountInCents: 10000,
        },
        {
          rowNumber: 3,
          date: "2026-07-02",
          description: null,
          amountInCents: -2500,
        },
      ]),
    ).toBe(7500);
    expect(sumLines([])).toBe(0);
  });
});

describe("linesOutsidePeriod", () => {
  it("flags lines dated after the statement close", () => {
    const lines = [
      {
        rowNumber: 2,
        date: "2026-07-30",
        description: null,
        amountInCents: 100,
      },
      {
        rowNumber: 3,
        date: "2026-07-31",
        description: null,
        amountInCents: 100,
      },
      {
        rowNumber: 4,
        date: "2026-08-01",
        description: null,
        amountInCents: 100,
      },
    ];
    expect(linesOutsidePeriod(lines, "2026-07-31").map((l) => l.rowNumber)).toEqual([4]);
  });
});
