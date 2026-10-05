import { describe, expect, it } from "vitest";

import { CsvParseError, parseCsv, parseCurrencyToCents } from "~/lib/csv";

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const { headers, rows } = parseCsv("Date,Amount\n2026-01-01,10.00\n2026-01-02,20.00");
    expect(headers).toEqual(["Date", "Amount"]);
    expect(rows).toEqual([
      ["2026-01-01", "10.00"],
      ["2026-01-02", "20.00"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    const { rows } = parseCsv('Name,Note\n"Smith, John","Gift, monthly"');
    expect(rows[0]).toEqual(["Smith, John", "Gift, monthly"]);
  });

  it("handles escaped quotes inside quoted fields", () => {
    const { rows } = parseCsv('Note\n"He said ""thanks"""');
    expect(rows[0]).toEqual(['He said "thanks"']);
  });

  it("handles newlines inside quoted fields", () => {
    const { rows } = parseCsv('Note\n"line one\nline two"');
    expect(rows[0]).toEqual(["line one\nline two"]);
  });

  it("handles CRLF line endings", () => {
    const { headers, rows } = parseCsv("A,B\r\n1,2\r\n");
    expect(headers).toEqual(["A", "B"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  it("strips a leading BOM and trims header whitespace", () => {
    const { headers } = parseCsv("\uFEFF Date , Amount \n1,2");
    expect(headers).toEqual(["Date", "Amount"]);
  });

  it("ignores trailing blank lines", () => {
    const { rows } = parseCsv("A,B\n1,2\n\n");
    expect(rows).toEqual([["1", "2"]]);
  });

  it("reports spreadsheet row numbers that account for skipped blank lines", () => {
    const { rowNumbers } = parseCsv('\nA,B\n1,2\n\n,\n"multi\nline",3\n4,5');
    expect(rowNumbers).toEqual([3, 6, 7]);
  });

  it("ignores comma-only rows left by spreadsheet exports", () => {
    const { rows } = parseCsv("A,B\n1,2\n,\n , \n");
    expect(rows).toEqual([["1", "2"]]);
  });

  it("throws on an unclosed quote, reporting the line it opened on", () => {
    expect(() => parseCsv('A,B\n1,"two\nlines\n3,4')).toThrow(CsvParseError);
    expect(() => parseCsv('A,B\r\n1,2\r\n"open,2')).toThrow("Line 3");
  });

  it("treats a quote in the middle of an unquoted field as literal", () => {
    const { rows } = parseCsv('Note,Amount\n5" frame,10\n2,20');
    expect(rows).toEqual([
      ['5" frame', "10"],
      ["2", "20"],
    ]);
  });
});

describe("parseCurrencyToCents", () => {
  it("parses plain decimals", () => {
    expect(parseCurrencyToCents("10.00")).toBe(1000);
    expect(parseCurrencyToCents("0.05")).toBe(5);
  });

  it("strips currency symbols and thousands separators", () => {
    expect(parseCurrencyToCents("$1,234.56")).toBe(123456);
  });

  it("handles negatives written with a minus or parentheses", () => {
    expect(parseCurrencyToCents("-12.00")).toBe(-1200);
    expect(parseCurrencyToCents("(12.00)")).toBe(-1200);
    expect(parseCurrencyToCents("-$12.00")).toBe(-1200);
    expect(parseCurrencyToCents("$-12.00")).toBe(-1200);
    expect(parseCurrencyToCents("($12.00)")).toBe(-1200);
  });

  it("rounds fractional cents to the nearest cent", () => {
    expect(parseCurrencyToCents("1.999")).toBe(200);
    expect(parseCurrencyToCents("1.001")).toBe(100);
  });

  it("returns null for empty or non-numeric values", () => {
    expect(parseCurrencyToCents("")).toBeNull();
    expect(parseCurrencyToCents("  ")).toBeNull();
    expect(parseCurrencyToCents("N/A")).toBeNull();
    expect(parseCurrencyToCents(null)).toBeNull();
  });
});
