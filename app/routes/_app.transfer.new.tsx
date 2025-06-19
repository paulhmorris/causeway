import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionCategory, TransactionItemType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { getToday } from "~/lib/utils";
import { cuid, currency, date, optionalLongText } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";
import { getTransactionItemMethods } from "~/services.server/transaction";

const logger = createLogger("Routes.TransferNew");

const schema = z.object({
  date: date.transform((d) => dayjs(d).startOf("day").toDate()),
  description: optionalLongText,
  fromAccountId: cuid,
  toAccountId: cuid,
  amountInCents: currency.pipe(z.number().positive({ error: "Amount must be greater than $0.00" })),
});

export const meta: MetaFunction = () => [{ title: "Add Transfer" }];

export const loader = async (args: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const [accounts, transactionItemMethods] = await Promise.all([
    db.account.findMany({ where: { orgId }, orderBy: { code: "asc" } }),
    getTransactionItemMethods(orgId),
  ]);

  return {
    accounts,
    transactionItemMethods,
  };
};

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }
  const { fromAccountId, toAccountId, amountInCents, description, ...rest } = result.data;

  if (fromAccountId === toAccountId) {
    return Toasts.dataWithWarning(null, { message: "Warning", description: "From and To accounts must be different." });
  }

  try {
    const fromAccountBalance = await db.transaction.aggregate({
      where: { accountId: result.data.fromAccountId, orgId },
      _sum: { amountInCents: true },
    });

    const fromAccountBalanceInCents = fromAccountBalance._sum.amountInCents ?? 0;

    if (amountInCents > fromAccountBalanceInCents) {
      return Toasts.dataWithError(null, { message: "Warning", description: "Insufficient funds in from account." });
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
      message: "Success",
      description: `Transfer completed successfully.`,
    });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(null, { message: "An unknown error occurred" });
  }
};

export default function AddTransferPage() {
  const { accounts } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Add Transfer" />
      <PageContainer>
        <ValidatedForm
          method="post"
          schema={schema}
          defaultValues={{
            date: dayjs().format("YYYY-MM-DD"),
            description: "",
            fromAccountId: "",
            toAccountId: "",
            amountInCents: "",
          }}
          className="space-y-2 sm:max-w-md"
        >
          {(form) => (
            <>
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <div className="w-auto">
                  <FormField required scope={form.scope("date")} label="Date" type="date" defaultValue={getToday()} />
                </div>
                <FormField scope={form.scope("description")} label="Description" />
              </div>
              <FormSelect
                required
                scope={form.scope("fromAccountId")}
                label="From"
                placeholder="Select from account"
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.code} - ${a.description}`,
                  disabled: a.id === form.field("toAccountId").value(),
                }))}
              />
              <FormSelect
                required
                scope={form.scope("toAccountId")}
                label="To"
                placeholder="Select to account"
                options={accounts.map((a) => ({
                  value: a.id,
                  label: `${a.code} - ${a.description}`,
                  disabled: a.id === form.field("fromAccountId").value(),
                }))}
              />
              <FormField isCurrency required scope={form.scope("amountInCents")} label="Amount" className="w-36" />
              <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit Transfer</SubmitButton>
            </>
          )}
        </ValidatedForm>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
