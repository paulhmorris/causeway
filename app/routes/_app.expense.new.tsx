import { TransactionItemTypeDirection } from "@prisma/client";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import { IconPlus } from "@tabler/icons-react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ReceiptSelector } from "~/components/common/receipt-selector";
import { TransactionItem } from "~/components/common/transaction-item";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { formatCentsAsDollars, getToday } from "~/lib/utils";
import { TransactionSchema } from "~/schemas";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";
import { generateTransactionItems, getTransactionItemMethods } from "~/services.server/transaction";

const logger = createLogger("Routes.ExpenseNew");

export const meta: MetaFunction = () => [{ title: "Add Expense" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const [contacts, contactTypes, accounts, transactionItemMethods, transactionItemTypes, categories, receipts] =
    await Promise.all([
      db.contact.findMany({ where: { orgId }, include: { type: true } }),
      getContactTypes(orgId),
      db.account.findMany({ where: { orgId }, orderBy: { code: "asc" } }),
      getTransactionItemMethods(orgId),
      db.transactionItemType.findMany({
        where: {
          OR: [{ orgId }, { orgId: null }],
          direction: TransactionItemTypeDirection.OUT,
        },
      }),
      db.transactionCategory.findMany({ orderBy: { id: "asc" } }),
      db.receipt.findMany({
        // Admins can see all receipts, users can only see their own
        where: {
          orgId,
          userId: user.isMember ? user.id : undefined,
          reimbursementRequests: { none: {} },
          transactions: { none: {} },
        },
        include: { user: { select: { contact: { select: { email: true } } } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    contacts,
    contactTypes,
    accounts,
    transactionItemMethods,
    transactionItemTypes,
    categories,
    receipts,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, TransactionSchema);
  if (result.error) {
    return validationError(result.error);
  }
  const { transactionItems, contactId, receiptIds, ...rest } = result.data;

  try {
    const { transactionItems: trxItems, totalInCents } = await generateTransactionItems(transactionItems, orgId);
    const receiptIdArr = typeof receiptIds === "string" ? [receiptIds] : receiptIds?.length ? receiptIds : [];

    const transaction = await db.transaction.create({
      data: {
        orgId,
        amountInCents: totalInCents,
        contactId: contactId ?? undefined,
        transactionItems: { createMany: { data: trxItems } },
        receipts: receiptIdArr.length ? { connect: receiptIdArr.map((id) => ({ id })) } : undefined,

        ...rest,
      },
      select: {
        account: {
          select: {
            id: true,
            code: true,
          },
        },
      },
    });

    return Toasts.redirectWithSuccess(`/accounts/${transaction.account.id}`, {
      message: "Success",
      description: `Expense of ${formatCentsAsDollars(totalInCents)} charged to account ${transaction.account.code}`,
    });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "An unknown error occurred" });
  }
};

export default function AddExpensePage() {
  const { contacts, contactTypes, accounts, transactionItemMethods, transactionItemTypes, categories, receipts } =
    useLoaderData<typeof loader>();
  const form = useForm({
    schema: TransactionSchema,
    method: "post",
    defaultValues: {
      accountId: "",
      contactId: "",
      categoryId: "",
      description: "",
      date: getToday(),
      receiptIds: [],
      transactionItems: [
        {
          methodId: "",
          typeId: "",
          amountInCents: "",
        },
      ],
    },
  });

  let total = 0;
  form.value().transactionItems.forEach((i) => (total += Number(i.amountInCents) * 100));

  return (
    <>
      <PageHeader title="Add Expense" />
      <PageContainer>
        <form {...form.getFormProps()} className="sm:max-w-xl">
          <div className="mt-8 space-y-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <div className="w-auto">
                  <FormField required scope={form.scope("date")} label="Date" type="date" />
                </div>
                <FormSelect
                  required
                  scope={form.scope("categoryId")}
                  label="Category"
                  placeholder="Select category"
                  options={categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  }))}
                />
              </div>
              <FormTextarea
                required
                scope={form.scope("description")}
                label="Note"
                description="Shown on transaction tables and reports"
                placeholder="Select description"
              />
              <FormSelect
                required
                scope={form.scope("accountId")}
                label="Account"
                placeholder="Select account"
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.code} - ${a.description}`,
                }))}
              />
              <ContactDropdown
                types={contactTypes}
                contacts={contacts}
                scope={form.scope("contactId")}
                label="Payable To"
              />
            </div>
            <ul className="flex flex-col gap-4">
              {form.array("transactionItems").map((key, item, index) => {
                const prefix = `transactionItems[${index}]`;
                return (
                  <li key={key}>
                    <TransactionItem
                      title={`Item ${index + 1}`}
                      itemScope={item.scope()}
                      fieldPrefix={prefix}
                      trxItemTypes={transactionItemTypes}
                      trxItemMethods={transactionItemMethods}
                      removeItemHandler={() => form.array("transactionItems").remove(index)}
                    />
                  </li>
                );
              })}
            </ul>
            <Button
              onClick={() => form.array("transactionItems").push({ methodId: "", typeId: "", amountInCents: "" })}
              variant="outline"
              className="flex items-center gap-2"
              type="button"
            >
              <IconPlus className="size-4" />
              <span>Add item</span>
            </Button>
            <Separator className="my-4" />
            <ReceiptSelector receipts={receipts} />
            <div className="space-y-1">
              <p className="text-primary text-sm font-bold">Total: {formatCentsAsDollars(total)}</p>
              <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit Expense</SubmitButton>
            </div>
          </div>
        </form>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
