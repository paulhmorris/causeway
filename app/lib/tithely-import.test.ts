import { describe, expect, it } from "vitest";

import { TransactionItemMethod } from "~/lib/constants";
import {
  analyzeRecords,
  assignColumn,
  autoDetectMapping,
  contactLabel,
  distinctFunds,
  findDuplicateTransaction,
  matchContact,
  matchPaymentMethod,
  missingRequiredFields,
  NO_FUND,
  normalizeHeader,
  parseImportDate,
  SKIP_FUND,
  toImportRecords,
  UNMAPPED,
  type ImportRecord,
} from "~/lib/tithely-import";

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

describe("parseImportDate", () => {
  it("accepts the formats Tithe.ly and spreadsheets produce", () => {
    expect(parseImportDate("2026-03-04")).toBe("2026-03-04");
    expect(parseImportDate("3/4/2026")).toBe("2026-03-04");
    expect(parseImportDate("03/04/2026")).toBe("2026-03-04");
    expect(parseImportDate("2026-03-04T12:30:00Z")).toBe("2026-03-04");
    expect(parseImportDate("2026-03-04T23:30:00-08:00")).toBe("2026-03-04");
  });

  it("returns null for blank or unparseable values", () => {
    expect(parseImportDate("")).toBeNull();
    expect(parseImportDate("   ")).toBeNull();
    expect(parseImportDate("not a date")).toBeNull();
    expect(parseImportDate(null)).toBeNull();
  });
});

describe("toImportRecords", () => {
  const mapping = autoDetectMapping(["Date", "Amount", "First Name", "Last Name", "Email", "Fund"]);

  it("normalizes valid rows and reports unusable ones", () => {
    const parsed = {
      headers: ["Date", "Amount", "First Name", "Last Name", "Email", "Fund"],
      rows: [
        ["3/4/2026", "$1,250.00", "Jane", "Doe", "jane@example.com", "General"],
        ["bad date", "$50.00", "Bob", "Smith", "", "General"],
        ["3/5/2026", "", "Ann", "Lee", "", "General"],
        ["3/6/2026", "$0.00", "Zero", "Gift", "", "General"],
        ["3/7/2026", "-$20.00", "Re", "Fund", "", "General"],
      ],
      rowNumbers: [2, 3, 5, 6, 7],
    };

    const { records, errors } = toImportRecords(parsed, mapping);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      rowNumber: 2,
      date: "2026-03-04",
      amountInCents: 125000,
      firstName: "Jane",
      email: "jane@example.com",
      fund: "General",
    });
    expect(errors.map((e) => e.rowNumber)).toEqual([3, 5, 6, 7]);
    expect(errors[3].message).toContain("Negative");
  });

  it("ignores fully blank rows without reporting an error", () => {
    const parsed = {
      headers: ["Date", "Amount", "First Name", "Last Name", "Email", "Fund"],
      rows: [["", "", "", "", "", ""]],
      rowNumbers: [2],
    };
    const { records, errors } = toImportRecords(parsed, mapping);
    expect(records).toEqual([]);
    expect(errors).toEqual([]);
  });

  it("leaves unmapped optional fields null", () => {
    const dateAmountOnly = autoDetectMapping(["Date", "Amount"]);
    const parsed = { headers: ["Date", "Amount"], rows: [["3/4/2026", "10"]], rowNumbers: [2] };
    const { records } = toImportRecords(parsed, dateAmountOnly);
    expect(records[0].email).toBeNull();
    expect(records[0].fund).toBeNull();
    expect(records[0].feeInCents).toBe(0);
  });

  it("reads the fee as a positive amount and rejects unusable fees", () => {
    const withFee = autoDetectMapping(["Date", "Amount", "Fee"]);
    const parsed = {
      headers: ["Date", "Amount", "Fee"],
      rows: [
        ["3/4/2026", "$100.00", "$3.20"],
        ["3/4/2026", "$100.00", "-3.20"],
        ["3/4/2026", "$100.00", "n/a"],
        ["3/4/2026", "$1.00", "$1.00"],
      ],
      rowNumbers: [2, 3, 4, 5],
    };
    const { records, errors } = toImportRecords(parsed, withFee);
    expect(records.map((r) => r.feeInCents)).toEqual([320, 320]);
    expect(errors.map((e) => e.rowNumber)).toEqual([4, 5]);
  });
});

