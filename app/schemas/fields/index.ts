import { z } from "zod/v4";

const _text = z.string().max(255, "Must be 255 characters or less").trim();
export const text = _text.min(1, "Required");
export const optionalText = _text.optional();

const _longText = z.string().max(1000, "Must be 1000 characters or less").trim();
export const longText = _longText.min(1, "Required");
export const optionalLongText = _longText.optional();

export const number = z.coerce.number({ error: (e) => (!e.input ? "Required" : "Must be a number") });
export const optionalNumber = number.optional();

export const date = z.coerce.date({ error: (e) => (!e.input ? "Required" : "Invalid date") });
export const optionalDate = date.optional();

export const checkbox = z.coerce.boolean();
export const optionalCheckbox = checkbox.optional();

export const checkboxGroup = z.array(z.coerce.string()).or(z.string());
export const optionalCheckboxGroup = checkboxGroup.optional();

export const select = z.coerce
  .string()
  .min(1, { error: "Required" })
  .max(255, { error: "Must be 255 characters or less" });
export const optionalSelect = select.optional();

export const cuid = z.cuid({ error: (e) => (!e.input ? "Required" : "Invalid ID") });
export const email = z.email({ error: (e) => (!e.input ? "Required" : "Invalid email address") });
export const password = _text.min(8, "Must be 8 or more characters");
export const url = z.url({ error: (e) => (!e.input ? "Required" : "Invalid URL") });
export const currency = z.preprocess(
  (v) => (typeof v === "string" && v.startsWith("$") ? v.slice(1) : v),
  number
    .multipleOf(0.01, { error: "Must be multiple of $0.01" })
    .nonnegative({ error: "Must be greater than $0.00" })
    .transform((dollars) => Math.round(dollars * 100)),
);
export const phoneNumber = _text
  .transform((val) => val.replace(/\D/g, ""))
  .pipe(z.string().length(10, { error: "Invalid phone number" }));
