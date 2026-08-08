import { describe, expect, it } from "vitest";

import { extractAmountInCents, extractDate, extractVendor, parseReceiptText } from "~/lib/receipt-ocr";

const HOME_DEPOT = `THE HOME DEPOT
1234 Main St, Mesquite TX
Tel: 972-555-0123

Paint Roller        12.98
Drop Cloth           8.47
SUBTOTAL            21.45
TAX                  1.77
TOTAL              $23.22

VISA ************1234
07/15/2026  10:32 AM
Thank you for shopping`;

describe("extractAmountInCents", () => {
  it("picks the labelled total over the subtotal and line items", () => {
    expect(extractAmountInCents(HOME_DEPOT)).toBe(2322);
  });

  it("handles thousands separators", () => {
    expect(extractAmountInCents("TOTAL $1,234.56")).toBe(123456);
  });

  it("falls back to the largest amount when nothing is labelled", () => {
    expect(extractAmountInCents("Item A 5.00\nItem B 12.50\nItem C 3.25")).toBe(1250);
  });

  it("ignores numbers that aren't two-decimal money", () => {
    // Phone number and quantity should not be read as amounts.
    expect(extractAmountInCents("Call 972-555-0123\nQty 4\nTOTAL 9.99")).toBe(999);
  });

  it("returns null when there is no money", () => {
    expect(extractAmountInCents("no prices here")).toBeNull();
  });

  it("does not treat a subtotal as the total when total is absent", () => {
    // No grand total line, so it falls back to the max amount — which is the subtotal.
    expect(extractAmountInCents("SUBTOTAL 40.00\nTAX 3.30")).toBe(4000);
  });
});

describe("extractDate", () => {
  it("reads a slashed US date", () => {
    expect(extractDate(HOME_DEPOT)).toBe("2026-07-15");
  });

  it("reads an ISO date", () => {
    expect(extractDate("Date: 2026-03-04")).toBe("2026-03-04");
  });

  it("reads a written month", () => {
    expect(extractDate("Purchased on March 4, 2026")).toBe("2026-03-04");
  });

  it("returns null with no date", () => {
    expect(extractDate("no date here")).toBeNull();
  });
});

describe("extractVendor", () => {
  it("takes the merchant name from the top", () => {
    expect(extractVendor(HOME_DEPOT)).toBe("THE HOME DEPOT");
  });

  it("skips amounts, dates, and contact lines", () => {
    const text = `07/15/2026
$23.22
www.store.com
Corner Market
item 1.00`;
    expect(extractVendor(text)).toBe("Corner Market");
  });

  it("returns null when the top is all numbers", () => {
    expect(extractVendor("12.34\n07/15/2026\n999")).toBeNull();
  });
});

describe("parseReceiptText", () => {
  it("pulls all three fields from a realistic receipt", () => {
    expect(parseReceiptText(HOME_DEPOT)).toEqual({
      amountInCents: 2322,
      date: "2026-07-15",
      vendor: "THE HOME DEPOT",
    });
  });

  it("degrades gracefully on unreadable text", () => {
    expect(parseReceiptText("~~~ blurry ~~~")).toEqual({
      amountInCents: null,
      date: null,
      vendor: null,
    });
  });
});
