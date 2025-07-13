import { TransactionItemTypeDirection } from "@prisma/client";
import { render } from "@react-email/render";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import { IconPlus } from "@tabler/icons-react";
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";

import { IncomeNotificationEmail } from "emails/income-notification";
import { PageHeader } from "~/components/common/page-header";
import { ReceiptSelector } from "~/components/common/receipt-selector";
import { TransactionItem } from "~/components/common/transaction-item";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { Mailer } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionItemType } from "~/lib/constants";
import { CONFIG } from "~/lib/env.server";
import { Toasts } from "~/lib/toast.server";
import { formatCentsAsDollars, getToday } from "~/lib/utils";
import { TransactionSchema } from "~/schemas";
import { checkbox } from "~/schemas/fields";
import { ContactService } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";
import { TransactionService } from "~/services.server/transaction";

const logger = createLogger("Routes.IncomeNew");

const schema = TransactionSchema.extend({ shouldNotifyUser: checkbox });

export const meta: MetaFunction = () => [{ title: "Add Income" }];

export const loader = async (args: LoaderFunctionArgs) => {
  const user = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const [contacts, contactTypes, accounts, transactionItemMethods, transactionItemTypes, categories, receipts] =
    await db.$transaction([
      db.contact.findMany({ where: { orgId }, include: { type: true } }),
      ContactService.getTypes(orgId),
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
      TransactionService.getItemMethods(orgId),
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

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }
  const { transactionItems, shouldNotifyUser, contactId, receiptIds, ...rest } = result.data;
  try {
    const { transactionItems: trxItems, totalInCents } = await TransactionService.generateItems(
      transactionItems,
      orgId,
    );
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

      await Mailer.send({
        to: email,
        subject: "You have new income!",
        html: await render(
          <IncomeNotificationEmail
            url={CONFIG.baseUrl}
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
    logger.error(error);
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

  let total = 0;
  form.value().transactionItems.forEach((i) => (total += Number(i.amountInCents) * 100));

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
              <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit Income</SubmitButton>
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
