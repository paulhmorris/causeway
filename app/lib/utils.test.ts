import { Contact } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  capitalize,
  cn,
  formatCentsAsDollars,
  formatCurrency,
  formatPhoneNumber,
  getAllSearchParams,
  getInitials,
  getSearchParam,
  getToday,
  isArray,
  normalizeEnum,
} from "~/lib/utils";

describe("utils", () => {
  it("cn merges class names", () => {
    expect(cn("a", "b", undefined, null, false, "c")).toBe("a b c");
  });

  it("normalizeEnum formats enums nicely", () => {
    expect(normalizeEnum("SOME_ENUM_VALUE")).toBe("Some Enum Value");
    expect(normalizeEnum("the_and_for_of")).toBe("The and for of");
  });

  it("getSearchParam returns correct param", () => {
    const req = { url: "https://x.com/?foo=bar&baz=qux" } as Request;
    expect(getSearchParam("foo", req)).toBe("bar");
    expect(getSearchParam("baz", req)).toBe("qux");
    expect(getSearchParam("missing", req)).toBeNull();
  });

  it("getAllSearchParams returns all values for a param", () => {
    const req = { url: "https://x.com/?foo=bar&foo=baz" } as Request;
    expect(getAllSearchParams("foo", req)).toEqual(["bar", "baz"]);
  });

  it("formatCurrency formats numbers as USD", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
    expect(formatCurrency(1000, 0)).toBe("$1,000");
  });

  it("formatCentsAsDollars formats cents as dollars", () => {
    expect(formatCentsAsDollars(12345)).toBe("$123.45");
    expect(formatCentsAsDollars(null)).toBe("$0.00");
    expect(formatCentsAsDollars(undefined)).toBe("$0.00");
    expect(formatCentsAsDollars(100, 0)).toBe("$1");
  });

  it("formatPhoneNumber formats 10-digit numbers", () => {
    expect(formatPhoneNumber("1234567890")).toBe("(123) 456-7890");
    expect(formatPhoneNumber("(123)456-7890")).toBe("(123) 456-7890");
    expect(formatPhoneNumber("1234567")).toBeNull();
  });

  it("getToday returns today's date in yyyy-mm-dd", () => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    expect(getToday()).toBe(`${yyyy}-${mm}-${dd}`);
  });

  it("getInitials returns initials", () => {
    const contact = { firstName: "John", lastName: "Doe" } as Contact;
    expect(getInitials(contact)).toBe("JD");
    expect(getInitials({ firstName: "A", lastName: null } as Contact)).toBe("A");
  });

  it("isArray works as a type guard", () => {
    expect(isArray([1, 2, 3])).toBe(true);
    expect(isArray("not array")).toBe(false);
  });

  it("capitalize capitalizes the first letter and lowercases the rest", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("HELLO")).toBe("Hello");
    expect(capitalize("h")).toBe("H");
    expect(capitalize("")).toBe("");
  });
});
