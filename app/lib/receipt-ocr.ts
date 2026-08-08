import { parseImportDate } from "~/lib/tithely-import";

/**
 * Best-effort fields pulled from a receipt's OCR text. Every field is nullable
 * because OCR is imperfect — the parser only fills what it's confident about and
 * leaves the rest for the person to enter. Nothing here is authoritative; it
 * only pre-fills an expense line the user then reviews.
 */
export type ParsedReceipt = {
  amountInCents: number | null;
  /** ISO yyyy-mm-dd, or null. */
  date: string | null;
  vendor: string | null;
};

/** Money on a receipt is written with exactly two decimals; that's what
 * separates a price from a phone number, quantity, or card fragment. */
const MONEY = /\$?\s?(\d{1,3}(?:,\d{3})+|\d+)\.(\d{2})(?!\d)/g;

/** Lines that name the grand total. "subtotal" is deliberately excluded. */
const TOTAL_LABEL = /\b(grand\s*total|total\s*due|amount\s*due|balance\s*due|total)\b/i;
const SUBTOTAL_LABEL = /\bsub[\s-]*total\b/i;

function toCents(whole: string, cents: string): number {
  return Number(whole.replace(/,/g, "")) * 100 + Number(cents);
}

/** Every money-looking token on a line, in cents. */
function moneyOnLine(line: string): Array<number> {
  const amounts: Array<number> = [];
  for (const match of line.matchAll(MONEY)) {
    amounts.push(toCents(match[1], match[2]));
  }
  return amounts;
}

/**
 * Pick the receipt total. A labelled "total" line wins (the largest amount on
 * such lines, to survive "total items 3   total $12.34"); otherwise the largest
 * money amount anywhere, which on a receipt is almost always the total.
 */
export function extractAmountInCents(text: string): number | null {
  const lines = text.split(/\r?\n/);

  const totalLineAmounts: Array<number> = [];
  const allAmounts: Array<number> = [];

  for (const line of lines) {
    const amounts = moneyOnLine(line);
    if (amounts.length === 0) continue;
    allAmounts.push(...amounts);
    if (TOTAL_LABEL.test(line) && !SUBTOTAL_LABEL.test(line)) {
      totalLineAmounts.push(...amounts);
    }
  }

  const pool = totalLineAmounts.length > 0 ? totalLineAmounts : allAmounts;
  if (pool.length === 0) return null;
  return Math.max(...pool);
}

const DATE_PATTERNS = [
  /\b\d{4}-\d{2}-\d{2}\b/,
  /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/,
  /\b[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}\b/,
];

/** First parseable date in the text, as ISO yyyy-mm-dd. */
export function extractDate(text: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const iso = parseImportDate(match[0]);
      if (iso) return iso;
    }
  }
  return null;
}

const MERCHANT_STOPWORDS = /\b(receipt|invoice|order|tel|phone|www\.|http|thank\s*you)\b/i;

/**
 * Guess the merchant from the top of the receipt — the first line that reads
 * like a name rather than a date, an amount, an address, or contact details.
 */
export function extractVendor(text: string): string | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim());

  for (const line of lines.slice(0, 6)) {
    if (line.length < 2 || line.length > 60) continue;
    if (MONEY.test(line)) {
      MONEY.lastIndex = 0; // matchAll/test on a /g regex is stateful — reset it.
      continue;
    }
    if (DATE_PATTERNS.some((p) => p.test(line))) continue;
    if (MERCHANT_STOPWORDS.test(line)) continue;
    // Skip lines that are mostly digits (addresses, phone numbers, totals).
    const letters = line.replace(/[^A-Za-z]/g, "").length;
    if (letters < line.length / 2) continue;
    return line;
  }
  return null;
}

/** Parse OCR text into the fields an expense line needs. */
export function parseReceiptText(text: string): ParsedReceipt {
  return {
    amountInCents: extractAmountInCents(text),
    date: extractDate(text),
    vendor: extractVendor(text),
  };
}
