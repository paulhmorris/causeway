import { IconFileTypeCsv, IconRefresh, IconUpload } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useMemo, useRef, useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useLoaderData,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import {
  autoDetectStatementMapping,
  linesOutsidePeriod,
  statementFields,
  statementMappingProblem,
  sumLines,
  toStatementLines,
  type StatementLine,
  type StatementMapping,
} from "~/lib/bank-statement";
import { parseCsv, parseCurrencyToCents, type ParsedCsv } from "~/lib/csv";
import { handleLoaderError } from "~/lib/responses.server";
import { UNMAPPED } from "~/lib/tithely-import";
import { Toasts } from "~/lib/toast.server";
import { cn, formatCentsAsDollars, getToday } from "~/lib/utils";
import { ReconciliationService } from "~/services.server/reconciliation";
import { SessionService } from "~/services.server/session";

dayjs.extend(utc);

const PREVIEW_ROWS = 8;
const MAX_LINES = 5000;

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    const accounts = await db.account.findMany({
      where: { orgId, isHidden: false },
      select: { id: true, code: true, description: true },
      orderBy: { code: "asc" },
    });
    return { accounts };
  } catch (e) {
    handleLoaderError(e);
  }
}

/** Signed money input — a credit card's closing balance is legitimately negative. */
const signedCurrency = z.string().transform((value, ctx) => {
  const cents = parseCurrencyToCents(value);
  if (cents === null) {
    ctx.addIssue({ code: "custom", message: "Enter an amount like 1,234.56" });
    return z.NEVER;
  }
  return cents;
});

const lineSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().nullable(),
  amountInCents: z.number().int(),
});

const schema = z.object({
  accountId: z.string().min(1, "Choose an account"),
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a statement date"),
  statementBalance: signedCurrency,
  notes: z.string().max(1000).optional(),
  lines: z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return [] as Array<StatementLine>;
      try {
        return z.array(lineSchema).max(MAX_LINES).parse(JSON.parse(raw));
      } catch {
        ctx.addIssue({ code: "custom", message: "Couldn't read the statement file. Please choose it again." });
        return z.NEVER;
      }
    }),
});

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const form = Object.fromEntries(await args.request.formData());
  const result = schema.safeParse(form);
  if (!result.success) {
    const flat = z.flattenError(result.error);
    return { fieldErrors: flat.fieldErrors };
  }

  const { accountId, statementDate, statementBalance, notes, lines } = result.data;

  try {
    const reconciliation = await ReconciliationService.create({
      accountId,
      orgId,
      statementDate: dayjs.utc(statementDate).startOf("day").toDate(),
      statementBalanceInCents: statementBalance,
      notes: notes?.trim() ? notes : undefined,
      lines,
    });

    return redirect(`/reconciliations/${reconciliation.id}`);
  } catch (error) {
    Sentry.captureException(error);
    return Toasts.dataWithError(null, {
      message: "Couldn't start the reconciliation",
      description: "Please try again or file a bug report.",
    });
  }
}

