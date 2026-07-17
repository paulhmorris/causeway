import { Prisma } from "@prisma/client";
import { IconReceipt2, IconSearch } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useMemo, useState } from "react";

import { FileUploader } from "~/components/common/file-uploader";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useUser } from "~/hooks/useUser";
import { cn } from "~/lib/utils";

type Receipt = Prisma.ReceiptGetPayload<{
  include: {
    user: { select: { contact: { select: { email: true } } } };
    reimbursementRequests: { select: { id: true } };
  };
}>;

const DAYS_DEFAULT = 90;
const DAYS_WEEK = 7;
const DAYS_MONTH = 30;

export function ReceiptSelector({ receipts }: { receipts: Array<Receipt> }) {
  const user = useUser();
  const [search, setSearch] = useState("");
  const [showOlder, setShowOlder] = useState(false);

  const cutoff90 = useMemo(() => dayjs().subtract(DAYS_DEFAULT, "day"), []);
  const cutoffWeek = useMemo(() => dayjs().subtract(DAYS_WEEK, "day"), []);
  const cutoffMonth = useMemo(() => dayjs().subtract(DAYS_MONTH, "day"), []);

  const hasOlderFiles = receipts.some((r) => dayjs(r.createdAt).isBefore(cutoff90));

  const filtered = useMemo(() => {
    const base = showOlder ? receipts : receipts.filter((r) => dayjs(r.createdAt).isAfter(cutoff90));
    if (!search.trim()) return base;
    const q = search.toLowerCase();
    return base.filter((r) => r.title.toLowerCase().includes(q));
  }, [receipts, search, showOlder, cutoff90]);

  const groups = useMemo(() => {
    const thisWeek: Receipt[] = [];
    const thisMonth: Receipt[] = [];
    const older: Receipt[] = [];
    for (const r of filtered) {
      const d = dayjs(r.createdAt);
      if (d.isAfter(cutoffWeek)) thisWeek.push(r);
      else if (d.isAfter(cutoffMonth)) thisMonth.push(r);
      else older.push(r);
    }
    return { thisWeek, thisMonth, older };
  }, [filtered, cutoffWeek, cutoffMonth]);

  return (
    <div className="space-y-2">
      <FileUploader />
      <fieldset>
        {receipts.length > 0 ? (
          <>
            <legend className="mb-2 text-sm font-medium">Attach Files</legend>
            <div className="relative mb-3">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input
                type="search"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-sm"
              />
            </div>
          </>
        ) : null}

        {receipts.length === 0 ? (
          <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
            <IconReceipt2 className="size-5" />
            <p>Upload receipts to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">No files match your search.</p>
        ) : (
          <div className="flex flex-col gap-y-5">
            <ReceiptGroup label="This Week" receipts={groups.thisWeek} isMember={user.isMember} />
            <ReceiptGroup label="This Month" receipts={groups.thisMonth} isMember={user.isMember} />
            <ReceiptGroup label="Older" receipts={groups.older} isMember={user.isMember} />
          </div>
        )}

        {hasOlderFiles && !showOlder ? (
          <Button variant="ghost" size="sm" type="button" className="mt-2 px-0" onClick={() => setShowOlder(true)}>
            Show files older than 90 days
          </Button>
        ) : null}
      </fieldset>
    </div>
  );
}

function ReceiptGroup({
  label,
  receipts,
  isMember,
}: {
  label: string;
  receipts: Receipt[];
  isMember: boolean;
}) {
  if (receipts.length === 0) return null;

  return (
    <div>
      <p className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">{label}</p>
      <div className="flex flex-col gap-y-2.5">
        {receipts.map((r) => {
          const isUsed = r.reimbursementRequests.length > 0;
          return (
            <Label
              key={r.id}
              className={cn(
                "flex w-full flex-col gap-1.5 font-normal md:grid md:grid-cols-7 md:items-center",
                isUsed ? "cursor-default opacity-60" : "cursor-pointer",
              )}
            >
              <div className={cn("flex w-full items-center gap-1.5", isMember ? "col-span-5" : "col-span-4")}>
                <Checkbox
                  name="receiptIds"
                  value={r.id}
                  aria-label={r.title}
                  disabled={isUsed}
                  defaultChecked={
                    !isUsed && dayjs(r.createdAt).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD")
                  }
                />
                <span className="-my-1 max-w-[calc(100dvw-60px)] truncate py-1">{r.title}</span>
                {isUsed ? (
                  <Badge variant="outline" className="shrink-0 text-xs">
                    Used
                  </Badge>
                ) : null}
              </div>
              <div className={cn("whitespace-nowrap md:text-right", isMember ? "col-span-2" : "col-span-3")}>
                <span className="text-muted-foreground ml-6 text-xs sm:ml-auto">
                  {dayjs(r.createdAt).format("M/D/YY h:mma")}
                </span>
                {!isMember ? (
                  <span className="text-muted-foreground text-xs"> by {r.user.contact.email}</span>
                ) : null}
              </div>
            </Label>
          );
        })}
      </div>
    </div>
  );
}
