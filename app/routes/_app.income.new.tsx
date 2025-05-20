import { TransactionItemTypeDirection } from "@prisma/client";
import { render } from "@react-email/render";
import { useFieldArray, ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { IconPlus } from "@tabler/icons-react";
import { IncomeNotificationEmail } from "emails/income-notification";
import { nanoid } from "nanoid";
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";
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
import { CheckboxSchema, TransactionSchema } from "~/models/schemas";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";
import { generateTransactionItems, getTransactionItemMethods } from "~/services.server/transaction";

const validator = withZod(TransactionSchema.extend({ shouldNotifyUser: CheckboxSchema }));

export const meta: MetaFunction = () => [{ title: "Add Income" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const [contacts, contactTypes, accounts, transactionItemMethods, transactionItemTypes, categories, receipts] =
    await db.$transaction([
      db.contact.findMany({ where: { orgId }, include: { type: true } }),
      getContactTypes(orgId),
      db.account.findMany({ where: { orgId }, orderBy: { code: "asc" } }),
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
    // ...setFormDefaults("income-form", {
    //   transactionItems: [{ id: nanoid() }],
    // }),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await validator.validate(await request.formData());
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
        return Toasts.dataWithError(null, {
          message: "Error notifying subscribers",
          description: "We couldn't find the account for this transaction. Your transaction was created.",
        });
      }

      const org = transaction.org;
      await sendEmail({
        from: constructOrgMailFrom(org),
        to: email,
        subject: "You have new income!",
        html: render(
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
  const [items, { push, remove }] = useFieldArray("transactionItems", { formId: "income-form" });

  return (
    <>
      <PageHeader title="Add Income" />
      <PageContainer>
        <ValidatedForm id="income-form" method="post" validator={validator} className="sm:max-w-xl">
          <div className="mt-8 space-y-8">
            <div className="space-y-2">
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <div className="w-auto">
                  <FormField required name="date" label="Date" type="date" defaultValue={getToday()} />
                </div>
                <FormSelect
                  required
                  name="categoryId"
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
                name="description"
                label="Note"
                description="Shown on transaction tables and reports"
                placeholder="Select description"
              />
              <FormSelect
                required
                name="accountId"
                label="Account"
                placeholder="Select account"
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.code} - ${a.description}`,
                }))}
              />
              <ContactDropdown types={contactTypes} contacts={contacts} name="contactId" label="Contact" />
            </div>
            <ul className="flex flex-col gap-4">
              {items.map(({ key }, index) => {
                const fieldPrefix = `transactionItems[${index}]`;
                return (
                  <li key={key}>
                    <Card>
                      <CardHeader>
                        <CardTitle>Item {index + 1}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <input type="hidden" name={`${fieldPrefix}.id`} />
                        <fieldset className="space-y-3">
                          <div className="grid grid-cols-10 gap-2">
                            <div className="col-span-3 sm:col-span-2">
                              <FormField required name={`${fieldPrefix}.amountInCents`} label="Amount" isCurrency />
                            </div>
                            <FormSelect
                              divProps={{ className: "col-span-3 sm:col-span-4" }}
                              required
                              name={`${fieldPrefix}.methodId`}
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
                              name={`${fieldPrefix}.typeId`}
                              label="Type"
                              placeholder="Select type"
                              options={transactionItemTypes.map((t) => ({
                                value: t.id,
                                label: t.name,
                              }))}
                            />
                          </div>
                          <FormField
                            name={`${fieldPrefix}.description`}
                            label="Description"
                            description="Only shown in transaction details and reports"
                          />
                        </fieldset>
                      </CardContent>
                      <CardFooter>
                        <Button
                          aria-label={`Remove item ${index + 1}`}
                          onClick={() => remove(index)}
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
              onClick={() => push({ id: nanoid() })}
              variant="outline"
              className="flex items-center gap-2"
              type="button"
            >
              <IconPlus className="h-4 w-4" />
              <span>Add item</span>
            </Button>
            <Separator className="my-4" />
            <ReceiptSelector receipts={receipts} />
            <div>
              <div>
                <Label className="mb-2 inline-flex cursor-pointer items-center gap-2">
                  <Checkbox name="shouldNotifyUser" aria-label="Notify User" />
                  <span>Notify User</span>
                </Label>
              </div>
              <SubmitButton disabled={items.length === 0}>Submit Income</SubmitButton>
            </div>
          </div>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
