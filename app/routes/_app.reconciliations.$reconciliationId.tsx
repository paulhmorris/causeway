import { ReconciliationStatus } from "@prisma/client";
import { IconCheck, IconScale } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Form, Link, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { db } from "~/integrations/prisma.server";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

dayjs.extend(utc);

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const reconciliation = await db.reconciliation.findUnique({
    where: { id: args.params.reconciliationId, orgId },
    select: {
      id: true,
      statementDate: true,
      statementBalanceInCents: true,
      bookBalanceInCents: true,
      status: true,
      notes: true,
      completedAt: true,
      account: { select: { id: true, code: true, description: true } },
      lines: {
        select: { id: true, date: true, description: true, amountInCents: true },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!reconciliation) {
    throw Responses.notFound();
  }

  return { reconciliation };
}

const schema = z.object({ _action: z.enum(["complete", "reopen"]), id: z.string().min(1) });

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = schema.safeParse(Object.fromEntries(await args.request.formData()));
  if (!result.success) {
    return Toasts.dataWithError(null, { message: "Invalid request" });
  }

  const { _action, id } = result.data;
  const isComplete = _action === "complete";

  await db.reconciliation.update({
    where: { id, orgId },
    data: {
      status: isComplete ? ReconciliationStatus.COMPLETED : ReconciliationStatus.IN_PROGRESS,
      completedAt: isComplete ? new Date() : null,
    },
  });

  return Toasts.dataWithSuccess(null, {
    message: isComplete ? "Reconciliation completed" : "Reconciliation reopened",
    description: isComplete ? "This period is marked as reconciled." : "You can make changes again.",
  });
}

export default function ReconciliationDetailPage() {
  const { reconciliation: r } = useLoaderData<typeof loader>();

  const difference = r.statementBalanceInCents - r.bookBalanceInCents;
  const isBalanced = difference === 0;
  const isCompleted = r.status === ReconciliationStatus.COMPLETED;

  return (
    <>
      <title>Reconciliation</title>
      <PageHeader
        title={`${r.account.code} — ${dayjs.utc(r.statementDate).format("MMM D, YYYY")}`}
        description={r.account.description}
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/reconciliations" prefetch="intent">
              All reconciliations
            </Link>
          </Button>
          <Form method="post">
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="_action" value={isCompleted ? "reopen" : "complete"} />
            <Button type="submit" variant={isCompleted ? "outline" : "default"}>
              {isCompleted ? "Reopen" : "Mark reconciled"}
            </Button>
          </Form>
        </div>
      </PageHeader>

      <PageContainer className="max-w-3xl">
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Statement balance" value={formatCentsAsDollars(r.statementBalanceInCents)} />
          <Figure label="Causeway balance" value={formatCentsAsDollars(r.bookBalanceInCents)} />
          <Figure
            label="Difference"
            value={formatCentsAsDollars(difference)}
            emphasis={isBalanced ? "good" : "warning"}
          />
        </div>

        {isBalanced ? (
          <Callout variant="info" className="mb-6">
            <span className="flex items-center gap-2">
              <IconCheck className="size-4 shrink-0" aria-hidden="true" />
              This account matches the statement exactly.
            </span>
          </Callout>
        ) : (
          <Callout variant="warning" className="mb-6">
            Causeway is off by {formatCentsAsDollars(Math.abs(difference))} against this statement. Line-by-line
            matching arrives in a follow-up change; for now, compare the statement lines below against the
            account&apos;s transactions.
          </Callout>
        )}

        {isCompleted ? (
          <p className="text-muted-foreground mb-6 text-sm">
            Marked reconciled {r.completedAt ? dayjs(r.completedAt).format("MMM D, YYYY") : ""}.
          </p>
        ) : null}

        {r.notes ? (
          <div className="mb-6">
            <h2 className="mb-1 text-sm font-medium">Notes</h2>
            <p className="text-muted-foreground text-sm">{r.notes}</p>
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-medium">Statement lines</h2>
            <Button variant="link" className="h-auto p-0 text-xs" asChild>
              <Link to={`/accounts/${r.account.id}`} prefetch="intent">
                View account transactions
              </Link>
            </Button>
          </div>

          {r.lines.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
              <IconScale className="size-7" aria-hidden="true" />
              <p className="text-sm">
                No statement file was attached. This reconciliation compares closing balances only.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {dayjs.utc(line.date).format("M/D/YY")}
                      </TableCell>
                      <TableCell className="max-w-[360px] truncate">
                        {line.description ?? <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          line.amountInCents < 0 ? "" : "text-success font-medium",
                        )}
                      >
                        {formatCentsAsDollars(line.amountInCents)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </PageContainer>
    </>
  );
}

function Figure({ label, value, emphasis }: { label: string; value: string; emphasis?: "good" | "warning" }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          emphasis === "good" && "text-success",
          emphasis === "warning" && "text-warning",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