export default function NewReconciliationPage() {
  const { accounts } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const fieldErrors = actionData && "fieldErrors" in actionData ? actionData.fieldErrors : undefined;

  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<StatementMapping | null>(null);
  const [reverseSigns, setReverseSigns] = useState(false);
  const [statementDate, setStatementDate] = useState(getToday());
  const [fileError, setFileError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const mappingProblem = mapping ? statementMappingProblem(mapping) : null;

  const { lines, errors } = useMemo(() => {
    if (!parsed || !mapping || mappingProblem) return { lines: [] as Array<StatementLine>, errors: [] };
    return toStatementLines(parsed, mapping, { reverseSigns });
  }, [parsed, mapping, mappingProblem, reverseSigns]);

  const lateLines = useMemo(() => linesOutsidePeriod(lines, statementDate), [lines, statementDate]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      setFileError("Please choose a .csv file exported from your bank.");
      return;
    }

    const text = await file.text();
    const result = parseCsv(text);
    if (result.headers.length === 0 || result.rows.length === 0) {
      setFileError("That file needs a header row and at least one row of data.");
      return;
    }
    if (result.rows.length > MAX_LINES) {
      setFileError(`That file has ${result.rows.length} rows. Please split it into files of ${MAX_LINES} or fewer.`);
      return;
    }

    setFileError("");
    setFileName(file.name);
    setParsed(result);
    setMapping(autoDetectStatementMapping(result.headers));
  }

  function clearFile() {
    setParsed(null);
    setFileName("");
    setMapping(null);
    setReverseSigns(false);
    setFileError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <title>New Reconciliation</title>
      <PageHeader title="New Reconciliation" description="Check an account against its bank statement." />
      <PageContainer className="max-w-3xl">
        <Form method="post" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Statement details</CardTitle>
              <CardDescription>
                Enter the closing balance from your statement. This is all that&apos;s required — the file below is
                optional.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Account" htmlFor="accountId" error={fieldErrors?.accountId?.[0]}>
                <Select name="accountId">
                  <SelectTrigger id="accountId" aria-label="Account">
                    <SelectValue placeholder="Choose an account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} — {account.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Statement closing date" htmlFor="statementDate" error={fieldErrors?.statementDate?.[0]}>
                <Input
                  id="statementDate"
                  name="statementDate"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                />
              </Field>

              <Field
                label="Statement closing balance"
                htmlFor="statementBalance"
                error={fieldErrors?.statementBalance?.[0]}
                help="Use a minus sign for a credit card balance you owe."
              >
                <Input id="statementBalance" name="statementBalance" inputMode="decimal" placeholder="12,345.67" />
              </Field>

              <Field label="Notes" htmlFor="notes" error={fieldErrors?.notes?.[0]} optional>
                <Input id="notes" name="notes" placeholder="Anything worth remembering about this period" />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Statement file</CardTitle>
              <CardDescription>
                Optional. Attach your bank&apos;s CSV export to bring in individual lines for matching.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!parsed || !mapping ? (
                <>
                  <label
                    htmlFor="statement-csv"
                    className="border-input hover:border-primary/50 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors"
                  >
                    <IconUpload className="text-muted-foreground size-7" aria-hidden="true" />
                    <span className="text-sm font-medium">Choose a bank CSV</span>
                    <span className="text-muted-foreground text-xs">
                      Or skip this and reconcile on the balance alone
                    </span>
                    <input
                      ref={inputRef}
                      id="statement-csv"
                      type="file"
                      accept=".csv,text/csv"
                      className="sr-only"
                      onChange={(e) => void handleFile(e.target.files?.[0])}
                    />
                  </label>
                  {fileError ? (
                    <Callout variant="destructive" role="alert">
                      {fileError}
                    </Callout>
                  ) : null}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <IconFileTypeCsv className="text-primary size-5 shrink-0" aria-hidden="true" />
                      <span className="truncate text-sm font-medium">{fileName}</span>
                      <span className="text-muted-foreground shrink-0 text-sm">
                        {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <Button variant="outline" size="sm" type="button" onClick={clearFile} className="shrink-0">
                      <IconRefresh className="mr-1.5 size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {statementFields.map((field) => (
                      <div
                        key={field.key}
                        className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[200px_1fr] sm:gap-4"
                      >
                        <div>
                          <Label htmlFor={`map-${field.key}`} className="text-sm">
                            {field.label}
                            {field.required ? <span className="text-destructive ml-0.5">*</span> : null}
                          </Label>
                          {field.help ? <p className="text-muted-foreground text-xs">{field.help}</p> : null}
                        </div>
                        <Select
                          value={String(mapping[field.key])}
                          onValueChange={(value) => setMapping({ ...mapping, [field.key]: Number(value) })}
                        >
                          <SelectTrigger id={`map-${field.key}`} aria-label={field.label}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={String(UNMAPPED)}>
                              <span className="text-muted-foreground">Not mapped</span>
                            </SelectItem>
                            {parsed.headers.map((header, index) => (
                              <SelectItem key={index} value={String(index)}>
                                {header || `Column ${index + 1}`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>

                  <Label className="flex cursor-pointer items-center gap-2 font-normal">
                    <Checkbox checked={reverseSigns} onCheckedChange={(v) => setReverseSigns(v === true)} />
                    <span className="text-sm">
                      Reverse the signs
                      <span className="text-muted-foreground">
                        {" "}
                        — for credit card exports where a charge is a positive number
                      </span>
                    </span>
                  </Label>

                  {mappingProblem ? <Callout variant="warning">{mappingProblem}</Callout> : null}

                  {errors.length > 0 ? (
                    <Callout variant="warning">
                      {errors.length} row{errors.length === 1 ? "" : "s"} will be skipped — for example row{" "}
                      {errors[0].rowIndex + 2}: {errors[0].message}.
                    </Callout>
                  ) : null}

                  {lateLines.length > 0 ? (
                    <Callout variant="warning">
                      {lateLines.length} line{lateLines.length === 1 ? " is" : "s are"} dated after your closing date.
                      Check that this file covers the right period.
                    </Callout>
                  ) : null}

                  {lines.length > 0 ? <LinePreview lines={lines} /> : null}
                </>
              )}
            </CardContent>
          </Card>

          <input type="hidden" name="lines" value={lines.length > 0 ? JSON.stringify(lines) : ""} />

          <div className="flex justify-end">
            <Button type="submit">Start reconciliation</Button>
          </div>
        </Form>
      </PageContainer>
    </>
  );
}

function Field({
  label,
  htmlFor,
  error,
  help,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  help?: string;
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
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
      {error ? (
        <p className="text-destructive text-xs font-medium" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function LinePreview({ lines }: { lines: Array<StatementLine> }) {
  const total = sumLines(lines);
  const shown = lines.slice(0, PREVIEW_ROWS);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium">
          {lines.length} line{lines.length === 1 ? "" : "s"} ready
        </h3>
        <p className="text-muted-foreground text-xs">
          Net change <span className="text-foreground font-medium tabular-nums">{formatCentsAsDollars(total)}</span>
        </p>
      </div>
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
            {shown.map((line) => (
              <TableRow key={line.rowIndex}>
                <TableCell className="whitespace-nowrap tabular-nums">{line.date}</TableCell>
                <TableCell className="max-w-[320px] truncate">
                  {line.description ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell
                  className={cn("text-right tabular-nums", line.amountInCents < 0 ? "" : "text-success font-medium")}
                >
                  {formatCentsAsDollars(line.amountInCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {lines.length > shown.length ? (
        <p className="text-muted-foreground mt-2 text-xs">
          Showing the first {shown.length} of {lines.length}. All of them will be imported.
        </p>
      ) : null}
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
