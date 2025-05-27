import { TransactionItemTypeDirection } from "@prisma/client";
import { render } from "@react-email/render";
import { FormScope, parseFormData, useForm, validationError } from "@rvf/react-router";
import { IconPlus } from "@tabler/icons-react";
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";

import { IncomeNotificationEmail } from "emails/income-notification";
import { PageHeader } from "~/components/common/page-header";
import { ReceiptSelector } from "~/components/common/receipt-selector";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { sendEmail } from "~/integrations/email.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionItemType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { constructOrgMailFrom, constructOrgURL, formatCentsAsDollars, getToday } from "~/lib/utils";
import { checkbox } from "~/schemas/fields";
import { TransactionSchema } from "~/schemas/schemas";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";
import { generateTransactionItems, getTransactionItemMethods } from "~/services.server/transaction";

const schema = TransactionSchema.extend({ shouldNotifyUser: checkbox });

export const meta: MetaFunction = () => [{ title: "Add Income" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const [contacts, contactTypes, accounts, transactionItemMethods, transactionItemTypes, categories, receipts] =
    await db.$transaction([
      db.contact.findMany({ where: { orgId }, include: { type: true } }),
      getContactTypes(orgId),
      db.account.findMany({
        where: { orgId },
        select: {
          id: true,
          code: true,
          description: true,
          user: { select: { id: true } },
          _count: { select: { subscribers: true } },
        },
        orderBy: { code: "asc" },
      }),
      getTransactionItemMethods(orgId),
      db.transactionItemType.findMany({
        where: {
          AND: [
            { OR: [{ orgId }, { orgId: null }] },
            { OR: [{ direction: TransactionItemTypeDirection.IN }, { id: TransactionItemType.Fee }] },
          ],
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

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }
  const { transactionItems, shouldNotifyUser, contactId, receiptIds, ...rest } = result.data;
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
        amountInCents: true,
        account: {
          select: {
            code: true,
            id: true,
            user: {
              select: {
                contact: {
                  select: {
                    firstName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        org: {
          select: {
            name: true,
            host: true,
            subdomain: true,
            replyToEmail: true,
          },
        },
      },
    });

    if (shouldNotifyUser) {
      const email = transaction.account.user?.contact.email;
      if (!email) {
        return Toasts.redirectWithError(`/accounts/${transaction.account.id}`, {
          message: "Error notifying subscribers",
          description: "We couldn't find any subscribers to this account. Your transaction was created.",
        });
      }

      const org = transaction.org;
      await sendEmail({
        from: constructOrgMailFrom(org),
        to: email,
        subject: "You have new income!",
        html: await render(
          <IncomeNotificationEmail
            url={constructOrgURL("/", org).toString()}
            accountName={transaction.account.code}
            amountInCents={transaction.amountInCents}
            userFirstname={transaction.account.user?.contact.firstName ?? "User"}
          />,
        ),
      });
    }

    return Toasts.redirectWithSuccess(`/accounts/${transaction.account.id}`, {
      message: "Success",
      description: `Income of ${formatCentsAsDollars(totalInCents)} added to account ${transaction.account.code}`,
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "An unknown error occurred" });
  }
};

export default function AddIncomePage() {
  const { contacts, contactTypes, accounts, transactionItemMethods, transactionItemTypes, receipts, categories } =
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

  const selectedAccountId = form.field("accountId").value();
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const accountHasUserOrSubscribers = Boolean(selectedAccount?.user) || Boolean(selectedAccount?._count.subscribers);

  return (
    <>
      <PageHeader title="Add Income" />
      <PageContainer>
        <form {...form.getFormProps()} className="sm:max-w-xl">
          <div className="mt-8 space-y-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <div className="w-auto">
                  <FormField required scope={form.scope("date")} label="Date" type="date" defaultValue={getToday()} />
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
              <div>
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
                {accountHasUserOrSubscribers ? (
                  <Label className="my-2 inline-flex cursor-pointer items-center gap-2">
                    <Checkbox name="shouldNotifyUser" aria-label="Notify User" />
                    <span>Notify User</span>
                  </Label>
                ) : null}
              </div>
              <ContactDropdown
                types={contactTypes}
                contacts={contacts}
                scope={form.scope("contactId")}
                label="Contact"
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
              onClick={() => form.array("transactionItems").push({ methodId: "", typeId: "", amountInCents: "" })}
              variant="outline"
              className="flex items-center gap-2"
              type="button"
            >
              <IconPlus className="h-4 w-4" />
              <span>Add item</span>
            </Button>
            <Separator className="my-4" />
            <ReceiptSelector receipts={receipts} />

            <SubmitButton
              isSubmitting={form.formState.isSubmitting}
              disabled={!form.formState.isDirty || form.array("transactionItems").length() === 0}
            >
              Submit Income
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