describe("distinctFunds", () => {
  it("returns unique fund names in first-seen order", () => {
    const records = [{ fund: "General" }, { fund: "Missions" }, { fund: "General" }, { fund: null }];
    expect(distinctFunds(records as Array<ImportRecord>)).toEqual(["General", "Missions"]);
  });
});

describe("matchContact", () => {
  const contacts = [
    { id: "c1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
    { id: "c2", firstName: "Bob", lastName: "Smith", email: null },
    { id: "c3", firstName: "Bob", lastName: "Smith", email: "other@example.com" },
  ];

  it("matches on email regardless of case", () => {
    const match = matchContact({ firstName: null, lastName: null, email: "JANE@example.com" }, contacts);
    expect(match?.id).toBe("c1");
  });

  it("falls back to a full name match when there is no email", () => {
    const match = matchContact({ firstName: "Jane", lastName: "Doe", email: null }, contacts);
    expect(match?.id).toBe("c1");
  });

  it("refuses to guess when a name is ambiguous", () => {
    expect(matchContact({ firstName: "Bob", lastName: "Smith", email: null }, contacts)).toBeNull();
  });

  it("does not match on a first name alone", () => {
    expect(matchContact({ firstName: "Jane", lastName: null, email: null }, contacts)).toBeNull();
  });
});

describe("findDuplicateTransaction", () => {
  const existing = [{ id: "t1", date: new Date("2026-03-04T00:00:00Z"), amountInCents: 5000, contactId: "c1" }];

  it("flags same day, same amount, same contact", () => {
    const dup = findDuplicateTransaction({ date: "2026-03-04", amountInCents: 5000, feeInCents: 0 }, "c1", existing);
    expect(dup?.id).toBe("t1");
  });

  it("does not flag a different contact, amount, or day", () => {
    expect(
      findDuplicateTransaction({ date: "2026-03-04", amountInCents: 5000, feeInCents: 0 }, "c2", existing),
    ).toBeNull();
    expect(
      findDuplicateTransaction({ date: "2026-03-04", amountInCents: 7500, feeInCents: 0 }, "c1", existing),
    ).toBeNull();
    expect(
      findDuplicateTransaction({ date: "2026-03-05", amountInCents: 5000, feeInCents: 0 }, "c1", existing),
    ).toBeNull();
  });

  it("compares the net amount, since imported transactions are stored net of fees", () => {
    const dup = findDuplicateTransaction({ date: "2026-03-04", amountInCents: 5175, feeInCents: 175 }, "c1", existing);
    expect(dup?.id).toBe("t1");
  });
});

describe("matchPaymentMethod", () => {
  it("maps the values Tithe.ly exports", () => {
    expect(matchPaymentMethod("Credit Card")).toBe(TransactionItemMethod.Credit_Card);
    expect(matchPaymentMethod("debit card")).toBe(TransactionItemMethod.Debit_Card);
    expect(matchPaymentMethod("ACH")).toBe(TransactionItemMethod.ACH);
    expect(matchPaymentMethod("Check")).toBe(TransactionItemMethod.Check);
    expect(matchPaymentMethod("PayPal")).toBe(TransactionItemMethod.PayPal);
  });

  it("reads eCheck as ACH rather than a paper check", () => {
    expect(matchPaymentMethod("eCheck")).toBe(TransactionItemMethod.ACH);
  });

  it("falls back to Tithe.ly when missing or unrecognized", () => {
    expect(matchPaymentMethod(null)).toBe(TransactionItemMethod.Tithely);
    expect(matchPaymentMethod("")).toBe(TransactionItemMethod.Tithely);
    expect(matchPaymentMethod("something new")).toBe(TransactionItemMethod.Tithely);
  });
});

describe("contactLabel", () => {
  it("prefers a full name, then email, then Anonymous", () => {
    expect(contactLabel({ firstName: "Jane", lastName: "Doe", email: "j@e.com" })).toBe("Jane Doe");
    expect(contactLabel({ firstName: null, lastName: null, email: "j@e.com" })).toBe("j@e.com");
    expect(contactLabel({ firstName: null, lastName: null, email: null })).toBe("Anonymous");
  });
});

describe("analyzeRecords", () => {
  const base = {
    contacts: [{ id: "c1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" }],
    transactions: [{ id: "t1", date: "2026-03-04", amountInCents: 5000, contactId: "c1" }],
    fundAccounts: { General: "acct-1" },
  };

  const record = (over: Partial<ImportRecord> = {}): ImportRecord => ({
    rowNumber: 2,
    date: "2026-03-10",
    amountInCents: 2500,
    feeInCents: 0,
    firstName: "New",
    lastName: "Donor",
    email: "new@example.com",
    fund: "General",
    paymentMethod: null,
    note: null,
    ...over,
  });

  it("marks a new donor as ready and flags contact creation", () => {
    const [row] = analyzeRecords({ ...base, records: [record()] });
    expect(row.status).toBe("ready");
    expect(row.willCreateContact).toBe(true);
    expect(row.accountId).toBe("acct-1");
  });

  it("reuses an existing contact without creating one", () => {
    const [row] = analyzeRecords({ ...base, records: [record({ email: "jane@example.com" })] });
    expect(row.matchedContactId).toBe("c1");
    expect(row.willCreateContact).toBe(false);
  });

  it("flags a row already present in Causeway as a duplicate", () => {
    const [row] = analyzeRecords({
      ...base,
      records: [record({ email: "jane@example.com", date: "2026-03-04", amountInCents: 5000 })],
    });
    expect(row.status).toBe("duplicate");
    expect(row.message).toBe("Already in Causeway");
  });

  it("errors when a fund has no account chosen", () => {
    const [row] = analyzeRecords({ ...base, records: [record({ fund: "Missions" })] });
    expect(row.status).toBe("error");
    expect(row.message).toContain("Missions");
  });

  it("uses the NO_FUND account for records with no fund", () => {
    const [row] = analyzeRecords({
      ...base,
      fundAccounts: { [NO_FUND]: "acct-9" },
      records: [record({ fund: null })],
    });
    expect(row.status).toBe("ready");
    expect(row.accountId).toBe("acct-9");
  });

  it("skips rows whose fund is excluded", () => {
    const [row] = analyzeRecords({ ...base, fundAccounts: { General: SKIP_FUND }, records: [record()] });
    expect(row.status).toBe("skipped");
    expect(row.accountId).toBeNull();
  });

  it("does not flag a new donor against an anonymous gift on the same day", () => {
    const [row] = analyzeRecords({
      ...base,
      transactions: [{ id: "t2", date: "2026-03-10", amountInCents: 2500, contactId: null }],
      records: [record()],
    });
    expect(row.status).toBe("ready");
  });

  it("flags a re-imported anonymous gift as a duplicate", () => {
    const [row] = analyzeRecords({
      ...base,
      transactions: [{ id: "t2", date: "2026-03-10", amountInCents: 2500, contactId: null }],
      records: [record({ firstName: null, lastName: null, email: null })],
    });
    expect(row.status).toBe("duplicate");
  });

  it("lets each existing transaction match only one row", () => {
    const gift = { email: "jane@example.com", date: "2026-03-04", amountInCents: 5000 };
    const rows = analyzeRecords({
      ...base,
      records: [record({ ...gift, rowNumber: 2 }), record({ ...gift, rowNumber: 3 })],
    });
    expect(rows.map((r) => r.status)).toEqual(["duplicate", "ready"]);
  });

  it("does not create a contact for an anonymous gift", () => {
    const [row] = analyzeRecords({
      ...base,
      records: [record({ firstName: null, lastName: null, email: null })],
    });
    expect(row.willCreateContact).toBe(false);
    expect(row.contactLabel).toBe("Anonymous");
  });
});

describe("assignColumn", () => {
  it("unmaps any other field already using the column", () => {
    const mapping = autoDetectMapping(["Date", "Amount", "Fee"]);
    const next = assignColumn(mapping, "fee", 1);
    expect(next.fee).toBe(1);
    expect(next.amount).toBe(UNMAPPED);
    expect(next.date).toBe(0);
  });

  it("allows unmapping without touching other fields", () => {
    const mapping = autoDetectMapping(["Date", "Amount"]);
    const next = assignColumn(mapping, "date", UNMAPPED);
    expect(next.date).toBe(UNMAPPED);
    expect(next.amount).toBe(1);
  });
});
