import { TransactionItemTypeDirection } from "@prisma/client";
import { FormScope, parseFormData, useForm, validationError } from "@rvf/react-router";
import { IconPlus } from "@tabler/icons-react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ReceiptSelector } from "~/components/common/receipt-selector";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { formatCentsAsDollars, getToday } from "~/lib/utils";
import { TransactionSchema } from "~/models/schemas";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";
import { generateTransactionItems, getTransactionItemMethods } from "~/services.server/transaction";

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
    // ...setFormDefaults("expense-form", {
    //   transactionItems: [{ id: nanoid() }],
    // }),
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
    const transaction = await db.transaction.create({
      data: {
        orgId,
        amountInCents: totalInCents,
        contactId: contactId ?? undefined,
        transactionItems: { createMany: { data: trxItems } },
        receipts: receiptIds.length > 0 ? { connect: receiptIds.map((id) => ({ id })) } : undefined,
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
    console.error(error);
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
        },
      ],
    },
  });

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
                    <Card>
                      <CardHeader>
                        <CardTitle>Item {index + 1}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <input type="hidden" name={`${prefix}.id`} />
                        <fieldset className="space-y-3">
                          <div className="grid grid-cols-10 items-start gap-2">
                            <div className="col-span-3 sm:col-span-2">
                              <FormField
                                required
                                label="Amount"
                                isCurrency
                                scope={item.scope("amountInCents") as FormScope<string>}
                              />
                            </div>
                            <FormSelect
                              divProps={{ className: "col-span-3 sm:col-span-4" }}
                              required
                              scope={item.scope("methodId")}
                              label="Method"
                              placeholder="Select method"
                              options={transactionItemMethods.map((t) => ({
                                value: t.id,
                                label: t.name,
                              }))}
                            />
                            <FormSelect
                              divProps={{ className: "col-span-4" }}
                              required
                              scope={item.scope("typeId")}
                              label="Type"
                              placeholder="Select type"
                              options={transactionItemTypes.map((t) => ({
                                value: t.id,
                                label: t.name,
                              }))}
                            />
                          </div>
                          <FormField
                            scope={item.scope("description")}
                            label="Description"
                            description="Will only be shown in transaction details and reports"
                          />
                        </fieldset>
                      </CardContent>
                      <CardFooter>
                        <Button
                          aria-label={`Remove item ${index + 1}`}
                          onClick={() => form.array("transactionItems").remove(index)}
                          variant="destructive"
                          type="button"
                          className="ml-auto"
                        >
                          Remove
                        </Button>
                      </CardFooter>
                    </Card>
                  </li>
                );
              })}
            </ul>
            <Button
              onClick={() => form.array("transactionItems").push({ methodId: "", typeId: "" })}
              variant="outline"
              className="flex items-center gap-2"
              type="button"
            >
              <IconPlus className="h-4 w-4" />
              <span>Add item</span>
            </Button>
            <Separator />
            <ReceiptSelector receipts={receipts} />
            <SubmitButton
              isSubmitting={form.formState.isSubmitting}
              disabled={form.array("transactionItems").length() === 0}
            >
              Submit Expense
            </SubmitButton>
          </div>
        </form>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
