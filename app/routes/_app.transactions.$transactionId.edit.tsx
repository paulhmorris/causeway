import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, MetaFunction, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";
dayjs.extend(utc);

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { BackButton } from "~/components/ui/back-button";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { cuid, optionalText, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.TransactionEdit");

const schema = z.object({
  id: cuid,
  date: text,
  categoryId: text,
  description: optionalText,
});

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  invariant(params.transactionId, "transactionId not found");
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const transaction = await db.transaction.findUnique({
    where: { id: params.transactionId, orgId },
    include: {
      account: true,
      contact: true,
      category: true,
      transactionItems: {
        include: {
          type: true,
          method: true,
        },
      },
    },
  });

  const categories = await db.transactionCategory.findMany();

  if (!transaction) throw notFound({ message: "Transaction not found" });

  return { transaction, categories };
};

export const meta: MetaFunction = () => [{ title: "Transaction Edit" }];

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { date, description, categoryId, id } = result.data;

  try {
    await db.transaction.update({
      where: { id, orgId },
      data: {
        date: new Date(date),
        description: description ?? undefined,
        categoryId: +categoryId,
      },
    });

    return Toasts.redirectWithSuccess(`/transactions/${id}`, {
      message: "Success",
      description: `Transaction has been updated.`,
    });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "An unknown error has occurred. Please try again later.",
    });
  }
};

export default function TransactionDetailsPage() {
  const { transaction, categories } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Transaction Edit" />
      <BackButton to={`/transactions/${transaction.id}`} />

      <PageContainer className="max-w-3xl">
        <div className="space-y-8">
          <div>
            <h2 className="sr-only">Details</h2>
            <dl className="divide-muted divide-y">
              <DetailItem label="Id" value={transaction.id} />
              <DetailItem label="Account">
                <Link to={`/accounts/${transaction.accountId}`} prefetch="intent" className="text-primary font-medium">
                  {`${transaction.account.code}`} - {transaction.account.description}
                </Link>
              </DetailItem>
              {transaction.contact ? (
                <DetailItem label="Contact">
                  <Link
                    to={`/contacts/${transaction.contactId}`}
                    prefetch="intent"
                    className="text-primary font-medium"
                  >{`${transaction.contact.firstName} ${transaction.contact.lastName}`}</Link>
                </DetailItem>
              ) : null}
              <ValidatedForm
                schema={schema}
                method="PUT"
                defaultValues={{
                  ...transaction,
                  date: dayjs(transaction.date).utc().format("YYYY-MM-DD"),
                  description: transaction.description ?? "",
                  categoryId: String(transaction.categoryId),
                }}
              >
                {(form) => (
                  <>
                    <div className="flex flex-col">
                      <input type="hidden" name="id" value={transaction.id} />
                      <div className="items-center py-1.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                        <dt className="text-sm font-semibold capitalize">Date</dt>
                        <dd className={cn("mt-1 sm:col-span-2 sm:mt-0")}>
                          <FormField scope={form.scope("date")} label="Date" hideLabel type="date" />
                        </dd>
                      </div>
                      <div className="items-center py-1.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                        <dt className="text-sm font-semibold capitalize">Category</dt>
                        <dd className={cn("mt-1 sm:col-span-2 sm:mt-0")}>
                          <FormSelect
                            hideLabel
                            required
                            scope={form.scope("categoryId")}
                            label="Category"
                            placeholder="Select category"
                            options={categories.map((c) => ({
                              value: c.id,
                              label: c.name,
                            }))}
                          />
                        </dd>
                      </div>
                      <div className="items-start py-1.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                        <dt className="text-sm font-semibold capitalize">Description</dt>
                        <dd className={cn("mt-1 sm:col-span-2 sm:mt-0")}>
                          <FormTextarea scope={form.scope("description")} label="Description" hideLabel />
                        </dd>
                      </div>
                    </div>
                    <SubmitButton isSubmitting={form.formState.isSubmitting} className="ml-auto self-start">
                      Save
                    </SubmitButton>
                  </>
                )}
              </ValidatedForm>
            </dl>
          </div>

          <div>
            <h2 className="sr-only">Items</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.transactionItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.type.name}</TableCell>
                    <TableCell>{item.method?.name}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell className="text-right">{formatCentsAsDollars(item.amountInCents, 2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="flex items-center justify-end gap-2 border-t pt-4 pr-4 text-sm font-bold">
              <p>Total</p>
              <p>{formatCentsAsDollars(transaction.amountInCents, 2)}</p>
            </div>
          </div>
        </div>
      </PageContainer>
    </>
  );
}

function DetailItem({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="items-center py-1.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
      <dt className="text-sm font-semibold capitalize">{label}</dt>
      <dd className={cn("text-muted-foreground mt-1 text-sm sm:col-span-2 sm:mt-0")}>
        {value ?? null}
        {children}
      </dd>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
