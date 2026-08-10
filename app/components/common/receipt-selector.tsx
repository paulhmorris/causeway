import { Prisma } from "@prisma/client";
import { IconPaperclip, IconSearch, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFetcher, useNavigation, useSearchParams } from "react-router";

import { FileUploader } from "~/components/common/file-uploader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useDebouncedValue } from "~/hooks/useDebouncedValue";
import { useUser } from "~/hooks/useUser";
import { OLDER_RECEIPTS_PARAM, RECEIPT_CURSOR_PARAM, RECEIPT_SEARCH_PARAM, RECEIPT_WINDOW_DAYS } from "~/lib/constants";
import { cn } from "~/lib/utils";

export type SelectableReceipt = Prisma.ReceiptGetPayload<{
  include: {
    user: { select: { contact: { select: { email: true } } } };
    reimbursementRequests: { select: { id: true } };
    transactions: { select: { id: true } };
  };
}>;

const DAYS_WEEK = 7;
const DAYS_MONTH = 30;

// A receipt already attached to a transaction or a reimbursement request can't be attached again.
// Both relations have to be checked — checking only one lets a receipt be attached twice.
function isUsed(receipt: SelectableReceipt) {
  return receipt.transactions.length > 0 || receipt.reimbursementRequests.length > 0;
}

function isToday(date: Date | string) {
  return dayjs(date).isSame(dayjs(), "day");
}

