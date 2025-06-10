import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { z } from "zod/v4";
dayjs.extend(utc);

import { newContactSchema } from "~/components/forms/new-contact-form";
import { TransactionItemMethod, TransactionItemType } from "~/lib/constants";
import { cuid, currency, number, optionalCheckboxGroup, optionalSelect, optionalText, text } from "~/schemas/fields";

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
  receiptIds: optionalCheckboxGroup,
});

export const UpdateContactSchema = newContactSchema.extend({ id: cuid });
