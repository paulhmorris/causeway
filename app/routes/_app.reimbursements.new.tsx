import { Prisma, ReimbursementRequestStatus } from "@prisma/client";
import { render } from "@react-email/render";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { type MetaFunction } from "@remix-run/react";
import { withZod } from "@remix-validated-form/with-zod";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { ValidatedForm, validationError } from "remix-validated-form";
import { z } from "zod";
import { zfd } from "zod-form-data";

import { ReimbursementRequestEmail } from "emails/reimbursement-request";
import { PageHeader } from "~/components/common/page-header";
import { ReceiptSelector } from "~/components/common/receipt-selector";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Callout } from "~/components/ui/callout";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { sendEmail } from "~/integrations/email.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionItemMethod } from "~/lib/constants";
import { getPrismaErrorText } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { getToday } from "~/lib/utils";
import { CurrencySchema } from "~/models/schemas";
import { generateS3Urls } from "~/services.server/receipt";
import { SessionService } from "~/services.server/session";
import { getTransactionItemMethods } from "~/services.server/transaction";

const validator = withZod(
  z.object({
    date: z.coerce.date({ message: "Invalid date", required_error: "Date required" }),
    vendor: z.string().optional(),
    description: z.string().optional(),
    amountInCents: CurrencySchema,
    accountId: z.string().cuid("Invalid account"),
    receiptIds: zfd.repeatableOfType(z.string().cuid().optional()),
    methodId: z.coerce.number().pipe(z.nativeEnum(TransactionItemMethod, { message: "Invalid method" })),
  }),
);

export const meta: MetaFunction = () => [{ title: "New Reimbursement Request" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const [receipts, methods, accounts] = await Promise.all([
    db.receipt.findMany({
      // Admins can see all receipts, users can only see their own
      where: {
        orgId,
        userId: user.isMember ? user.id : undefined,
        reimbursementRequests: { none: {} },
      },
      include: { user: { select: { contact: { select: { email: true } } } } },
      orderBy: { createdAt: "desc" },
    }),
    getTransactionItemMethods(orgId),
    db.account.findMany({
      where: { user: user.isMember ? { id: user.id } : undefined, orgId },
      include: { type: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return typedjson({ receipts, methods, accounts });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await validator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { receiptIds, ...data } = result.data;

  try {
    const rr = await db.reimbursementRequest.create({
      data: {
        ...data,
        orgId,
        userId: user.id,
        status: ReimbursementRequestStatus.PENDING,
        receipts:
          receiptIds.length > 0
            ? {
                connect: receiptIds.map((id) => ({ id })),
              }
            : undefined,
      },
      select: {
        id: true,
        amountInCents: true,
        account: { select: { code: true } },
        user: {
          select: {
            contact: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        receipts: {
          select: {
            id: true,
            title: true,
            s3Url: true,
            s3Key: true,
            s3UrlExpiry: true,
          },
        },
        org: {
          select: {
            name: true,
            subdomain: true,
            primaryEmail: true,
          },
        },
      },
    });

    await generateS3Urls(rr.receipts);
    const { contact } = rr.user;

    await sendEmail({
      // TODO: remove exclamation after migrations
      to: rr.org.primaryEmail!,
      subject: "New Reimbursement Request",
      html: render(
        <ReimbursementRequestEmail
          url={process.env.BASE_URL}
          accountName={rr.account.code}
          amountInCents={rr.amountInCents}
          requesterName={`${contact.firstName} ${contact.lastName}`}
        />,
      ),
    });

    return Toasts.redirectWithSuccess(`/dashboards/${user.isMember ? "staff" : "admin"}`, {
      title: "Reimbursement request submitted",
      description: "Your request will be processed as soon as possible.",
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return Toasts.jsonWithError(
        { message: getPrismaErrorText(error) },
        { title: "Database Error", description: getPrismaErrorText(error) },
      );
    }
    return Toasts.jsonWithError(
      { message: "An unknown error occurred" },
      { title: "An unknown error occurred", description: error instanceof Error ? error.message : "" },
    );
  }
};

export default function NewReimbursementPage() {
  const { receipts, methods, accounts } = useTypedLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="New Reimbursement Request" />
      <PageContainer>
        <ValidatedForm id="reimbursement-form" method="post" validator={validator} className="space-y-4 sm:max-w-2xl">
          <FormField name="vendor" label="Vendor" />
          <FormTextarea
            required
            name="description"
            label="Description"
            placeholder="Leave some notes about what you purchased..."
          />
          <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <div className="w-auto">
              <FormField name="date" label="Date" type="date" defaultValue={getToday()} required />
            </div>
            <div className="w-auto min-w-[3rem]">
              <FormField name="amountInCents" label="Amount" required isCurrency />
            </div>
            <FormSelect
              required
              name="methodId"
              label="Method"
              placeholder="Select method"
              options={methods.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </div>
          <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <FormSelect
              required
              name="accountId"
              label="Account"
              placeholder="Select account"
              description="The account that will be deducted from."
              options={accounts.map((t) => ({
                value: t.id,
                label: `${t.code} - ${t.type.name}`,
              }))}
            />
          </div>
          <ReceiptSelector receipts={receipts} />
          <Callout variant="warning">
            High quality images of itemized receipts are required. Please allow two weeks for processing.
          </Callout>
          <SubmitButton>Submit</SubmitButton>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
