import { IconAlertTriangle, IconCheck, IconCopy, IconFileTypeCsv, IconRefresh, IconUpload } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { Link, useFetcher, useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { db } from "~/integrations/prisma.server";
import { parseCsv, parseCurrencyToCents, type ParsedCsv } from "~/lib/csv";
import { handleLoaderError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import {
  autoDetectMapping,
  distinctFunds,
  importFields,
  missingRequiredFields,
  toImportRecords,
  UNMAPPED,
  type ColumnMapping,
  type ImportRecord,
  type RowAnalysis,
} from "~/lib/tithely-import";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { DonationImportService } from "~/services.server/donation-import";
import { SessionService } from "~/services.server/session";

const PREVIEW_ROWS = 8;
const MAX_ROWS = 5000;

/** Sentinel for "don't import rows for this fund". */
const SKIP_FUND = "";
/** Key used for records that have no fund value (or files with no fund column). */
const NO_FUND = "__none__";

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

const importRecordSchema = z.object({
  rowIndex: z.number().int().nonnegative(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amountInCents: z.number().int(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  email: z.string().nullable(),
  fund: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  note: z.string().nullable(),
});

const payloadSchema = z.object({
  records: z.array(importRecordSchema).min(1).max(MAX_ROWS),
  fundAccounts: z.record(z.string(), z.string()),
  defaultAccountId: z.string().nullable(),
  selectedRowIndexes: z.array(z.number().int().nonnegative()).default([]),
});

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const formData = await args.request.formData();
  const intent = formData.get("_action");

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(JSON.parse(String(formData.get("payload") ?? "")));
  } catch {
    return Toasts.dataWithError(null, {
      message: "Couldn't read that file",
      description: "Please choose the CSV again and retry.",
    });
  }

  const { records, fundAccounts, defaultAccountId, selectedRowIndexes } = payload;

  if (intent === "analyze") {
    const analyses = await DonationImportService.analyze({ records, fundAccounts, defaultAccountId, orgId });
    return { analyses };
  }

  if (intent === "execute") {
    try {
      const summary = await DonationImportService.execute({
        records,
        fundAccounts,
        defaultAccountId,
        selectedRowIndexes,
        orgId,
      });
      return Toasts.dataWithSuccess(
        { summary },
        {
          message: `Imported ${summary.imported} donation${summary.imported === 1 ? "" : "s"}`,
          description: summary.contactsCreated
            ? `${summary.contactsCreated} new contact${summary.contactsCreated === 1 ? " was" : "s were"} created.`
            : "No new contacts were needed.",
        },
      );
    } catch {
      return Toasts.dataWithError(null, {
        message: "Import failed",
        description: "Nothing was imported. Please try again or file a bug report.",
      });
    }
  }

  return Toasts.dataWithError(null, { message: "Unknown action" });
}

type ActionData = { analyses?: Array<RowAnalysis>; summary?: { imported: number; contactsCreated: number } } | null;

export default function TransactionsImportPage() {
  const { accounts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionData>();

  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [fundAccounts, setFundAccounts] = useState<Record<string, string>>({});
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { records, errors } = useMemo(() => {
    if (!parsed || !mapping) return { records: [] as Array<ImportRecord>, errors: [] };
    return toImportRecords(parsed, mapping);
  }, [parsed, mapping]);

  const funds = useMemo(() => distinctFunds(records), [records]);
  const hasUnfunded = useMemo(() => records.some((r) => !r.fund), [records]);

  const data = fetcher.data ?? null;
  const analyses = data?.analyses ?? null;
  const summary = data?.summary ?? null;
  const isBusy = fetcher.state !== "idle";

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
    if (!isCsv) {
      setError("Please choose a .csv file exported from Tithe.ly.");
      return;
    }

    const text = await file.text();
    const result = parseCsv(text);
    if (result.headers.length === 0 || result.rows.length === 0) {
      setError("That file needs a header row and at least one row of data.");
      return;
    }
    if (result.rows.length > MAX_ROWS) {
      setError(`That file has ${result.rows.length} rows. Please split it into files of ${MAX_ROWS} or fewer.`);
      return;
    }

    setError("");
    setFileName(file.name);
    setParsed(result);
    setMapping(autoDetectMapping(result.headers));
  }

  function reset() {
    setParsed(null);
    setFileName("");
    setMapping(null);
    setFundAccounts({});
    setExcluded(new Set());
    setError("");
    if (inputRef.current) inputRef.current.value = "";
    // Clear the previous analysis/summary so the wizard returns to step one.
    void fetcher.load(window.location.pathname);
  }

  function submit(intent: "analyze" | "execute", selectedRowIndexes: Array<number> = []) {
    void fetcher.submit(
      {
        _action: intent,
        payload: JSON.stringify({
          records,
          fundAccounts,
          defaultAccountId: fundAccounts[NO_FUND] || null,
          selectedRowIndexes,
        }),
      },
      { method: "post" },
    );
  }

  return (
    <>
      <title>Import Donations</title>
      <PageHeader
        title="Import Donations"
        description="Upload a Tithe.ly giving export and match its columns to Causeway."
      />
      <PageContainer className="max-w-3xl">
        {summary ? (
          <ResultStep summary={summary} onReset={reset} />
        ) : analyses ? (
          <PreviewStep
            analyses={analyses}
            records={records}
            excluded={excluded}
            isBusy={isBusy}
            onToggle={(rowIndex) =>
              setExcluded((prev) => {
                const next = new Set(prev);
                if (next.has(rowIndex)) next.delete(rowIndex);
                else next.add(rowIndex);
                return next;
              })
            }
            onBack={() => submit("analyze")}
            onImport={(selectedRowIndexes) => submit("execute", selectedRowIndexes)}
          />
        ) : !parsed || !mapping ? (
          <UploadStep
            error={error}
            isDragging={isDragging}
            inputRef={inputRef}
            onDragStateChange={setIsDragging}
            onFile={handleFile}
          />
        ) : (
          <MapStep
            parsed={parsed}
            mapping={mapping}
            fileName={fileName}
            accounts={accounts}
            funds={funds}
            hasUnfunded={hasUnfunded}
            fundAccounts={fundAccounts}
            recordCount={records.length}
            rowErrors={errors}
            isBusy={isBusy}
            onMappingChange={setMapping}
            onFundAccountChange={(fund, accountId) => setFundAccounts((prev) => ({ ...prev, [fund]: accountId }))}
            onReset={reset}
            onContinue={() => submit("analyze")}
          />
        )}
      </PageContainer>
    </>
  );
}

function UploadStep({
  error,
  isDragging,
  inputRef,
  onDragStateChange,
  onFile,
}: {
  error: string;
  isDragging: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onDragStateChange: (dragging: boolean) => void;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div className="space-y-4">
      <label
        htmlFor="csv"
        onDragOver={(e) => {
          e.preventDefault();
          onDragStateChange(true);
        }}
        onDragLeave={() => onDragStateChange(false)}
        onDrop={(e) => {
          e.preventDefault();
          onDragStateChange(false);
          onFile(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-input hover:border-primary/50",
        )}
      >
        <IconUpload className="text-muted-foreground size-8" />
        <span className="text-sm font-medium">Drag a CSV here, or click to choose a file</span>
        <span className="text-muted-foreground text-xs">Tithe.ly &rarr; Giving &rarr; Export</span>
        <input
          ref={inputRef}
          id="csv"
          name="csv"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>
      {error ? (
        <Callout variant="destructive" role="alert">
          {error}
        </Callout>
      ) : null}
    </div>
  );
}

type AccountOption = { id: string; code: string; description: string };

function MapStep({
  parsed,
  mapping,
  fileName,
  accounts,
  funds,
  hasUnfunded,
  fundAccounts,
  recordCount,
  rowErrors,
  isBusy,
  onMappingChange,
  onFundAccountChange,
  onReset,
  onContinue,
}: {
  parsed: ParsedCsv;
  mapping: ColumnMapping;
  fileName: string;
  accounts: Array<AccountOption>;
  funds: Array<string>;
  hasUnfunded: boolean;
  fundAccounts: Record<string, string>;
  recordCount: number;
  rowErrors: Array<{ rowIndex: number; message: string }>;
  isBusy: boolean;
  onMappingChange: (mapping: ColumnMapping) => void;
  onFundAccountChange: (fund: string, accountId: string) => void;
  onReset: () => void;
  onContinue: () => void;
}) {
  const missing = useMemo(() => missingRequiredFields(mapping), [mapping]);
  const mappedFields = useMemo(() => importFields.filter((f) => mapping[f.key] !== UNMAPPED), [mapping]);
  const previewRows = useMemo(() => parsed.rows.slice(0, PREVIEW_ROWS), [parsed.rows]);

  // Every fund in the file needs an account before the rows can be classified.
  const fundKeys = [...funds, ...(hasUnfunded || funds.length === 0 ? [NO_FUND] : [])];
  const unassignedFunds = fundKeys.filter((key) => fundAccounts[key] === undefined);
  const canContinue = missing.length === 0 && recordCount > 0 && unassignedFunds.length === 0 && !isBusy;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <IconFileTypeCsv className="text-primary size-5 shrink-0" />
          <span className="truncate text-sm font-medium">{fileName}</span>
          <span className="text-muted-foreground shrink-0 text-sm">
            {parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="shrink-0">
          <IconRefresh className="mr-1.5 size-4" />
          Choose a different file
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Match columns</CardTitle>
          <CardDescription>
            We&apos;ve guessed these from your file&apos;s headers. Adjust any that look wrong.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {importFields.map((field) => (
            <div key={field.key} className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[220px_1fr] sm:gap-4">
              <div>
                <Label htmlFor={`map-${field.key}`} className="text-sm">
                  {field.label}
                  {field.required ? <span className="text-destructive ml-0.5">*</span> : null}
                </Label>
                {field.help ? <p className="text-muted-foreground text-xs">{field.help}</p> : null}
              </div>
              <Select
                value={String(mapping[field.key])}
                onValueChange={(value) => onMappingChange({ ...mapping, [field.key]: Number(value) })}
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
        </CardContent>
      </Card>

      {missing.length > 0 ? (
        <Callout variant="warning">
          Map a column for {missing.map((f) => f.label).join(" and ")} to continue. These are needed to create a
          transaction.
        </Callout>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Choose accounts</CardTitle>
            <CardDescription>
              {funds.length > 0
                ? "Send each fund in your file to a Causeway account."
                : "Your file has no fund column, so every donation goes to one account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {fundKeys.map((key) => (
              <div key={key} className="grid grid-cols-1 items-center gap-1.5 sm:grid-cols-[220px_1fr] sm:gap-4">
                <Label htmlFor={`fund-${key}`} className="truncate text-sm">
                  {key === NO_FUND ? (funds.length > 0 ? "Rows with no fund" : "All donations") : key}
                </Label>
                <Select
                  value={fundAccounts[key] ?? undefined}
                  onValueChange={(value) => onFundAccountChange(key, value)}
                >
                  <SelectTrigger id={`fund-${key}`} aria-label={key === NO_FUND ? "Account" : `Account for ${key}`}>
                    <SelectValue placeholder="Choose an account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SKIP_FUND}>
                      <span className="text-muted-foreground">Don&apos;t import these rows</span>
                    </SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} — {account.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {rowErrors.length > 0 ? (
        <Callout variant="warning">
          {rowErrors.length} row{rowErrors.length === 1 ? "" : "s"} will be skipped because the date or amount
          couldn&apos;t be read — for example row {rowErrors[0].rowIndex + 2}: {rowErrors[0].message}.
        </Callout>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium">Preview</h2>
        <p className="text-muted-foreground mb-3 text-xs">
          The first {Math.min(PREVIEW_ROWS, parsed.rows.length)} rows, as Causeway will read them.
        </p>
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {mappedFields.map((f) => (
                  <TableHead key={f.key} className="whitespace-nowrap">
                    {f.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {previewRows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {mappedFields.map((f) => (
                    <TableCell key={f.key} className="whitespace-nowrap">
                      <PreviewCell fieldKey={f.key} value={row[mapping[f.key]] ?? ""} />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!canContinue}>
          {isBusy ? "Checking…" : `Check ${recordCount} donation${recordCount === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({
  analyses,
  records,
  excluded,
  isBusy,
  onToggle,
  onBack,
  onImport,
}: {
  analyses: Array<RowAnalysis>;
  records: Array<ImportRecord>;
  excluded: Set<number>;
  isBusy: boolean;
  onToggle: (rowIndex: number) => void;
  onBack: () => void;
  onImport: (selectedRowIndexes: Array<number>) => void;
}) {
  const recordByRow = useMemo(() => new Map(records.map((r) => [r.rowIndex, r])), [records]);

  const readyRows = analyses.filter((a) => a.status === "ready");
  const selected = readyRows.filter((a) => !excluded.has(a.rowIndex));
  const duplicates = analyses.filter((a) => a.status === "duplicate");
  const errored = analyses.filter((a) => a.status === "error");
  const newContacts = new Set(selected.filter((a) => a.willCreateContact).map((a) => a.contactLabel)).size;
  const totalCents = selected.reduce((sum, a) => sum + (recordByRow.get(a.rowIndex)?.amountInCents ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="To import" value={String(selected.length)} />
        <Stat label="Total" value={formatCentsAsDollars(totalCents)} />
        <Stat label="Already in Causeway" value={String(duplicates.length)} />
        <Stat label="New contacts" value={String(newContacts)} />
      </div>

      {duplicates.length > 0 ? (
        <Callout variant="info">
          {duplicates.length} donation{duplicates.length === 1 ? "" : "s"} already exist in Causeway (same donor, date,
          and amount) and won&apos;t be imported again.
        </Callout>
      ) : null}

      {errored.length > 0 ? (
        <Callout variant="warning">
          {errored.length} row{errored.length === 1 ? "" : "s"} can&apos;t be imported yet. Go back and choose an
          account for every fund.
        </Callout>
      ) : null}

      <div>
        <h2 className="mb-2 text-sm font-medium">Review donations</h2>
        <p className="text-muted-foreground mb-3 text-xs">
          Uncheck anything you don&apos;t want to import. Row numbers match your spreadsheet.
        </p>
        <div className="max-h-[28rem] overflow-auto rounded-md border">
          <Table>
            <TableHeader className="bg-background sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="w-14">Row</TableHead>
                <TableHead>Donor</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analyses.map((analysis) => {
                const record = recordByRow.get(analysis.rowIndex);
                const isReady = analysis.status === "ready";
                const isChecked = isReady && !excluded.has(analysis.rowIndex);
                return (
                  <TableRow key={analysis.rowIndex} className={cn(!isReady && "opacity-60")}>
                    <TableCell>
                      <Checkbox
                        checked={isChecked}
                        disabled={!isReady}
                        onCheckedChange={() => onToggle(analysis.rowIndex)}
                        aria-label={`Import row ${analysis.rowIndex + 2}`}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{analysis.rowIndex + 2}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <span className="truncate">{analysis.contactLabel}</span>
                        {analysis.willCreateContact ? (
                          <Badge variant="outline" className="shrink-0 text-xs">
                            New
                          </Badge>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{record?.date}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCentsAsDollars(record?.amountInCents ?? 0)}
                    </TableCell>
                    <TableCell>
                      <StatusCell analysis={analysis} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onBack} disabled={isBusy}>
          Back
        </Button>
        <Button onClick={() => onImport(selected.map((a) => a.rowIndex))} disabled={isBusy || selected.length === 0}>
          {isBusy ? "Importing…" : `Import ${selected.length} donation${selected.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </div>
  );
}

function StatusCell({ analysis }: { analysis: RowAnalysis }) {
  if (analysis.status === "duplicate") {
    return (
      <span className="text-muted-foreground flex items-center gap-1 text-xs">
        <IconCopy className="size-3.5 shrink-0" aria-hidden="true" />
        {analysis.message}
      </span>
    );
  }
  if (analysis.status === "error") {
    return (
      <span className="text-warning flex items-center gap-1 text-xs">
        <IconAlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
        {analysis.message}
      </span>
    );
  }
  return (
    <span className="text-success flex items-center gap-1 text-xs">
      <IconCheck className="size-3.5 shrink-0" aria-hidden="true" />
      Ready
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ResultStep({
  summary,
  onReset,
}: {
  summary: { imported: number; contactsCreated: number };
  onReset: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCheck className="text-success size-5" aria-hidden="true" />
          Import complete
        </CardTitle>
        <CardDescription>
          {summary.imported} donation{summary.imported === 1 ? "" : "s"} imported
          {summary.contactsCreated > 0
            ? `, and ${summary.contactsCreated} new contact${summary.contactsCreated === 1 ? "" : "s"} created`
            : ""}
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/transactions" prefetch="intent">
            View transactions
          </Link>
        </Button>
        <Button variant="outline" onClick={onReset}>
          Import another file
        </Button>
      </CardContent>
    </Card>
  );
}

function PreviewCell({ fieldKey, value }: { fieldKey: string; value: string }) {
  if (fieldKey === "amount" || fieldKey === "fee") {
    const cents = parseCurrencyToCents(value);
    if (cents === null) {
      return <span className="text-muted-foreground italic">{value || "—"}</span>;
    }
    return <span className="tabular-nums">{formatCentsAsDollars(cents)}</span>;
  }
  return <span>{value || <span className="text-muted-foreground">—</span>}</span>;
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
