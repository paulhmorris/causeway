import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod/v4";

dayjs.extend(utc);

import { ContactType, TransactionItemMethod, TransactionItemType } from "~/lib/constants";

export const CheckboxSchema = z
  .string()
  .transform((val) => val === "on")
  .or(z.undefined());

export const PhoneNumberSchema = z
  .string()
  .transform((val) => val.replace(/\D/g, ""))
  .pipe(z.string().length(10, { message: "Invalid phone number" }));

export const EmailSchema = z.email({ error: (e) => (!e.input ? "Email required" : "Must be an email address") });

export const CurrencySchema = z.preprocess(
  (v) => (typeof v === "string" && v.startsWith("$") ? v.slice(1) : v),
  z.coerce
    .number({ error: (e) => (e.input === undefined ? "Amount required" : "Must be a number") })
    .multipleOf(0.01, { message: "Must be multiple of $0.01" })
    .nonnegative({ message: "Must be greater than $0.00" })
    .max(99_999, { message: "Must be less than $100,000" })
    .transform((dollars) => Math.round(dollars * 100)),
);

export const TransactionItemSchema = z.object({
  typeId: z
    .string()
    .transform((v) => +v)
    .pipe(z.enum(TransactionItemType, { error: "Invalid type" })),
  methodId: z
    .string()
    .transform((v) => +v)
    .pipe(z.enum(TransactionItemMethod, { error: "Invalid method" })),
  amountInCents: CurrencySchema,
  description: z.string().optional(),
});

export const TransactionSchema = z.object({
  date: z.string().transform((d) => dayjs.utc(d).startOf("day").toDate()),
  description: z.string().optional(),
  categoryId: z.string().transform((v) => +v),
  accountId: z.cuid({ message: "Account required" }),
  contactId: z
    .string()
    .transform((v) => (v === "Select contact" ? undefined : v))
    .optional(),
  transactionItems: z.array(TransactionItemSchema),
  receiptIds: z.array(z.cuid().optional()),
});

export const AddressSchema = z.object({
  street: z.string(),
  street2: z.string().optional(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  country: z.string().max(5),
});

export const NewContactSchema = z.object({
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  organizationName: z.string().max(255).optional(),
  email: EmailSchema.optional(),
  alternateEmail: EmailSchema.optional(),
  phone: PhoneNumberSchema.optional(),
  alternatePhone: PhoneNumberSchema.optional(),
  typeId: z
    .string()
    .transform((v) => +v)
    .pipe(z.enum(ContactType)),
  address: AddressSchema.optional(),
  assignedUserIds: z.array(z.cuid()).optional(),
});

export const UpdateContactSchema = NewContactSchema.extend({
  id: z.cuid(),
});
