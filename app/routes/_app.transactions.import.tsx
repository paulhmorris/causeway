import { IconFileTypeCsv, IconRefresh, IconUpload } from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import type { LoaderFunctionArgs } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { parseCsv, parseCurrencyToCents, type ParsedCsv } from "~/lib/csv";
import {
  autoDetectMapping,
  importFields,
  missingRequiredFields,
  UNMAPPED,
  type ColumnMapping,
} from "~/lib/tithely-import";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

const PREVIEW_ROWS = 8;

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  return null;
}

export default function TransactionsImportPage() {
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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

    setError("");
    setFileName(file.name);
    setParsed(result);
    setMapping(autoDetectMapping(result.headers));
  }

  function reset() {
    setParsed(null);
    setFileName("");
    setMapping(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <title>Import Donations</title>
      <PageHeader title="Import Donations" description="Upload a Tithe.ly giving export and match its columns to Causeway." />
      <PageContainer className="max-w-3xl">
        {!parsed || !mapping ? (
          <UploadStep
            error={error}
            isDragging={isDragging}
            inputRef={inputRef}
            onDragStateChange={setIsDragging}
            onFile={handleFile}
          />
        ) : (
          <MapStep parsed={parsed} mapping={mapping} fileName={fileName} onMappingChange={setMapping} onReset={reset} />
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

function MapStep({
  parsed,
  mapping,
  fileName,
  onMappingChange,
  onReset,
}: {
  parsed: ParsedCsv;
  mapping: ColumnMapping;
  fileName: string;
  onMappingChange: (mapping: ColumnMapping) => void;
  onReset: () => void;
}) {
  const missing = useMemo(() => missingRequiredFields(mapping), [mapping]);
  const mappedFields = useMemo(() => importFields.filter((f) => mapping[f.key] !== UNMAPPED), [mapping]);
  const previewRows = useMemo(() => parsed.rows.slice(0, PREVIEW_ROWS), [parsed.rows]);

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
    </div>
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
