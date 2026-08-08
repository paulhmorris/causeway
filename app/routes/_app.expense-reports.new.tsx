import { render } from "@react-email/render";
import { IconCamera, IconPaperclip, IconPlus, IconTrash } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { Form, useActionData, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { ReimbursementRequestEmail } from "emails/reimbursement-request";
import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { useReceiptScan } from "~/hooks/useReceiptScan";
import { Mailer } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { CONFIG } from "~/lib/env.server";
import {
  isSubmittable,
  lineProblems,
  reportTotalInCents,
  subtotalsByAccount,
  type ExpenseLine,
} from "~/lib/expense-report";
import type { ParsedReceipt } from "~/lib/receipt-ocr";
import { Toasts } from "~/lib/toast.server";
import { formatCentsAsDollars, getToday } from "~/lib/utils";
import { ExpenseReportService } from "~/services.server/expense-report";
import { SessionService } from "~/services.server/session";
import { TransactionService } from "~/services.server/transaction";

const logger = createLogger("Routes.ExpenseReportsNew");

const MAX_LINES = 100;

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const [accounts, methods, receipts] = await db.$transaction([
    db.account.findMany({
      where: { orgId, user: user.isMember ? { id: user.id } : undefined },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    }),
    TransactionService.getItemMethods(orgId),
    db.receipt.findMany({
      where: { orgId, userId: user.isMember ? user.id : undefined },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { accounts, methods, receipts };
}

const lineSchema = z.object({
  key: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  vendor: z.string().max(255),
  description: z.string().max(1000),
  amountInCents: z.number().int().positive(),
  accountId: z.string().min(1),
  methodId: z.number().int(),
  receiptIds: z.array(z.string()),
});

const payloadSchema = z.object({ lines: z.array(lineSchema).min(1).max(MAX_LINES) });

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  let lines: Array<ExpenseLine>;
  try {
    const raw = (await args.request.formData()).get("payload");
    lines = payloadSchema.parse(JSON.parse(typeof raw === "string" ? raw : "")).lines;
  } catch {
    return { error: "Your report couldn't be read. Please review the lines and try again." };
  }

  try {
    const summary = await ExpenseReportService.submit({ lines, userId: user.id, orgId });

    // One summary email to the org, rather than one per line.
    const org = await db.organization.findUnique({ where: { id: orgId }, select: { primaryEmail: true } });
    if (org?.primaryEmail) {
      await Mailer.send({
        to: org.primaryEmail,
        subject: "New Expense Report",
        html: await render(
          <ReimbursementRequestEmail
            url={CONFIG.baseUrl}
            accountName={`${summary.created}-line expense report`}
            amountInCents={summary.totalInCents}
            requesterName={`${user.contact.firstName ?? ""} ${user.contact.lastName ?? ""}`.trim() || user.username}
          />,
        ),
      });
    }

    return Toasts.redirectWithSuccess(`/dashboards/${user.isMember ? "staff" : "admin"}`, {
      message: `Expense report submitted`,
      description: `${summary.created} line${summary.created === 1 ? "" : "s"} totaling ${formatCentsAsDollars(summary.totalInCents)} sent for review.`,
    });
  } catch (error) {
    logger.error("Error submitting expense report", { error });
    Sentry.captureException(error);
    return { error: error instanceof Error ? error.message : "An unknown error occurred." };
  }
}

type LoaderData = Awaited<ReturnType<typeof loader>>;

function newLine(): ExpenseLine {
  return {
    key: crypto.randomUUID(),
    date: getToday(),
    vendor: "",
    description: "",
    amountInCents: 0,
    accountId: "",
    methodId: null,
    receiptIds: [],
  };
}

/** A line pre-filled from a scanned receipt. Account and method still need to be
 * chosen — OCR can't know which fund an expense belongs to. */
function lineFromReceipt(parsed: ParsedReceipt): ExpenseLine {
  return {
    ...newLine(),
    date: parsed.date ?? getToday(),
    vendor: parsed.vendor ?? "",
    amountInCents: parsed.amountInCents ?? 0,
  };
}

export default function NewExpenseReportPage() {
  const { accounts, methods, receipts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const serverError = actionData && "error" in actionData ? actionData.error : undefined;

  const [lines, setLines] = useState<Array<ExpenseLine>>([newLine()]);
  const scan = useReceiptScan();
  const scanInputRef = useRef<HTMLInputElement>(null);

  function updateLine(key: string, patch: Partial<ExpenseLine>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }
  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  async function handleScanFile(file: File | undefined) {
    if (!file) return;
    const parsed = await scan.scan(file);
    if (parsed) {
      // Replace a single untouched starter line; otherwise append.
      setLines((prev) => {
        const line = lineFromReceipt(parsed);
        const onlyBlankStarter = prev.length === 1 && prev[0].amountInCents === 0 && prev[0].accountId === "";
        return onlyBlankStarter ? [line] : [...prev, line];
      });
    }
    if (scanInputRef.current) scanInputRef.current.value = "";
  }

  const total = reportTotalInCents(lines);
  const subtotals = subtotalsByAccount(lines);
  const canSubmit = isSubmittable(lines);
  const accountLabel = (id: string) => {
    const account = accounts.find((a) => a.id === id);
    return account ? `${account.code} — ${account.description}` : id;
  };

  return (
    <>
      <title>New Expense Report</title>
      <PageHeader
        title="New Expense Report"
        description="Itemize several expenses and submit them for reimbursement in one report."
      />
      <PageContainer className="max-w-3xl">
        <Form method="post" className="space-y-6">
          {serverError ? (
            <Callout variant="destructive" role="alert">
              {serverError}
            </Callout>
          ) : null}

          <ol className="space-y-3">
            {lines.map((line, index) => (
              <li key={line.key}>
                <ExpenseLineCard
                  line={line}
                  index={index}
                  accounts={accounts}
                  methods={methods}
                  receipts={receipts}
                  canRemove={lines.length > 1}
                  onChange={(patch) => updateLine(line.key, patch)}
                  onRemove={() => removeLine(line.key)}
                />
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setLines((prev) => [...prev, newLine()])}>
              <IconPlus className="mr-2 size-4" aria-hidden="true" />
              Add expense
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={scan.status === "scanning"}
              onClick={() => scanInputRef.current?.click()}
            >
              <IconCamera className="mr-2 size-4" aria-hidden="true" />
              {scan.status === "scanning" ? `Reading receipt… ${Math.round(scan.progress * 100)}%` : "Scan a receipt"}
            </Button>
            <input
              ref={scanInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => void handleScanFile(e.target.files?.[0])}
            />
            {scan.status === "error" && scan.error ? (
              <span className="text-destructive text-xs">{scan.error}</span>
            ) : scan.status === "done" ? (
              <span className="text-muted-foreground text-xs">
                Added a line from your receipt — check the amount and pick an account.
              </span>
            ) : null}
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Report total</span>
              <span className="text-lg font-semibold tabular-nums">{formatCentsAsDollars(total)}</span>
            </div>
            {subtotals.length > 1 ? (
              <dl className="mt-3 space-y-1 border-t pt-3">
                {subtotals.map((s) => (
                  <div key={s.accountId} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground truncate">
                      {accountLabel(s.accountId)}
                      <span className="ml-1">
                        ({s.count} line{s.count === 1 ? "" : "s"})
                      </span>
                    </dt>
                    <dd className="tabular-nums">{formatCentsAsDollars(s.totalInCents)}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>

          <input type="hidden" name="payload" value={JSON.stringify({ lines })} />

          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              Submit report
            </Button>
          </div>
        </Form>
      </PageContainer>
    </>
  );
}

function ExpenseLineCard({
  line,
  index,
  accounts,
  methods,
  receipts,
  canRemove,
  onChange,
  onRemove,
}: {
  line: ExpenseLine;
  index: number;
  accounts: LoaderData["accounts"];
  methods: LoaderData["methods"];
  receipts: LoaderData["receipts"];
  canRemove: boolean;
  onChange: (patch: Partial<ExpenseLine>) => void;
  onRemove: () => void;
}) {
  // Show validation only once a line has been touched, so a fresh line isn't red.
  const touched = line.amountInCents > 0 || line.accountId !== "" || line.vendor !== "" || line.description !== "";
  const problems = touched ? lineProblems(line) : [];

  const [amountText, setAmountText] = useState(line.amountInCents > 0 ? (line.amountInCents / 100).toString() : "");

  function commitAmount(value: string) {
    setAmountText(value);
    const dollars = Number(value.replace(/[$,\s]/g, ""));
    onChange({ amountInCents: Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : 0 });
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Expense {index + 1}
          </span>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              aria-label={`Remove expense ${index + 1}`}
            >
              <IconTrash className="size-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Date" htmlFor={`date-${line.key}`}>
            <Input
              id={`date-${line.key}`}
              type="date"
              value={line.date}
              onChange={(e) => onChange({ date: e.target.value })}
            />
          </Field>
          <Field label="Amount" htmlFor={`amount-${line.key}`}>
            <Input
              id={`amount-${line.key}`}
              inputMode="decimal"
              placeholder="0.00"
              value={amountText}
              onChange={(e) => commitAmount(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Account" htmlFor={`account-${line.key}`}>
            <Select value={line.accountId} onValueChange={(v) => onChange({ accountId: v })}>
              <SelectTrigger id={`account-${line.key}`} aria-label="Account">
                <SelectValue placeholder="Choose an account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.code} — {a.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Payment method" htmlFor={`method-${line.key}`}>
            <Select
              value={line.methodId !== null ? String(line.methodId) : undefined}
              onValueChange={(v) => onChange({ methodId: Number(v) })}
            >
              <SelectTrigger id={`method-${line.key}`} aria-label="Payment method">
                <SelectValue placeholder="Choose a method" />
              </SelectTrigger>
              <SelectContent>
                {methods.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Vendor" htmlFor={`vendor-${line.key}`} optional>
          <Input
            id={`vendor-${line.key}`}
            value={line.vendor}
            placeholder="Where the expense was incurred"
            onChange={(e) => onChange({ vendor: e.target.value })}
          />
        </Field>

        <Field label="Note" htmlFor={`note-${line.key}`} optional>
          <Textarea
            id={`note-${line.key}`}
            rows={2}
            value={line.description}
            placeholder="What this expense was for"
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </Field>

        <ReceiptPicker
          receipts={receipts}
          selected={line.receiptIds}
          onChange={(receiptIds) => onChange({ receiptIds })}
        />

        {problems.length > 0 ? <p className="text-destructive text-xs font-medium">{problems.join(" · ")}</p> : null}
      </CardContent>
    </Card>
  );
}

function ReceiptPicker({
  receipts,
  selected,
  onChange,
}: {
  receipts: LoaderData["receipts"];
  selected: Array<string>;
  onChange: (ids: Array<string>) => void;
}) {
  if (receipts.length === 0) {
    return <p className="text-muted-foreground text-xs">No uploaded receipts to attach.</p>;
  }

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((r) => r !== id) : [...selected, id]);
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <IconPaperclip className="mr-2 size-4" aria-hidden="true" />
          {selected.length > 0
            ? `${selected.length} receipt${selected.length === 1 ? "" : "s"} attached`
            : "Attach receipts"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-72 w-80 overflow-auto">
        <div className="space-y-1">
          {receipts.map((r) => (
            <Label
              key={r.id}
              className="hover:bg-muted flex cursor-pointer items-center gap-2 rounded p-1.5 font-normal"
            >
              <Checkbox checked={selected.includes(r.id)} onCheckedChange={() => toggle(r.id)} />
              <span className="truncate text-sm">{r.title}</span>
            </Label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {optional ? <span className="text-muted-foreground ml-1 text-xs">(optional)</span> : null}
      </Label>
      {children}
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
