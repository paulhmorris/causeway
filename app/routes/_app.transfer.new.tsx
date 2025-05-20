import { Prisma } from "@prisma/client";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, type MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import dayjs from "dayjs";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionCategory, TransactionItemType } from "~/lib/constants";
import { getPrismaErrorText } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getToday } from "~/lib/utils";
import { CurrencySchema } from "~/models/schemas";
import { SessionService } from "~/services.server/session";
import { getTransactionItemMethods } from "~/services.server/transaction";

const validator = withZod(
  z.object({
    date: z.coerce.date().transform((d) => dayjs(d).startOf("day").toDate()),
    description: z.string().optional(),
    fromAccountId: z.string().cuid({ message: "From Account required" }),
    toAccountId: z.string().cuid({ message: "To Account required" }),
    amountInCents: CurrencySchema.pipe(z.number().positive({ message: "Amount must be greater than $0.00" })),
  }),
);

export const meta: MetaFunction = () => [{ title: "Add Transfer" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const [accounts, transactionItemMethods] = await Promise.all([
    db.account.findMany({ where: { orgId }, orderBy: { code: "asc" } }),
    getTransactionItemMethods(orgId),
  ]);

  return {
    accounts,
    transactionItemMethods,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }
  const { fromAccountId, toAccountId, amountInCents, description, ...rest } = result.data;

  if (fromAccountId === toAccountId) {
    return Toasts.jsonWithWarning(
      { message: "From and To accounts must be different." },
      { title: "Warning", description: "From and To accounts must be different." },
    );
  }

  try {
    const fromAccountBalance = await db.transaction.aggregate({
      where: { accountId: result.data.fromAccountId, orgId },
      _sum: { amountInCents: true },
    });

    const fromAccountBalanceInCents = fromAccountBalance._sum.amountInCents ?? 0;

    if (amountInCents > fromAccountBalanceInCents) {
      return Toasts.jsonWithWarning(
        { message: "Insufficient funds in from account." },
        { title: "Warning", description: "Insufficient funds in from account." },
      );
    }

    await db.$transaction([
      // Transfer out
      db.transaction.create({
        data: {
          ...rest,
          orgId,
          categoryId: TransactionCategory.Internal_Transfer_Loss,
          description: description ?? `Transfer to ${toAccountId}`,
          accountId: fromAccountId,
          amountInCents: -1 * amountInCents,
          transactionItems: {
            create: {
              orgId,
              amountInCents: -1 * amountInCents,
              typeId: TransactionItemType.Transfer_Out,
            },
          },
        },
      }),
      // Transfer in
      db.transaction.create({
        data: {
          ...rest,
          orgId,
          categoryId: TransactionCategory.Internal_Transfer_Gain,
          description: description ?? `Transfer from ${toAccountId}`,
          accountId: toAccountId,
          amountInCents: amountInCents,
          transactionItems: {
            create: {
              orgId,
              amountInCents: amountInCents,
              typeId: TransactionItemType.Transfer_In,
            },
          },
        },
      }),
    ]);

    return Toasts.redirectWithSuccess(`/accounts/${toAccountId}`, {
      title: "Success",
      description: `Transfer completed successfully.`,
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    let description = "An error occurred while creating the income";
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      description = getPrismaErrorText(error);
    }
    return Toasts.jsonWithError({ success: false }, { title: "Error creating transfer", description });
  }
};

export default function AddTransferPage() {
  const { accounts } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Add Transfer" />
      <PageContainer>
        <ValidatedForm id="transfer-form" method="post" validator={validator} className="space-y-2 sm:max-w-md">
          <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <div className="w-auto">
              <FormField required name="date" label="Date" type="date" defaultValue={getToday()} />
            </div>
            <FormField name="description" label="Description" />
          </div>
          <FormSelect
            required
            name="fromAccountId"
            label="From"
            placeholder="Select from account"
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.code} - ${a.description}`,
            }))}
          />
          <FormSelect
            required
            name="toAccountId"
            label="To"
            placeholder="Select to account"
            options={accounts.map((a) => ({
              value: a.id,
              label: `${a.code} - ${a.description}`,
            }))}
          />
          <FormField isCurrency required name="amountInCents" label="Amount" className="w-36" />
          <SubmitButton>Submit Transfer</SubmitButton>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
