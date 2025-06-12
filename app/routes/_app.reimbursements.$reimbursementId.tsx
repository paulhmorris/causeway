import { ReimbursementRequestStatus } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { IconExternalLink } from "@tabler/icons-react";
import dayjs from "dayjs";
import { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { Textarea } from "~/components/ui/textarea";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionItemMethod, TransactionItemType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { capitalize, formatCentsAsDollars } from "~/lib/utils";
import { cuid, currency, optionalLongText, optionalText, positiveNumber } from "~/schemas/fields";
import { sendReimbursementRequestUpdateEmail } from "~/services.server/mail";
import { generateS3Urls } from "~/services.server/receipt";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ReimbursementShow");

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: data ? `${capitalize(String(data.reimbursementRequest.status))} Request` : "Reimbursement Request",
  },
];

const schema = z.discriminatedUnion("_action", [
  z.object({
    _action: z.literal(ReimbursementRequestStatus.APPROVED),
    id: cuid,
    amount: currency,
    categoryId: positiveNumber,
    accountId: optionalText.nullable(),
    approverNote: optionalLongText.nullable(),
  }),
  z.object({
    _action: z.literal(ReimbursementRequestStatus.VOID),
    id: cuid,
    amount: z.never(),
    categoryId: z.never(),
    accountId: z.never(),
    approverNote: z.never(),
  }),
  z.object({
    _action: z.literal(ReimbursementRequestStatus.PENDING),
    id: cuid,
    amount: z.never(),
    categoryId: z.never(),
    accountId: z.never(),
    approverNote: z.never(),
  }),
  z.object({
    _action: z.literal(ReimbursementRequestStatus.REJECTED),
    id: cuid,
    amount: z.never(),
    categoryId: z.never(),
    accountId: z.never(),
    approverNote: z.never(),
  }),
]);

