import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod/v4";

dayjs.extend(utc);

import { ContactType, TransactionItemMethod, TransactionItemType } from "~/lib/constants";
import { cuid, currency, email, number, optionalSelect, optionalText, phoneNumber, text } from "~/schemas/fields";

export const TransactionItemSchema = z.object({
  typeId: number.pipe(z.enum(TransactionItemType, { error: "Invalid type" })),
  methodId: number.pipe(z.enum(TransactionItemMethod, { error: "Invalid method" })),
  amountInCents: currency,
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
  phone: phoneNumber.optional(),
  alternatePhone: phoneNumber.optional(),
  typeId: number.pipe(z.enum(ContactType)),
  address: AddressSchema.optional(),
  assignedUserIds: z.array(cuid).optional(),
});

export const UpdateContactSchema = NewContactSchema.extend({ id: cuid });
