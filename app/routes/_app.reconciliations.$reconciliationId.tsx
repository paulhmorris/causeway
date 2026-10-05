import { ReconciliationStatus } from "@prisma/client";
import { IconCheck, IconLink, IconScale, IconWand, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useState } from "react";
import { Form, Link, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { db } from "~/integrations/prisma.server";
import { summarizeProgress } from "~/lib/reconciliation-match";
import { Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { ReconciliationService } from "~/services.server/reconciliation";
import { SessionService } from "~/services.server/session";

dayjs.extend(utc);

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const reconciliation = await db.reconciliation.findUnique({
    where: { id: args.params.reconciliationId, orgId },
    select: {
      id: true,
      accountId: true,
      orgId: true,
      statementDate: true,
      statementBalanceInCents: true,
      bookBalanceInCents: true,
      status: true,
      notes: true,
      completedAt: true,
      account: { select: { id: true, code: true, description: true } },
      lines: {
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          date: true,
          description: true,
          amountInCents: true,
          ignoredAt: true,
          transaction: {
            select: {
              id: true,
              date: true,
              amountInCents: true,
              description: true,
              contact: { select: { firstName: true, lastName: true } },
            },
          },
        },
      },
    },
  });

  if (!reconciliation) {
    throw Responses.notFound();
  }

  const candidateTransactions = await ReconciliationService.getCandidateTransactions(reconciliation);
  const progress = summarizeProgress({
    lines: reconciliation.lines.map((l) => ({ transactionId: l.transaction?.id ?? null, ignoredAt: l.ignoredAt })),
    unmatchedTransactionCount: candidateTransactions.length,
  });

  return { reconciliation, candidateTransactions, progress };
}

