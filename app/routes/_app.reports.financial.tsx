import { IconCloudDownload } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Form, Link, useLoaderData, useSearchParams, type LoaderFunctionArgs } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { db } from "~/integrations/prisma.server";
import { summarizeFinancials, summaryToCsv, type FinancialSummary } from "~/lib/financial-summary";
import { handleLoaderError } from "~/lib/responses.server";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

dayjs.extend(utc);

function defaultRange() {
  // Year to date suits 990 prep; the user can widen or narrow it.
  return { start: dayjs().startOf("year").format("YYYY-MM-DD"), end: dayjs().format("YYYY-MM-DD") };
}

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const url = new URL(args.request.url);
  const fallback = defaultRange();
  // Treat a blank param as absent so it falls back to the default range.
  const param = (name: string) => {
    const value = url.searchParams.get(name);
    return value && value.trim() !== "" ? value : null;
  };
  const start = param("start") ?? fallback.start;
  const end = param("end") ?? fallback.end;

  try {
    // UTC bounds, matching how transaction dates are stored.
    const gte = dayjs.utc(start).startOf("day").toDate();
    const lte = dayjs.utc(end).endOf("day").toDate();

    const transactions = await db.transaction.findMany({
      where: { orgId, voidedAt: null, date: { gte, lte } },
      select: {
        amountInCents: true,
        accountId: true,
        account: { select: { code: true, description: true } },
        categoryId: true,
        category: { select: { name: true } },
      },
    });

    const summary = summarizeFinancials(
      transactions.map((t) => ({
        amountInCents: t.amountInCents,
        accountId: t.accountId,
        accountCode: t.account.code,
        accountDescription: t.account.description,
        categoryId: t.categoryId,
        categoryName: t.category?.name ?? null,
      })),
    );

    if (url.searchParams.get("format") === "csv") {
      const org = await db.organization.findUnique({ where: { id: orgId }, select: { name: true } });
      const filename = `${org?.name ?? "causeway"}-financial-summary-${start}-to-${end}.csv`;
      return new Response(summaryToCsv(summary, { start, end }), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\- ]/g, "")}"`,
        },
      });
    }

    return { summary, start, end, transactionCount: transactions.length };
  } catch (e) {
    handleLoaderError(e);
  }
}

export default function FinancialReportPage() {
  const { summary, start, end, transactionCount } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();

  const csvHref = `/reports/financial?${new URLSearchParams({ start, end, format: "csv" }).toString()}`;

  return (
    <>
      <title>Financial Summary</title>
      <PageHeader title="Financial Summary" description="Income and expenses by fund and category over a date range." />
      <PageContainer className="max-w-4xl">
        <Form method="get" className="mb-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="start">Start date</Label>
            <Input id="start" name="start" type="date" defaultValue={searchParams.get("start") ?? start} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end">End date</Label>
            <Input id="end" name="end" type="date" defaultValue={searchParams.get("end") ?? end} />
          </div>
          <Button type="submit" variant="outline">
            Update
          </Button>
          <Button asChild className="ml-auto">
            <Link reloadDocument to={csvHref}>
              <IconCloudDownload className="mr-2 size-4" aria-hidden="true" />
              Download CSV
            </Link>
          </Button>
        </Form>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Figure label="Income" value={formatCentsAsDollars(summary.totals.incomeInCents)} emphasis="good" />
          <Figure label="Expenses" value={formatCentsAsDollars(summary.totals.expenseInCents)} />
          <Figure
            label="Net"
            value={formatCentsAsDollars(summary.totals.netInCents)}
            emphasis={summary.totals.netInCents >= 0 ? "good" : "warning"}
          />
        </div>

        {transactionCount === 0 ? (
          <p className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No transactions between {dayjs.utc(start).format("MMM D, YYYY")} and {dayjs.utc(end).format("MMM D, YYYY")}.
          </p>
        ) : (
          <div className="space-y-8">
            <SummaryTable
              caption="By fund"
              firstHeader="Fund"
              rows={summary.byFund.map((f) => ({
                key: f.accountId,
                label: `${f.code} — ${f.description}`,
                ...f,
              }))}
              totals={summary.totals}
            />
            <SummaryTable
              caption="By category"
              firstHeader="Category"
              rows={summary.byCategory.map((c) => ({
                key: c.categoryId === null ? "none" : String(c.categoryId),
                label: c.name,
                ...c,
              }))}
              totals={summary.totals}
            />
          </div>
        )}
      </PageContainer>
    </>
  );
}

function SummaryTable({
  caption,
  firstHeader,
  rows,
  totals,
}: {
  caption: string;
  firstHeader: string;
  rows: Array<{ key: string; label: string; incomeInCents: number; expenseInCents: number; netInCents: number }>;
  totals: FinancialSummary["totals"];
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-medium">{caption}</h2>
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{firstHeader}</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expense</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="max-w-[280px] truncate">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.incomeInCents ? formatCentsAsDollars(row.incomeInCents) : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.expenseInCents ? formatCentsAsDollars(row.expenseInCents) : "—"}
                </TableCell>
                <TableCell className={cn("text-right font-medium tabular-nums", row.netInCents < 0 && "text-warning")}>
                  {formatCentsAsDollars(row.netInCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="font-medium">Total</TableCell>
              <TableCell className="text-right tabular-nums">{formatCentsAsDollars(totals.incomeInCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCentsAsDollars(totals.expenseInCents)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {formatCentsAsDollars(totals.netInCents)}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
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
