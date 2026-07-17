import { describe, expect, it } from "vitest";

import { autoDetectMapping, missingRequiredFields, normalizeHeader, UNMAPPED } from "~/lib/tithely-import";

describe("normalizeHeader", () => {
  it("lowercases and strips non-alphanumerics", () => {
    expect(normalizeHeader(" First Name ")).toBe("firstname");
    expect(normalizeHeader("E-mail Address")).toBe("emailaddress");
  });
});

describe("autoDetectMapping", () => {
  it("matches typical Tithe.ly headers to their fields", () => {
    const headers = ["Date", "First Name", "Last Name", "Email", "Amount", "Fund", "Payment Method"];
    const mapping = autoDetectMapping(headers);
    expect(mapping.date).toBe(0);
    expect(mapping.firstName).toBe(1);
    expect(mapping.lastName).toBe(2);
    expect(mapping.email).toBe(3);
    expect(mapping.amount).toBe(4);
    expect(mapping.fund).toBe(5);
    expect(mapping.paymentMethod).toBe(6);
  });

  it("leaves unknown fields unmapped", () => {
    const mapping = autoDetectMapping(["Date", "Amount"]);
    expect(mapping.note).toBe(UNMAPPED);
    expect(mapping.email).toBe(UNMAPPED);
  });
});

describe("missingRequiredFields", () => {
  it("reports required fields that are unmapped", () => {
    const mapping = autoDetectMapping(["Email", "Fund"]);
    const missing = missingRequiredFields(mapping).map((f) => f.key);
    expect(missing).toEqual(["date", "amount"]);
  });

  it("is empty once date and amount are mapped", () => {
    const mapping = autoDetectMapping(["Date", "Amount"]);
    expect(missingRequiredFields(mapping)).toEqual([]);
  });
});
