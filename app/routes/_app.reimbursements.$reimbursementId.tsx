import { ReimbursementRequestStatus } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import { ActionFunctionArgs, Link, useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import {
  ReimbursementRequestApprovalForm,
  reimbursementRequestApprovalSchema,
} from "~/components/forms/reimbursement-request-approval-form";
import { PageContainer } from "~/components/page-container";
import { ReceiptLink } from "~/components/reimbursements/receipt-link";
import { ReimbursementStatusBadge } from "~/components/reimbursements/reimbursement-status-badge";
import { Button } from "~/components/ui/button";
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

  const [linkedTrx, accounts, transactionCategories] = await db.$transaction([
    ReimbursementRequestService.getLinkedTransaction(rr.id),
    db.account.findMany({
      where: { orgId },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    }),
    TransactionService.getCategories(orgId),
  ]);

  return { reimbursementRequest: rr, accounts, transactionCategories, linkedTrx };
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
    // Clear voidedAt on the linked transaction if it exists
    await db.transaction.updateMany({
      where: { reimbursementId: id },
      data: { voidedAt: null },
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

      // Verify the account has enough funds (exclude voided transactions)
      const account = await db.account.findUniqueOrThrow({
        where: { id: accountId, orgId },
        select: {
          code: true,
          transactions: {
            where: { voidedAt: null },
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

      // Upsert the linked transaction
      const existingTrx = await db.transaction.findUnique({ where: { reimbursementId: id } });
      await db.$transaction([
        existingTrx
          ? db.transaction.update({
              where: { reimbursementId: id },
              data: {
                accountId,
                categoryId,
                description: approverNote,
                amountInCents: amount * -1,
                voidedAt: null,
              },
            })
          : db.transaction.create({
              data: {
                orgId,
                accountId,
                categoryId,
                description: approverNote,
                amountInCents: amount * -1,
                date: dayjs().startOf("day").toDate(),
                reimbursementId: id,
                transactionItems: {
                  create: {
                    orgId,
                    amountInCents: amount * -1,
                    methodId: TransactionItemMethod.Other,
                    typeId: TransactionItemType.Other_Outgoing,
                    description: `Reimbursement: ${rr.id}`,
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

  // Voided — also void the linked transaction atomically
  if (_action === ReimbursementRequestStatus.VOID) {
    const rr = await db.reimbursementRequest.update({
      where: { id, orgId },
      data: { status: _action },
      include: { user: true },
    });
    await db.transaction.updateMany({
      where: { reimbursementId: id },
      data: { voidedAt: new Date() },
    });
    await sendReimbursementRequestUpdateEmail({ email: rr.user.username, status: _action });
    return Toasts.dataWithSuccess(null, {
      message: "Reimbursement request voided",
      description: "The reimbursement request has been voided and the requester will be notified.",
    });
  }

  // Rejected
  const rr = await db.reimbursementRequest.update({
    where: { id, orgId },
    data: { status: _action },
    include: { user: true },
  });
  await sendReimbursementRequestUpdateEmail({ email: rr.user.username, status: _action });
  return Toasts.dataWithSuccess(null, {
    message: "Reimbursement request rejected",
    description: "The reimbursement request has been rejected and the requester will be notified.",
  });
}

export default function ReimbursementRequestPage() {
  const { reimbursementRequest: rr, accounts, transactionCategories, linkedTrx } = useLoaderData<typeof loader>();

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

              {linkedTrx ? (
                <>
                  <dt className="font-semibold capitalize">Transaction</dt>
                  <dd className="col-span-2">
                    <Button variant="link" className="h-auto p-0" asChild>
                      <Link to={`/transactions/${linkedTrx.id}`} prefetch="intent">
                        View Transaction
                      </Link>
                    </Button>
                  </dd>
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
              linkedTrx={linkedTrx}
            />
          </CardFooter>
        </Card>
      </PageContainer>
    </>
  );
}
