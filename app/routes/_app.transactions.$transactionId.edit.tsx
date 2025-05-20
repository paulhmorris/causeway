import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, MetaFunction, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod";
dayjs.extend(utc);

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { BackButton } from "~/components/ui/back-button";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

const schema = withZod(
  z.object({
    id: z.string().cuid(),
    date: z.string(),
    categoryId: z.string(),
    description: z.string().optional(),
  }),
);

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.transactionId, "transactionId not found");
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

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

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await schema.validate(await request.formData());
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
      message: "Transaction updated",
      description: `Transaction has been updated.`,
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "An unknown error occurred" });
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
            <dl className="divide-y divide-muted">
              <DetailItem label="Id" value={transaction.id} />
              <DetailItem label="Account">
                <Link to={`/accounts/${transaction.accountId}`} className="font-medium text-primary">
                  {`${transaction.account.code}`} - {transaction.account.description}
                </Link>
              </DetailItem>
              {transaction.contact ? (
                <DetailItem label="Contact">
                  <Link
                    to={`/contacts/${transaction.contactId}`}
                    className="font-medium text-primary"
                  >{`${transaction.contact.firstName} ${transaction.contact.lastName}`}</Link>
                </DetailItem>
              ) : null}
              <ValidatedForm
                id="transaction-edit"
                validator={schema}
                method="PUT"
                defaultValues={{
                  date: dayjs(transaction.date).utc().format("YYYY-MM-DD"),
                  description: transaction.description ?? "",
                  categoryId: String(transaction.categoryId),
                }}
                className="flex flex-col"
              >
                <input type="hidden" name="id" value={transaction.id} />
                <div className="items-center py-1.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-semibold capitalize">Date</dt>
                  <dd className={cn("mt-1 sm:col-span-2 sm:mt-0")}>
                    <FormField name="date" label="Date" hideLabel type="date" />
                  </dd>
                </div>
                <div className="items-center py-1.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-0">
                  <dt className="text-sm font-semibold capitalize">Category</dt>
                  <dd className={cn("mt-1 sm:col-span-2 sm:mt-0")}>
                    <FormSelect
                      hideLabel
                      required
                      name="categoryId"
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
                    <FormTextarea name="description" label="Description" hideLabel />
                  </dd>
                </div>
                <SubmitButton className="ml-auto">Save</SubmitButton>
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
            <div className="flex items-center justify-end gap-2 border-t pr-4 pt-4 text-sm font-bold">
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
      <dd className={cn("mt-1 text-sm text-muted-foreground sm:col-span-2 sm:mt-0")}>
        {value ?? null}
        {children}
      </dd>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
