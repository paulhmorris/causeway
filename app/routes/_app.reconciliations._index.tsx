import { ReconciliationStatus } from "@prisma/client";
import { IconPlus, IconScale } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Link, useLoaderData, type LoaderFunctionArgs } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { db } from "~/integrations/prisma.server";
import { handleLoaderError } from "~/lib/responses.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

dayjs.extend(utc);

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    const reconciliations = await db.reconciliation.findMany({
      where: { orgId },
      select: {
        id: true,
        statementDate: true,
        statementBalanceInCents: true,
        bookBalanceInCents: true,
        status: true,
        account: { select: { code: true, description: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ statementDate: "desc" }, { createdAt: "desc" }],
    });

    return { reconciliations };
  } catch (e) {
    handleLoaderError(e);
  }
}

export default function ReconciliationsIndexPage() {
  const { reconciliations } = useLoaderData<typeof loader>();

  return (
    <>
      <title>Reconciliations</title>
      <PageHeader title="Reconciliations" description="Compare each account against its bank statement.">
        <Button asChild>
          <Link to="/reconciliations/new" prefetch="intent">
            <IconPlus className="mr-2 size-5" />
            <span>New Reconciliation</span>
          </Link>
        </Button>
      </PageHeader>

      <PageContainer>
        {reconciliations.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
            <IconScale className="size-8" aria-hidden="true" />
            <div>
              <p className="text-foreground text-sm font-medium">No reconciliations yet</p>
              <p className="text-sm">Start one at the end of a statement period to check Causeway against your bank.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Statement date</TableHead>
                  <TableHead className="text-right">Statement</TableHead>
                  <TableHead className="text-right">Causeway</TableHead>
                  <TableHead className="text-right">Difference</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reconciliations.map((r) => {
                  const difference = r.statementBalanceInCents - r.bookBalanceInCents;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap">
                        <span className="font-medium">{r.account.code}</span>
                        <span className="text-muted-foreground ml-2">{r.account.description}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {dayjs.utc(r.statementDate).format("MMM D, YYYY")}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentsAsDollars(r.statementBalanceInCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCentsAsDollars(r.bookBalanceInCents)}
                      </TableCell>
                      <TableCell
                        className={cn("text-right font-medium tabular-nums", difference !== 0 && "text-warning")}
                      >
                        {formatCentsAsDollars(difference)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={difference === 0 ? "secondary" : "outline"}>
                          {r.status === ReconciliationStatus.COMPLETED
                            ? "Completed"
                            : difference === 0
                              ? "Balanced"
                              : "Needs review"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
