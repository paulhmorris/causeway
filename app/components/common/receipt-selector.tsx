import { Prisma } from "@prisma/client";
import { IconPaperclip, IconReceipt2, IconSearch, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";

import { FileUploader } from "~/components/common/file-uploader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useUser } from "~/hooks/useUser";
import { cn } from "~/lib/utils";

export type SelectableReceipt = Prisma.ReceiptGetPayload<{
  include: {
    user: { select: { contact: { select: { email: true } } } };
    reimbursementRequests: { select: { id: true } };
    transactions: { select: { id: true } };
  };
}>;

// Receipts are no longer filtered down to the unused ones, so the query is bounded instead.
// The gallery searches within this window; older files stay reachable from the receipts list.
export const RECEIPT_SELECTOR_LIMIT = 200;

const DAYS_RECENT = 90;
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

export function ReceiptSelector({ receipts }: { receipts: Array<SelectableReceipt> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Array<string>>(() =>
    receipts.filter((r) => !isUsed(r) && isToday(r.createdAt)).map((r) => r.id),
  );

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

  const selected = useMemo(
    () => selectedIds.map((id) => receipts.find((r) => r.id === id)).filter((r) => r !== undefined),
    [selectedIds, receipts],
  );

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

      {receipts.length === 0 ? (
        <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
          <IconReceipt2 className="size-5" />
          <p>Upload receipts to get started.</p>
        </div>
      ) : (
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
      )}

      <ReceiptGallery
        open={isOpen}
        setOpen={setIsOpen}
        receipts={receipts}
        selectedIds={selectedIds}
        onToggle={toggle}
      />
    </div>
  );
}

function ReceiptGallery({
  open,
  setOpen,
  receipts,
  selectedIds,
  onToggle,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  receipts: Array<SelectableReceipt>;
  selectedIds: Array<string>;
  onToggle: (id: string) => void;
}) {
  const user = useUser();
  const [search, setSearch] = useState("");
  const [showOlder, setShowOlder] = useState(false);

  const cutoffRecent = useMemo(() => dayjs().subtract(DAYS_RECENT, "day"), []);
  const cutoffWeek = useMemo(() => dayjs().subtract(DAYS_WEEK, "day"), []);
  const cutoffMonth = useMemo(() => dayjs().subtract(DAYS_MONTH, "day"), []);

  const hasOlder = receipts.some((r) => dayjs(r.createdAt).isBefore(cutoffRecent));

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const visible = receipts.filter((r) => {
      if (query && !r.title.toLowerCase().includes(query)) return false;
      // Keep a selected receipt visible even when it falls outside the date window, so it can be removed.
      if (!showOlder && dayjs(r.createdAt).isBefore(cutoffRecent)) return selectedIds.includes(r.id);
      return true;
    });

    const thisWeek: Array<SelectableReceipt> = [];
    const thisMonth: Array<SelectableReceipt> = [];
    const older: Array<SelectableReceipt> = [];
    for (const r of visible) {
      const created = dayjs(r.createdAt);
      if (created.isAfter(cutoffWeek)) thisWeek.push(r);
      else if (created.isAfter(cutoffMonth)) thisMonth.push(r);
      else older.push(r);
    }
    return { thisWeek, thisMonth, older };
  }, [receipts, search, showOlder, selectedIds, cutoffRecent, cutoffWeek, cutoffMonth]);

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
          <p className="text-muted-foreground py-4 text-sm">No files match your search.</p>
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

      {hasOlder && !showOlder ? (
        <Button variant="ghost" size="sm" type="button" className="self-start px-0" onClick={() => setShowOlder(true)}>
          Show files older than 90 days
        </Button>
      ) : null}

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
