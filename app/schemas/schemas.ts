import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod/v4";

dayjs.extend(utc);

import { ContactType, TransactionItemMethod, TransactionItemType } from "~/lib/constants";
import { cuid, email, number, optionalSelect, optionalText, text } from "~/schemas/fields";

export const CheckboxSchema = z
  .string()
  .transform((val) => val === "on")
  .or(z.undefined());

export const PhoneNumberSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ""))
  .pipe(z.string().length(10, { error: "Invalid phone number" }));

export const CurrencySchema = z.preprocess(
  (v) => (typeof v === "string" && v.startsWith("$") ? v.slice(1) : v),
  z.coerce
    .number({ error: (e) => (e.input === undefined ? "Amount required" : "Must be a number") })
    .multipleOf(0.01, { error: "Must be multiple of $0.01" })
    .nonnegative({ error: "Must be greater than $0.00" })
    .max(99_999, { error: "Must be less than $100,000" })
    .transform((dollars) => Math.round(dollars * 100)),
);

export const TransactionItemSchema = z.object({
  typeId: number.pipe(z.enum(TransactionItemType, { error: "Invalid type" })),
  methodId: number.pipe(z.enum(TransactionItemMethod, { error: "Invalid method" })),
  amountInCents: CurrencySchema,
  description: optionalText,
});

export const TransactionSchema = z.object({
  date: text.transform((d) => dayjs.utc(d).startOf("day").toDate()),
  description: optionalText,
  categoryId: number,
  accountId: cuid,
  contactId: optionalSelect.transform((v) => (v === "Select contact" ? undefined : v)),
  transactionItems: z.array(TransactionItemSchema),
  receiptIds: z.array(cuid.optional()),
});

export const AddressSchema = z.object({
  street: text,
  street2: optionalText,
  city: text,
  state: text,
  zip: text,
  country: text,
});

export const NewContactSchema = z.object({
  firstName: optionalText,
  lastName: optionalText,
  organizationName: optionalText,
  email: email.optional(),
  alternateEmail: email.optional(),
  phone: PhoneNumberSchema.optional(),
  alternatePhone: PhoneNumberSchema.optional(),
  typeId: number.pipe(z.enum(ContactType)),
  address: AddressSchema.optional(),
  assignedUserIds: z.array(cuid).optional(),
});

export const UpdateContactSchema = NewContactSchema.extend({ id: cuid });
