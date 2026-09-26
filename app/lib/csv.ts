export type ParsedCsv = {
  headers: Array<string>;
  rows: Array<Array<string>>;
};

/**
 * Minimal RFC 4180-style CSV parser with no external dependencies. Handles
 * quoted fields, escaped quotes ("") inside quotes, and commas / newlines that
 * appear within quoted fields. A quote mid-field (e.g. `5" screen`) is literal.
 * Strips a leading UTF-8 BOM and ignores blank lines, including comma-only ones. The first non-empty record is treated as the header row.
 */
export function parseCsv(input: string): ParsedCsv {
  if (input.charCodeAt(0) === 0xfeff) {
    input = input.slice(1);
  }

  const records: Array<Array<string>> = [];
  let field = "";
  let record: Array<string> = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  while (i < input.length) {
    const char = input[i];

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"' && field === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      pushField();
      i++;
      continue;
    }
    if (char === "\r") {
      pushRecord();
      if (input[i + 1] === "\n") i++;
      i++;
      continue;
    }
    if (char === "\n") {
      pushRecord();
      i++;
      continue;
    }

    field += char;
    i++;
  }

  if (field.length > 0 || record.length > 0) {
    pushRecord();
  }

  const nonEmpty = records.filter((r) => r.some((f) => f.trim() !== ""));

  const [headerRow, ...dataRows] = nonEmpty;
  return {
    headers: (headerRow ?? []).map((h) => h.trim()),
    rows: dataRows,
  };
}

/**
 * Parse a currency-ish string ("$1,234.56", "1234.5", "(12.00)") into integer
 * cents. Accepts a leading currency symbol, thousands separators, and
 * parenthesised or minus-sign negatives. Returns null when the value is empty
 * or not a number.
 */
export function parseCurrencyToCents(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = input.replace(/[$,\s]/g, "");
  if (s === "") return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }

  if (!/^(\d+(\.\d+)?|\.\d+)$/.test(s)) return null;

  const cents = Math.round(Number(s) * 100);
  return negative ? -cents : cents;
}
