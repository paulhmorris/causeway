import dayjs from "dayjs";

/** A statement line eligible for matching. */
export type MatchableLine = {
  id: string;
  date: string | Date;
  amountInCents: number;
};

/** A Causeway transaction eligible for matching. */
export type MatchableTransaction = {
  id: string;
  date: string | Date;
  amountInCents: number;
};

export type LineMatch = { lineId: string; transactionId: string };

export type MatchResult = {
  matches: Array<LineMatch>;
  unmatchedLineIds: Array<string>;
  unmatchedTransactionIds: Array<string>;
};

/**
 * Pair statement lines to transactions. A pair must have the **exact same
 * amount** — bank reconciliation never matches approximate amounts. Among
 * equal-amount candidates the closest dates are paired first, so two gifts of
 * the same amount in one period line up with the nearest transaction rather
 * than crossing over.
 *
 * `dateWindowDays` rejects pairs whose dates are further apart than the window,
 * guarding against coincidentally-equal amounts landing weeks apart. Callers
 * that have already bounded transactions to the statement period can widen it.
 *
 * The algorithm is greedy on date distance, which is optimal here: with a fixed
 * amount, assigning the globally closest pair first never blocks a better total
 * because every candidate is interchangeable except on date.
 */
export function matchStatementLines(
  lines: Array<MatchableLine>,
  transactions: Array<MatchableTransaction>,
  { dateWindowDays = 5 }: { dateWindowDays?: number } = {},
): MatchResult {
  // Candidate pairs of equal amount, with the day gap between them.
  const candidates: Array<{ lineId: string; transactionId: string; dayGap: number }> = [];

  const txByAmount = new Map<number, Array<MatchableTransaction>>();
  for (const tx of transactions) {
    const group = txByAmount.get(tx.amountInCents) ?? [];
    group.push(tx);
    txByAmount.set(tx.amountInCents, group);
  }

  for (const line of lines) {
    const sameAmount = txByAmount.get(line.amountInCents);
    if (!sameAmount) continue;
    for (const tx of sameAmount) {
      const dayGap = Math.abs(dayjs(line.date).diff(dayjs(tx.date), "day"));
      if (dayGap <= dateWindowDays) {
        candidates.push({ lineId: line.id, transactionId: tx.id, dayGap });
      }
    }
  }

  // Closest pairs first; ties broken deterministically so results are stable.
  candidates.sort(
    (a, b) => a.dayGap - b.dayGap || a.lineId.localeCompare(b.lineId) || a.transactionId.localeCompare(b.transactionId),
  );

  const matches: Array<LineMatch> = [];
  const takenLines = new Set<string>();
  const takenTransactions = new Set<string>();

  for (const candidate of candidates) {
    if (takenLines.has(candidate.lineId) || takenTransactions.has(candidate.transactionId)) continue;
    matches.push({ lineId: candidate.lineId, transactionId: candidate.transactionId });
    takenLines.add(candidate.lineId);
    takenTransactions.add(candidate.transactionId);
  }

  return {
    matches,
    unmatchedLineIds: lines.filter((l) => !takenLines.has(l.id)).map((l) => l.id),
    unmatchedTransactionIds: transactions.filter((t) => !takenTransactions.has(t.id)).map((t) => t.id),
  };
}

export type ReconciliationProgress = {
  totalLines: number;
  matchedLines: number;
  ignoredLines: number;
  /** Lines that are neither matched nor ignored — the work left to do. */
  unresolvedLines: number;
  /** Transactions in the period with no statement line matched to them. */
  unmatchedTransactions: number;
  /** True when every line is matched or ignored. */
  isFullyResolved: boolean;
};

/**
 * Summarize where a reconciliation stands. A line counts as resolved when it is
 * either matched to a transaction or explicitly ignored; an ignored line that
 * also carries a match still counts as matched.
 */
export function summarizeProgress({
  lines,
  unmatchedTransactionCount,
}: {
  lines: Array<{ transactionId: string | null; ignoredAt: Date | string | null }>;
  unmatchedTransactionCount: number;
}): ReconciliationProgress {
  const matchedLines = lines.filter((l) => l.transactionId !== null).length;
  const ignoredLines = lines.filter((l) => l.transactionId === null && l.ignoredAt !== null).length;
  const unresolvedLines = lines.length - matchedLines - ignoredLines;

  return {
    totalLines: lines.length,
    matchedLines,
    ignoredLines,
    unresolvedLines,
    unmatchedTransactions: unmatchedTransactionCount,
    isFullyResolved: unresolvedLines === 0,
  };
}