export async function loader({ request, params }: LoaderFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  invariant(params.reimbursementId, "reimbursementId not found");

  const rr = await db.reimbursementRequest.findUniqueOrThrow({
    where: { id: params.reimbursementId, orgId },
    select: {
      id: true,
      date: true,
      status: true,
      vendor: true,
      accountId: true,
      description: true,
      amountInCents: true,
      approverNote: true,
      user: {
        select: {
          username: true,
          contact: {
            select: {
              email: true,
            },
          },
        },
      },
      account: {
        select: {
          id: true,
          code: true,
          description: true,
        },
      },
      receipts: {
        select: {
          id: true,
          s3Key: true,
          s3Url: true,
          s3UrlExpiry: true,
          title: true,
        },
      },
      method: {
        select: {
          name: true,
        },
      },
    },
  });

  rr.receipts = await generateS3Urls(rr.receipts);

  const [relatedTrx, accounts, transactionCategories] = await db.$transaction([
    // In case of REOPEN, have to jump through a few hoops to get the related transaction's category to fill in the form
    db.transactionItem.findFirst({
      where: { description: `Reimbursement ID: ${rr.id}` },
      select: {
        transaction: {
          select: {
            category: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    }),
    db.account.findMany({
      where: { orgId },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    }),
    db.transactionCategory.findMany({ select: { id: true, name: true } }),
  ]);

  return { reimbursementRequest: rr, accounts, transactionCategories, relatedTrx };
}

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);

  if (result.error) {
    return validationError(result.error);
  }

  const { _action, id } = result.data;

  // Reopen
  if (_action === ReimbursementRequestStatus.PENDING) {
    const rr = await db.reimbursementRequest.update({
      where: { id, orgId },
      data: { status: ReimbursementRequestStatus.PENDING },
      select: {
        user: {
          select: {
            username: true,
          },
        },
      },
    });
    await sendReimbursementRequestUpdateEmail({
      email: rr.user.username,
      status: _action,
    });
    return Toasts.dataWithInfo(
      { reimbursementRequest: rr },
      {
        message: "The reimbursement request has been reopened and the requester will be notified.",
        description: "",
      },
    );
  }

  // Approved
  if (_action === ReimbursementRequestStatus.APPROVED) {
    const { amount, categoryId, accountId, approverNote } = result.data;
    if (!accountId) {
      return validationError({
        fieldErrors: {
          accountId: "Account is required for approvals.",
        },
      });
    }

    try {
      const rr = await db.reimbursementRequest.findUniqueOrThrow({
        where: { id, orgId },
        select: {
          id: true,
          accountId: true,
          user: {
            select: {
              username: true,
            },
          },
        },
      });

      // Verify the account has enough funds
      const account = await db.account.findUnique({
        where: { id: accountId, orgId },
        select: {
          code: true,
          transactions: {
            select: {
              amountInCents: true,
            },
          },
        },
      });

      if (!account) {
        return validationError({
          fieldErrors: {
            accountId: "Account not found.",
          },
        });
      }

      const balance = account.transactions.reduce((acc, t) => acc + t.amountInCents, 0);
      if (balance < amount) {
        return Toasts.dataWithWarning(null, {
          message: "Insufficient Funds",
          description: `The reimbursement request couldn't be completed because account ${
            account.code
          } has a balance of ${formatCentsAsDollars(balance)}.`,
        });
      }

      await db.$transaction([
        db.transaction.create({
          data: {
            orgId,
            accountId,
            categoryId,
            description: approverNote,
            amountInCents: amount * -1,
            date: dayjs().startOf("day").toDate(),
            transactionItems: {
              create: {
                orgId,
                amountInCents: amount * -1,
                methodId: TransactionItemMethod.Other,
                typeId: TransactionItemType.Other_Outgoing,
                description: `Reimbursement ID: ${rr.id}`,
              },
            },
          },
        }),
        db.reimbursementRequest.update({
          where: { id, orgId },
          data: { status: _action, approverNote },
          include: { account: true },
        }),
      ]);

      await sendReimbursementRequestUpdateEmail({
        email: rr.user.username,
        status: ReimbursementRequestStatus.APPROVED,
      });

      return Toasts.dataWithSuccess(
        { reimbursementRequest: rr },
        {
          message: "Reimbursement Request Approved",
          description: `The reimbursement request has been approved and account ${account.code} has been adjusted.`,
        },
      );
    } catch (error) {
      logger.error(error);
      Sentry.captureException(error);
      return Toasts.dataWithError(
        { message: "An unknown error occurred" },
        {
          message: "An unknown error occurred",
          description: error instanceof Error ? error.message : "",
        },
      );
    }
  }

  // Rejected or Voided
  const rr = await db.reimbursementRequest.update({
    where: { id, orgId },
    data: { status: _action },
    include: { user: true },
  });
  await sendReimbursementRequestUpdateEmail({
    email: rr.user.username,
    status: _action,
  });
  const normalizedAction = _action === ReimbursementRequestStatus.REJECTED ? "rejected" : "voided";
  return Toasts.dataWithSuccess(
    { reimbursementRequest: rr },
    {
      message: `Reimbursement request ${normalizedAction}`,
      description: `The reimbursement request has been ${normalizedAction} and the requester will be notified.`,
    },
  );
}

export default function ReimbursementRequestPage() {
  const { reimbursementRequest: rr, accounts, transactionCategories, relatedTrx } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Reimbursement Request" />
      <PageContainer className="sm:max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>New Request</CardTitle>
            <CardDescription>
              {rr.account.code}
              {rr.account.description ? ` - ${rr.account.description}` : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 items-center gap-2 text-sm">
              <dt className="font-semibold capitalize">Status</dt>
              <dd className="col-span-2">
                <Badge
                  variant={
                    rr.status === "APPROVED"
                      ? "success"
                      : rr.status === "REJECTED"
                        ? "destructive"
                        : rr.status === "VOID"
                          ? "outline"
                          : "secondary"
                  }
                >
                  {capitalize(rr.status)}
                </Badge>
              </dd>
              <dt className="font-semibold capitalize">Submitted By</dt>
              <dd className="text-muted-foreground col-span-2">{rr.user.username}</dd>

              <dt className="font-semibold capitalize">Submitted On</dt>
              <dd className="text-muted-foreground col-span-2">{dayjs(rr.date).format("M/D/YYYY h:mm a")}</dd>

              <dt className="font-semibold capitalize">Amount</dt>
              <dd className="text-muted-foreground col-span-2">{formatCentsAsDollars(rr.amountInCents)}</dd>

              <dt className="font-semibold capitalize">Method</dt>
              <dd className="text-muted-foreground col-span-2">{rr.method.name}</dd>

              {rr.vendor ? (
                <>
                  <dt className="font-semibold capitalize">Vendor</dt>
                  <dd className="text-muted-foreground col-span-2">{rr.vendor}</dd>
                </>
              ) : null}

              {rr.approverNote ? (
                <>
                  <dt className="font-semibold capitalize">Approver Notes</dt>
                  <dd className="text-muted-foreground col-span-2">{rr.approverNote}</dd>
                </>
              ) : null}

              <dt className="self-start font-semibold capitalize">Receipts</dt>
              <dd className="text-muted-foreground col-span-2">
                {rr.receipts.length > 0 ? (
                  rr.receipts.map((receipt) => {
                    if (!receipt.s3Url) {
                      return (
                        <span key={receipt.id} className="text-muted-foregrounded-none block">
                          {receipt.title} (Link missing or broken - try refreshing)
                        </span>
                      );
                    }

                    return (
                      <a
                        key={receipt.id}
                        href={receipt.s3Url}
                        className="text-primary flex items-center gap-1.5 font-medium"
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="truncate">{receipt.title}</span>
                        <IconExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
                      </a>
                    );
                  })
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </dd>
            </div>
          </CardContent>

          <CardFooter>
            <ValidatedForm
              id="reimbursement-request"
              method="post"
              schema={schema}
              className="flex w-full"
              defaultValues={{
                ...rr,
                _action: ReimbursementRequestStatus.APPROVED,
                approverNote: rr.approverNote ?? "",
                amount: String(rr.amountInCents / 100.0),
                categoryId: relatedTrx?.transaction.category?.id ?? ("" as unknown as number),
              }}
            >
              {(form) => (
                <>
                  <input type="hidden" name="id" value={rr.id} />
                  {rr.status === ReimbursementRequestStatus.PENDING ? (
                    <fieldset>
                      <legend>
                        <Callout>
                          <span>Approving this will deduct from the below account for the amount specified.</span>
                        </Callout>
                      </legend>
                      <div className="mt-4 space-y-4">
                        <div>
                          <Label className="mb-1.5">Requester Notes</Label>
                          <Textarea name="description" required readOnly defaultValue={rr.description ?? ""} />
                        </div>
                        <FormField scope={form.scope("amount")} type="number" label="Amount" isCurrency required />
                        <FormSelect
                          required
                          scope={form.scope("categoryId")}
                          label="Transaction Category"
                          placeholder="Select category"
                          options={transactionCategories.map((c) => ({
                            value: c.id,
                            label: c.name,
                          }))}
                        />
                        <FormSelect
                          scope={form.scope("accountId")}
                          label="Account to deduct from"
                          placeholder="Select account"
                          description="Required for approvals"
                          options={accounts.map((a) => ({
                            value: a.id,
                            label: `${a.code} - ${a.description}`,
                          }))}
                        />
                        <FormTextarea
                          scope={form.scope("approverNote")}
                          label="Approver Notes"
                          description="Also appears as the transaction description"
                        />
                        <Separator />
                        <div className="flex w-full flex-col gap-2 sm:flex-row-reverse sm:items-center">
                          <Button
                            name="_action"
                            value={ReimbursementRequestStatus.APPROVED}
                            className="mb-24 sm:mb-0 md:ml-auto"
                          >
                            Approve
                          </Button>
                          <Button variant="outline" name="_action" value={ReimbursementRequestStatus.VOID}>
                            Void
                          </Button>
                          <Button variant="destructive" name="_action" value={ReimbursementRequestStatus.REJECTED}>
                            Reject
                          </Button>
                        </div>
                      </div>
                    </fieldset>
                  ) : (
                    <>
                      <input type="hidden" name="amount" value={rr.amountInCents} />
                      <Button
                        name="_action"
                        value={ReimbursementRequestStatus.PENDING}
                        variant="outline"
                        className="ml-auto"
                      >
                        Reopen
                      </Button>
                    </>
                  )}
                </>
              )}
            </ValidatedForm>
          </CardFooter>
        </Card>
      </PageContainer>
    </>
  );
}