export function ReceiptSelector({
  receipts,
  receiptCount,
}: {
  receipts: Array<SelectableReceipt>;
  /** Total matching the current filters, which may exceed what the loader returned. */
  receiptCount: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Array<string>>(() =>
    receipts.filter((r) => !isUsed(r) && isToday(r.createdAt)).map((r) => r.id),
  );

  // Pages fetched past the loader's first batch. Reset whenever the loader runs again, since a new
  // search or window makes them stale.
  const [extraPages, setExtraPages] = useState<Array<SelectableReceipt>>([]);
  useEffect(() => setExtraPages([]), [receipts]);
  const allReceipts = extraPages.length > 0 ? [...receipts, ...extraPages] : receipts;

  // The loader windows and caps receipts, so a selected one can drop out of the list on
  // revalidation. Remembering everything seen keeps the summary in step with what will submit.
  const seen = useRef(new Map<string, SelectableReceipt>());
  allReceipts.forEach((r) => seen.current.set(r.id, r));

  // Uploading revalidates the loader rather than remounting this component, so newly uploaded
  // receipts have to be selected explicitly to preserve the old defaultChecked-on-today behavior.
  const knownIds = useRef(new Set(receipts.map((r) => r.id)));
  useEffect(() => {
    const added = receipts.filter((r) => !knownIds.current.has(r.id));
    receipts.forEach((r) => knownIds.current.add(r.id));
    const toSelect = added.filter((r) => !isUsed(r) && isToday(r.createdAt)).map((r) => r.id);
    if (toSelect.length > 0) {
      setSelectedIds((prev) => [...new Set([...prev, ...toSelect])]);
    }
  }, [receipts]);

  const selected = selectedIds.map((id) => seen.current.get(id)).filter((r) => r !== undefined);

  function toggle(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  }

  return (
    <div className="space-y-2">
      <FileUploader />

      {/* The gallery renders in a portal, so its checkboxes are outside the form. These hidden
          inputs are what actually submit, and they keep selections through search and filtering. */}
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="receiptIds" value={id} />
      ))}

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setIsOpen(true)} className="gap-2">
            <IconPaperclip className="size-4" />
            <span>Attach Files</span>
          </Button>
          <span className="text-muted-foreground text-sm">
            {selected.length === 0
              ? "No files attached"
              : `${selected.length} file${selected.length === 1 ? "" : "s"} attached`}
          </span>
        </div>

        {selected.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {selected.map((r) => (
              <li key={r.id} className="flex items-center gap-1.5 text-sm">
                <span className="max-w-[calc(100dvw-100px)] truncate sm:max-w-xs">{r.title}</span>
                <span className="text-muted-foreground text-xs">{dayjs(r.createdAt).format("M/D/YY h:mma")}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-5 shrink-0"
                  aria-label={`Remove ${r.title}`}
                  onClick={() => toggle(r.id)}
                >
                  <IconX className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <ReceiptGallery
        open={isOpen}
        setOpen={setIsOpen}
        receipts={allReceipts}
        receiptCount={receiptCount}
        selectedIds={selectedIds}
        onToggle={toggle}
        onLoadMore={(page) => setExtraPages((prev) => [...prev, ...page])}
      />
    </div>
  );
}

function ReceiptGallery({
  open,
  setOpen,
  receipts,
  receiptCount,
  selectedIds,
  onToggle,
  onLoadMore,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  receipts: Array<SelectableReceipt>;
  receiptCount: number;
  selectedIds: Array<string>;
  onToggle: (id: string) => void;
  onLoadMore: (page: Array<SelectableReceipt>) => void;
}) {
  const user = useUser();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<{ receipts: Array<SelectableReceipt> }>();

  // The loader owns both the date window and the search, so the gallery can reach receipts it
  // never loaded. Filtering here instead would only ever narrow a list the server already cut.
  const includesOlder = searchParams.get(OLDER_RECEIPTS_PARAM) === "true";
  const appliedSearch = searchParams.get(RECEIPT_SEARCH_PARAM) ?? "";
  const [search, setSearch] = useDebouncedValue({ minLength: 2, param: RECEIPT_SEARCH_PARAM });
  const isLoading = navigation.state === "loading";
  const isLoadingMore = fetcher.state === "loading";
  const hasMore = receipts.length < receiptCount;

  // Append each fetched page once. Comparing the payload avoids re-appending on unrelated renders.
  const appended = useRef<unknown>(null);
  useEffect(() => {
    if (fetcher.data && fetcher.data !== appended.current) {
      appended.current = fetcher.data;
      onLoadMore(fetcher.data.receipts);
    }
  }, [fetcher.data, onLoadMore]);

  function loadMore() {
    const last = receipts.at(-1);
    if (!last) return;
    const params = new URLSearchParams();
    if (includesOlder) params.set(OLDER_RECEIPTS_PARAM, "true");
    if (appliedSearch) params.set(RECEIPT_SEARCH_PARAM, appliedSearch);
    params.set(RECEIPT_CURSOR_PARAM, last.id);
    void fetcher.load(`/api/receipts?${params.toString()}`);
  }

  const cutoffWeek = useMemo(() => dayjs().subtract(DAYS_WEEK, "day"), []);
  const cutoffMonth = useMemo(() => dayjs().subtract(DAYS_MONTH, "day"), []);

  const groups = useMemo(() => {
    const thisWeek: Array<SelectableReceipt> = [];
    const thisMonth: Array<SelectableReceipt> = [];
    const older: Array<SelectableReceipt> = [];
    for (const r of receipts) {
      const created = dayjs(r.createdAt);
      if (created.isAfter(cutoffWeek)) thisWeek.push(r);
      else if (created.isAfter(cutoffMonth)) thisMonth.push(r);
      else older.push(r);
    }
    return { thisWeek, thisMonth, older };
  }, [receipts, cutoffWeek, cutoffMonth]);

  const total = groups.thisWeek.length + groups.thisMonth.length + groups.older.length;

  return (
    <DrawerDialog
      open={open}
      setOpen={setOpen}
      title="Attach Files"
      description="Select the receipts to attach. Files already attached elsewhere can't be reused."
    >
      <div className="relative">
        <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          type="search"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 text-sm"
        />
      </div>

      <div className="max-h-[50dvh] overflow-y-auto md:max-h-[45dvh]">
        {total === 0 ? (
          <p className="text-muted-foreground py-4 text-sm">
            {isLoading
              ? "Loading..."
              : appliedSearch
                ? "No files match your search."
                : includesOlder
                  ? "No files uploaded yet."
                  : `No files uploaded in the last ${RECEIPT_WINDOW_DAYS} days.`}
          </p>
        ) : (
          <div className="flex flex-col gap-y-5">
            <ReceiptGroup
              label="This Week"
              receipts={groups.thisWeek}
              selectedIds={selectedIds}
              onToggle={onToggle}
              isMember={user.isMember}
            />
            <ReceiptGroup
              label="This Month"
              receipts={groups.thisMonth}
              selectedIds={selectedIds}
              onToggle={onToggle}
              isMember={user.isMember}
            />
            <ReceiptGroup
              label="Older"
              receipts={groups.older}
              selectedIds={selectedIds}
              onToggle={onToggle}
              isMember={user.isMember}
            />
          </div>
        )}
      </div>

      {total > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">
            Showing {receipts.length} of {receiptCount} files
          </span>
          {hasMore ? (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="px-0"
              disabled={isLoadingMore}
              onClick={loadMore}
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* A search already spans the full history, so the window only needs escaping when idle. */}
      {includesOlder || appliedSearch ? null : (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="self-start px-0"
          disabled={isLoading}
          onClick={() =>
            setSearchParams(
              (prev) => {
                prev.set(OLDER_RECEIPTS_PARAM, "true");
                return prev;
              },
              { preventScrollReset: true, replace: true },
            )
          }
        >
          {isLoading ? "Loading..." : `Show files older than ${RECEIPT_WINDOW_DAYS} days`}
        </Button>
      )}

      <DrawerDialogFooter>
        <Button type="button" onClick={() => setOpen(false)}>
          Done
        </Button>
      </DrawerDialogFooter>
    </DrawerDialog>
  );
}

function ReceiptGroup({
  label,
  receipts,
  selectedIds,
  onToggle,
  isMember,
}: {
  label: string;
  receipts: Array<SelectableReceipt>;
  selectedIds: Array<string>;
  onToggle: (id: string) => void;
  isMember: boolean;
}) {
  if (receipts.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">{label}</p>
      <div className="flex flex-col gap-y-2.5">
        {receipts.map((r) => {
          const used = isUsed(r);
          return (
            <Label
              title={`${r.title} • ${used ? used : null} • ${dayjs(r.createdAt).format("M/D/YY h:mma")}${!isMember ? " " + r.user.contact.email : ""}`}
              key={r.id}
              className={cn(
                "flex w-full flex-col gap-1.5 font-normal md:grid md:grid-cols-7 md:items-center",
                used ? "cursor-not-allowed opacity-60" : "cursor-pointer",
              )}
            >
              <div className={cn("flex w-full items-center gap-1.5", isMember ? "col-span-5" : "col-span-4")}>
                <Checkbox
                  aria-label={r.title}
                  disabled={used}
                  checked={selectedIds.includes(r.id)}
                  onCheckedChange={() => onToggle(r.id)}
                />
                <span className="-my-1 max-w-[calc(100dvw-100px)] truncate py-1">{r.title}</span>
                {used ? (
                  <Badge variant="outline" className="shrink-0 text-xs">
                    Used
                  </Badge>
                ) : null}
              </div>
              <div className={cn("whitespace-nowrap md:text-right", isMember ? "col-span-2" : "col-span-3")}>
                <span className="text-muted-foreground ml-6 text-xs sm:ml-auto">
                  {dayjs(r.createdAt).format("M/D/YY h:mma")}
                </span>
                {!isMember ? <span className="text-muted-foreground text-xs"> by {r.user.contact.email}</span> : null}
              </div>
            </Label>
          );
        })}
      </div>
    </div>
  );
}
