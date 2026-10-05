import { describe, expect, it } from "vitest";

import { matchStatementLines, summarizeProgress } from "~/lib/reconciliation-match";

describe("matchStatementLines", () => {
  it("matches lines to transactions of the same amount and near date", () => {
    const lines = [
      { id: "l1", date: "2026-07-03", amountInCents: 5000 },
      { id: "l2", date: "2026-07-10", amountInCents: -1200 },
    ];
    const transactions = [
      { id: "t1", date: "2026-07-04", amountInCents: 5000 },
      { id: "t2", date: "2026-07-10", amountInCents: -1200 },
    ];

    const result = matchStatementLines(lines, transactions);

    expect(result.matches).toEqual([
      { lineId: "l2", transactionId: "t2" },
      { lineId: "l1", transactionId: "t1" },
    ]);
    expect(result.unmatchedLineIds).toEqual([]);
    expect(result.unmatchedTransactionIds).toEqual([]);
  });

  it("never matches different amounts", () => {
    const result = matchStatementLines(
      [{ id: "l1", date: "2026-07-03", amountInCents: 5000 }],
      [{ id: "t1", date: "2026-07-03", amountInCents: 5001 }],
    );
    expect(result.matches).toEqual([]);
    expect(result.unmatchedLineIds).toEqual(["l1"]);
    expect(result.unmatchedTransactionIds).toEqual(["t1"]);
  });

  it("pairs equal amounts by closest date rather than crossing over", () => {
    const lines = [
      { id: "l1", date: "2026-07-01", amountInCents: 2500 },
      { id: "l2", date: "2026-07-20", amountInCents: 2500 },
    ];
    const transactions = [
      { id: "t_early", date: "2026-07-02", amountInCents: 2500 },
      { id: "t_late", date: "2026-07-19", amountInCents: 2500 },
    ];

    const result = matchStatementLines(lines, transactions, { dateWindowDays: 30 });

    expect(result.matches).toContainEqual({ lineId: "l1", transactionId: "t_early" });
    expect(result.matches).toContainEqual({ lineId: "l2", transactionId: "t_late" });
  });

  it("does not match outside the date window", () => {
    const result = matchStatementLines(
      [{ id: "l1", date: "2026-07-01", amountInCents: 2500 }],
      [{ id: "t1", date: "2026-07-20", amountInCents: 2500 }],
      { dateWindowDays: 5 },
    );
    expect(result.matches).toEqual([]);
    expect(result.unmatchedLineIds).toEqual(["l1"]);
  });

  it("leaves the extra transaction unmatched when counts differ", () => {
    const lines = [{ id: "l1", date: "2026-07-05", amountInCents: 900 }];
    const transactions = [
      { id: "t1", date: "2026-07-05", amountInCents: 900 },
      { id: "t2", date: "2026-07-06", amountInCents: 900 },
    ];

    const result = matchStatementLines(lines, transactions);

    expect(result.matches).toEqual([{ lineId: "l1", transactionId: "t1" }]);
    expect(result.unmatchedTransactionIds).toEqual(["t2"]);
  });

  it("is deterministic when gaps tie", () => {
    const lines = [{ id: "l1", date: "2026-07-05", amountInCents: 100 }];
    const transactions = [
      { id: "t_b", date: "2026-07-06", amountInCents: 100 },
      { id: "t_a", date: "2026-07-04", amountInCents: 100 },
    ];

    // Both are one day away; the lexicographically smaller transaction id wins.
    const result = matchStatementLines(lines, transactions);
    expect(result.matches).toEqual([{ lineId: "l1", transactionId: "t_a" }]);
  });

  it("handles empty inputs", () => {
    expect(matchStatementLines([], [])).toEqual({
      matches: [],
      unmatchedLineIds: [],
      unmatchedTransactionIds: [],
    });
  });
});

describe("summarizeProgress", () => {
  it("counts matched, ignored, and unresolved lines", () => {
    const progress = summarizeProgress({
      lines: [
        { transactionId: "t1", ignoredAt: null },
        { transactionId: null, ignoredAt: new Date() },
        { transactionId: null, ignoredAt: null },
      ],
      unmatchedTransactionCount: 2,
    });

    expect(progress).toMatchObject({
      totalLines: 3,
      matchedLines: 1,
      ignoredLines: 1,
      unresolvedLines: 1,
      unmatchedTransactions: 2,
      isFullyResolved: false,
    });
  });

  it("counts a matched line as matched even if also flagged ignored", () => {
    const progress = summarizeProgress({
      lines: [{ transactionId: "t1", ignoredAt: new Date() }],
      unmatchedTransactionCount: 0,
    });
    expect(progress.matchedLines).toBe(1);
    expect(progress.ignoredLines).toBe(0);
  });

  it("is fully resolved when nothing is unresolved", () => {
    const progress = summarizeProgress({
      lines: [
        { transactionId: "t1", ignoredAt: null },
        { transactionId: null, ignoredAt: new Date() },
      ],
      unmatchedTransactionCount: 3,
    });
    // Unmatched transactions don't block resolution — only unresolved lines do.
    expect(progress.isFullyResolved).toBe(true);
  });
});
