import { ReimbursementRequestStatus } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import { ActionFunctionArgs, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import {
  ReimbursementRequestApprovalForm,
  reimbursementRequestApprovalSchema,
} from "~/components/forms/reimbursement-request-approval-form";
import { PageContainer } from "~/components/page-container";
import { ReceiptLink } from "~/components/reimbursements/receipt-link";
import { ReimbursementStatusBadge } from "~/components/reimbursements/reimbursement-status-badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { TransactionItemMethod, TransactionItemType } from "~/lib/constants";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { capitalize, formatCentsAsDollars } from "~/lib/utils";
import { sendReimbursementRequestUpdateEmail } from "~/services.server/mail";
import { ReimbursementRequestService } from "~/services.server/reimbursement-request";
import { SessionService } from "~/services.server/session";
import { TransactionService } from "~/services.server/transaction";

const logger = createLogger("Routes.ReimbursementShow");

export async function loader(args: ActionFunctionArgs) {
  const { params } = args;
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const rr = await ReimbursementRequestService.getById(params.reimbursementId!, orgId);

  if (!rr) {
    throw Responses.notFound();
  }

  const [relatedTrx, accounts, transactionCategories] = await db.$transaction([
    ReimbursementRequestService.getRelatedTransaction(rr.id),
    db.account.findMany({
      where: { orgId },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    }),
    TransactionService.getCategories(orgId),
  ]);

  return { reimbursementRequest: rr, accounts, transactionCategories, relatedTrx };
}

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, reimbursementRequestApprovalSchema);

  if (result.error) {
    return validationError(result.error);
  }

  const { _action, id } = result.data;

  // Reopen
  if (_action === ReimbursementRequestStatus.PENDING) {
    logger.info("Reopening reimbursement request...", { username: user.username });
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
    await sendReimbursementRequestUpdateEmail({ email: rr.user.username, status: _action });
    return Toasts.dataWithInfo(null, {
      message: "Success",
      description: "The reimbursement request has been reopened and the requester will be notified.",
    });
  }

  // Approved
  if (_action === ReimbursementRequestStatus.APPROVED) {
    logger.info("Processing reimbursement request approval...", { username: user.username });
    const { amount, categoryId, accountId, approverNote } = result.data;
    if (!accountId) {
      return validationError(
        {
          fieldErrors: {
            accountId: "Account is required for approvals",
          },
        },
        result.submittedData,
      );
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
      const account = await db.account.findUniqueOrThrow({
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

      const balance = account.transactions.reduce((acc, t) => acc + t.amountInCents, 0);
      if (balance < amount) {
        logger.warn("Insufficient funds for account", { username: user.username, code: account.code, balance, amount });
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

      return Toasts.dataWithSuccess(null, {
        message: "Success",
        description: `The reimbursement request has been approved and account ${account.code} has been adjusted.`,
      });
    } catch (error) {
      logger.error("Error updating reimbursement request", { error });
      Sentry.captureException(error);
      return Toasts.dataWithError(null, {
        message: "Error",
        description: "An unknown error occurred. Please try again later.",
      });
    }
  }

  // Rejected or Voided
  const rr = await db.reimbursementRequest.update({
    where: { id, orgId },
    data: { status: _action },
    include: { user: true },
  });
  await sendReimbursementRequestUpdateEmail({ email: rr.user.username, status: _action });
  const normalizedAction = _action === ReimbursementRequestStatus.REJECTED ? "rejected" : "voided";
  return Toasts.dataWithSuccess(null, {
    message: `Reimbursement request ${normalizedAction}`,
    description: `The reimbursement request has been ${normalizedAction} and the requester will be notified.`,
  });
}

export default function ReimbursementRequestPage() {
  const { reimbursementRequest: rr, accounts, transactionCategories, relatedTrx } = useLoaderData<typeof loader>();

  return (
    <>
      <title>{`${capitalize(rr.status)} Request`}</title>
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
                <ReimbursementStatusBadge status={rr.status} />
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
                  rr.receipts.map((receipt) => <ReceiptLink key={receipt.id} receipt={receipt} />)
                ) : (
                  <span className="text-muted-foreground">None</span>
                )}
              </dd>
            </div>
          </CardContent>

          <CardFooter>
            <ReimbursementRequestApprovalForm
              rr={rr}
              transactionCategories={transactionCategories}
              accounts={accounts}
              relatedTrx={relatedTrx}
            />
          </CardFooter>
        </Card>
      </PageContainer>
    </>
  );
}
