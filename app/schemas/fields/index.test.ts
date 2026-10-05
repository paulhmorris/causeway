import { z } from "zod/v4";

import { optionalEmail, optionalLongText, optionalPhoneNumber, optionalSelect, optionalText } from "~/schemas/fields";

describe.each([
  ["optionalText", optionalText, "Smith"],
  ["optionalLongText", optionalLongText, "Some notes"],
  ["optionalSelect", optionalSelect, "cuid123"],
  ["optionalEmail", optionalEmail, "someone@example.com"],
  ["optionalPhoneNumber", optionalPhoneNumber, "5555555555"],
] as const)("%s", (_, field, value) => {
  const schema = z.object({ field });

  it("clears the value when submitted blank", () => {
    expect(schema.parse({ field: "" })).toEqual({ field: null });
  });

  it("leaves the value untouched when not submitted", () => {
    expect(schema.parse({})).toEqual({ field: undefined });
  });

  it("keeps a submitted value", () => {
    expect(schema.parse({ field: value })).toEqual({ field: value });
  });
});

it("treats whitespace-only text as blank", () => {
  expect(optionalText.parse("   ")).toBeNull();
});
