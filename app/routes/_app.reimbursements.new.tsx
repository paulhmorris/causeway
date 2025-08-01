import { ReimbursementRequestStatus } from "@prisma/client";
import { render } from "@react-email/render";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { z } from "zod/v4";

import { ReimbursementRequestEmail } from "emails/reimbursement-request";
import { PageHeader } from "~/components/common/page-header";
import { ReceiptSelector } from "~/components/common/receipt-selector";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Callout } from "~/components/ui/callout";
import { FormField, FormSelect, FormTextarea, GenericFieldError } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Mailer } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionItemMethod } from "~/lib/constants";
import { CONFIG } from "~/lib/env.server";
import { Toasts } from "~/lib/toast.server";
import { checkboxGroup, cuid, currency, date, number, optionalLongText, optionalText } from "~/schemas/fields";
import { generateS3Urls } from "~/services.server/receipt";
import { SessionService } from "~/services.server/session";
import { TransactionService } from "~/services.server/transaction";

const logger = createLogger("Routes.ReimbursementsNew");

const schema = z.object({
  date: date,
  vendor: optionalText,
  description: optionalLongText,
  amountInCents: currency,
  accountId: cuid,
  receiptIds: checkboxGroup,
  methodId: number.pipe(z.enum(TransactionItemMethod, { message: "Invalid method" })),
});

export const loader = async (args: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const [receipts, methods, accounts] = await db.$transaction([
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
    TransactionService.getItemMethods(orgId),
    db.account.findMany({
      where: { user: user.isMember ? { id: user.id } : undefined, orgId },
      include: { type: true },
      orderBy: { code: "asc" },
    }),
  ]);
  return { receipts, methods, accounts };
};

export const action = async (args: ActionFunctionArgs) => {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
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
            primaryEmail: true,
          },
        },
      },
    });

    await generateS3Urls(rr.receipts);
    const { contact } = rr.user;

    await Mailer.send({
      // TODO: remove exclamation after migrations
      to: rr.org.primaryEmail!,
      subject: "New Reimbursement Request",
      html: await render(
        <ReimbursementRequestEmail
          url={CONFIG.baseUrl}
          accountName={rr.account.code}
          amountInCents={rr.amountInCents}
          requesterName={`${contact.firstName} ${contact.lastName}`}
        />,
      ),
    });

    return Toasts.redirectWithSuccess(`/dashboards/${user.isMember ? "staff" : "admin"}`, {
      message: "Reimbursement request submitted",
      description: "Your request will be processed as soon as possible.",
    });
  } catch (error) {
    logger.error("Error creating reimbursement request", { error });
    Sentry.captureException(error);
    return Toasts.dataWithError(null, { message: "An unknown error occurred" }, { status: 500 });
  }
};

export default function NewReimbursementPage() {
  const { receipts, methods, accounts } = useLoaderData<typeof loader>();

  return (
    <>
      <title>New Reimbursement Request</title>
      <PageHeader title="New Reimbursement Request" />
      <PageContainer>
        <ValidatedForm
          noValidate
          method="post"
          defaultValues={{
            vendor: "",
            methodId: "",
            description: "",
            date: dayjs().format("YYYY-MM-DD"),
            amountInCents: "",
            accountId: "",
            receiptIds: [],
          }}
          schema={schema}
          className="space-y-4 sm:max-w-2xl"
        >
          {(form) => (
            <>
              <FormField scope={form.scope("vendor")} label="Vendor" />
              <FormTextarea
                required
                scope={form.scope("description")}
                label="Description"
                placeholder="Leave some notes about what you purchased..."
              />
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <div className="w-auto">
                  <FormField scope={form.scope("date")} label="Date" type="date" required />
                </div>
                <div className="w-auto min-w-12">
                  <FormField scope={form.scope("amountInCents")} label="Amount" required isCurrency />
                </div>
                <FormSelect
                  required
                  scope={form.scope("methodId")}
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
                  scope={form.scope("accountId")}
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
              <GenericFieldError error={form.error("receiptIds")} />
              <Callout variant="warning">
                High quality images of itemized receipts are required. Please allow two weeks for processing.
              </Callout>
              <SubmitButton isSubmitting={form.formState.isSubmitting}>Submit</SubmitButton>
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