const schema = z.discriminatedUnion("_action", [
  z.object({ _action: z.literal("complete") }),
  z.object({ _action: z.literal("reopen") }),
  z.object({ _action: z.literal("auto-match") }),
  z.object({ _action: z.literal("match"), lineId: z.string().min(1), transactionId: z.string().min(1) }),
  z.object({ _action: z.literal("unmatch"), lineId: z.string().min(1) }),
  z.object({ _action: z.literal("ignore"), lineId: z.string().min(1) }),
  z.object({ _action: z.literal("unignore"), lineId: z.string().min(1) }),
]);

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);
  const reconciliationId = args.params.reconciliationId!;

  const result = schema.safeParse(Object.fromEntries(await args.request.formData()));
  if (!result.success) {
    return Toasts.dataWithError(null, { message: "Invalid request" });
  }
  const data = result.data;

  try {
    switch (data._action) {
      case "complete":
      case "reopen": {
        const isComplete = data._action === "complete";
        await db.reconciliation.update({
          where: { id: reconciliationId, orgId },
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
      case "auto-match": {
        const matched = await ReconciliationService.autoMatch(reconciliationId, orgId);
        return Toasts.dataWithSuccess(null, {
          message: matched > 0 ? `Matched ${matched} line${matched === 1 ? "" : "s"}` : "No new matches",
          description:
            matched > 0
              ? "Review the matches below and resolve anything left over."
              : "Nothing matched automatically. Match the remaining lines by hand.",
        });
      }
      case "match":
        await ReconciliationService.matchLine(reconciliationId, data.lineId, data.transactionId, orgId);
        return { ok: true };
      case "unmatch":
        await ReconciliationService.unmatchLine(data.lineId, orgId);
        return { ok: true };
      case "ignore":
        await ReconciliationService.setLineIgnored(data.lineId, orgId, true);
        return { ok: true };
      case "unignore":
        await ReconciliationService.setLineIgnored(data.lineId, orgId, false);
        return { ok: true };
    }
  } catch (error) {
    return Toasts.dataWithError(null, {
      message: "Couldn't update the reconciliation",
      description: error instanceof Error ? error.message : "Please try again.",
    });
  }
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type Line = LoaderData["reconciliation"]["lines"][number];
type Candidate = LoaderData["candidateTransactions"][number];

function contactName(contact: { firstName: string | null; lastName: string | null } | null): string {
  if (!contact) return "";
  return [contact.firstName, contact.lastName].filter(Boolean).join(" ");
}

export default function ReconciliationDetailPage() {
  const { reconciliation: r, candidateTransactions, progress } = useLoaderData<typeof loader>();

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
            <input type="hidden" name="_action" value={isCompleted ? "reopen" : "complete"} />
            <Button type="submit" variant={isCompleted ? "outline" : "default"}>
              {isCompleted ? "Reopen" : "Mark reconciled"}
            </Button>
          </Form>
        </div>
      </PageHeader>

      <PageContainer className="max-w-4xl">
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Statement balance" value={formatCentsAsDollars(r.statementBalanceInCents)} />
          <Figure label="Causeway balance" value={formatCentsAsDollars(r.bookBalanceInCents)} />
          <Figure
            label="Difference"
            value={formatCentsAsDollars(difference)}
            emphasis={isBalanced ? "good" : "warning"}
          />
        </div>

        {r.lines.length === 0 ? (
          <BalanceOnlyState isBalanced={isBalanced} difference={difference} accountId={r.account.id} />
        ) : (
          <MatchingWorkspace
            lines={r.lines}
            candidateTransactions={candidateTransactions}
            progress={progress}
            isCompleted={isCompleted}
            accountId={r.account.id}
          />
        )}

        {r.notes ? (
          <div className="mt-6">
            <h2 className="mb-1 text-sm font-medium">Notes</h2>
            <p className="text-muted-foreground text-sm">{r.notes}</p>
          </div>
        ) : null}

        {isCompleted ? (
          <p className="text-muted-foreground mt-6 text-sm">
            Marked reconciled {r.completedAt ? dayjs(r.completedAt).format("MMM D, YYYY") : ""}.
          </p>
        ) : null}
      </PageContainer>
    </>
  );
}

function MatchingWorkspace({
  lines,
  candidateTransactions,
  progress,
  isCompleted,
  accountId,
}: {
  lines: Array<Line>;
  candidateTransactions: Array<Candidate>;
  progress: LoaderData["progress"];
  isCompleted: boolean;
  accountId: string;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="font-semibold tabular-nums">{progress.matchedLines}</span>
            <span className="text-muted-foreground"> matched</span>
          </span>
          <span>
            <span className="font-semibold tabular-nums">{progress.unresolvedLines}</span>
            <span className="text-muted-foreground"> to resolve</span>
          </span>
          {progress.ignoredLines > 0 ? (
            <span className="text-muted-foreground tabular-nums">{progress.ignoredLines} ignored</span>
          ) : null}
          <span className="text-muted-foreground tabular-nums">
            {progress.unmatchedTransactions} Causeway transaction{progress.unmatchedTransactions === 1 ? "" : "s"}{" "}
            unmatched
          </span>
        </div>
        {!isCompleted && progress.unresolvedLines > 0 && candidateTransactions.length > 0 ? (
          <Form method="post">
            <input type="hidden" name="_action" value="auto-match" />
            <Button type="submit" size="sm" variant="outline">
              <IconWand className="mr-1.5 size-4" aria-hidden="true" />
              Auto-match
            </Button>
          </Form>
        ) : null}
      </div>

      {progress.isFullyResolved ? (
        <Callout variant="info">
          <span className="flex items-center gap-2">
            <IconCheck className="size-4 shrink-0" aria-hidden="true" />
            Every statement line is resolved.
            {progress.unmatchedTransactions > 0
              ? ` ${progress.unmatchedTransactions} Causeway transaction${progress.unmatchedTransactions === 1 ? "" : "s"} in this period ${progress.unmatchedTransactions === 1 ? "is" : "are"} not on the statement — expected if they cleared after the closing date.`
              : ""}
          </span>
        </Callout>
      ) : null}

      <div className="space-y-2">
        {lines.map((line) => (
          <LineRow key={line.id} line={line} candidateTransactions={candidateTransactions} isCompleted={isCompleted} />
        ))}
      </div>

      <Button variant="link" className="h-auto p-0 text-xs" asChild>
        <Link to={`/accounts/${accountId}`} prefetch="intent">
          View account transactions
        </Link>
      </Button>
    </div>
  );
}

function LineRow({
  line,
  candidateTransactions,
  isCompleted,
}: {
  line: Line;
  candidateTransactions: Array<Candidate>;
  isCompleted: boolean;
}) {
  const fetcher = useFetcher();
  const [picking, setPicking] = useState(false);
  const isBusy = fetcher.state !== "idle";

  const matched = line.transaction;
  const ignored = line.ignoredAt !== null && !matched;

  // Only transactions of the same amount are offered for a manual match — a
  // reconciliation should never pair different amounts.
  const sameAmount = candidateTransactions.filter((t) => t.amountInCents === line.amountInCents);

  return (
    <div className={cn("rounded-md border p-3", matched && "border-success/40 bg-success/5", ignored && "opacity-60")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium tabular-nums">{dayjs.utc(line.date).format("M/D/YY")}</span>
            <span className="truncate text-sm">
              {line.description ?? <span className="text-muted-foreground">No description</span>}
            </span>
          </div>
          {matched ? (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Matched to {dayjs.utc(matched.date).format("M/D/YY")}
              {contactName(matched.contact) ? ` · ${contactName(matched.contact)}` : ""}
              {matched.description ? ` · ${matched.description}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("text-sm font-medium tabular-nums", line.amountInCents < 0 ? "" : "text-success")}>
            {formatCentsAsDollars(line.amountInCents)}
          </span>
          {matched ? <Badge variant="secondary">Matched</Badge> : null}
          {ignored ? <Badge variant="outline">Ignored</Badge> : null}
        </div>
      </div>

      {!isCompleted ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {matched ? (
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="unmatch" />
              <input type="hidden" name="lineId" value={line.id} />
              <Button type="submit" size="sm" variant="ghost" disabled={isBusy}>
                <IconX className="mr-1 size-3.5" aria-hidden="true" />
                Unmatch
              </Button>
            </fetcher.Form>
          ) : ignored ? (
            <fetcher.Form method="post">
              <input type="hidden" name="_action" value="unignore" />
              <input type="hidden" name="lineId" value={line.id} />
              <Button type="submit" size="sm" variant="ghost" disabled={isBusy}>
                Un-ignore
              </Button>
            </fetcher.Form>
          ) : picking ? (
            <fetcher.Form method="post" className="flex items-center gap-2">
              <input type="hidden" name="_action" value="match" />
              <input type="hidden" name="lineId" value={line.id} />
              <Select name="transactionId" required>
                <SelectTrigger className="h-8 w-auto min-w-[220px] text-xs" aria-label="Choose a transaction to match">
                  <SelectValue placeholder="Choose a transaction" />
                </SelectTrigger>
                <SelectContent>
                  {sameAmount.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {dayjs.utc(t.date).format("M/D/YY")}
                      {contactName(t.contact) ? ` · ${contactName(t.contact)}` : ""}
                      {t.description ? ` · ${t.description}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" size="sm" disabled={isBusy}>
                Match
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPicking(false)}>
                Cancel
              </Button>
            </fetcher.Form>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={sameAmount.length === 0}
                onClick={() => setPicking(true)}
              >
                <IconLink className="mr-1 size-3.5" aria-hidden="true" />
                {sameAmount.length > 0 ? "Match manually" : "No matching amount"}
              </Button>
              <fetcher.Form method="post">
                <input type="hidden" name="_action" value="ignore" />
                <input type="hidden" name="lineId" value={line.id} />
                <Button type="submit" size="sm" variant="ghost" disabled={isBusy}>
                  Ignore
                </Button>
              </fetcher.Form>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function BalanceOnlyState({
  isBalanced,
  difference,
  accountId,
}: {
  isBalanced: boolean;
  difference: number;
  accountId: string;
}) {
  return (
    <div className="space-y-4">
      {isBalanced ? (
        <Callout variant="info">
          <span className="flex items-center gap-2">
            <IconCheck className="size-4 shrink-0" aria-hidden="true" />
            This account matches the statement exactly.
          </span>
        </Callout>
      ) : (
        <Callout variant="warning">
          Causeway is off by {formatCentsAsDollars(Math.abs(difference))} against this statement. Attach a statement
          file when creating a reconciliation to match line by line.
        </Callout>
      )}
      <div className="text-muted-foreground flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
        <IconScale className="size-7" aria-hidden="true" />
        <p className="text-sm">No statement file was attached. This reconciliation compares closing balances only.</p>
      </div>
      <Button variant="link" className="h-auto p-0 text-xs" asChild>
        <Link to={`/accounts/${accountId}`} prefetch="intent">
          View account transactions
        </Link>
      </Button>
    </div>
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
