import { Prisma } from "@prisma/client";
import { IconReceipt2 } from "@tabler/icons-react";
import dayjs from "dayjs";

import { FileUploader } from "~/components/common/file-uploader";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { useUser } from "~/hooks/useUser";
import { cn } from "~/lib/utils";

export function ReceiptSelector({
  receipts,
}: {
  receipts: Array<
    Prisma.ReceiptGetPayload<{
      include: {
        user: {
          select: {
            contact: {
              select: { email: true };
            };
          };
        };
      };
    }>
  >;
}) {
  const user = useUser();

  return (
    <div className="space-y-2">
      <FileUploader />
      <fieldset>
        {receipts.length > 0 ? <legend className="mb-2 text-sm font-medium">Attach Files</legend> : null}
        <div className="flex flex-col gap-y-4 sm:gap-y-2.5">
          {receipts.length > 0 ? (
            receipts.map((r) => {
              return (
                <Label
                  key={r.id}
                  className="flex w-full cursor-pointer flex-col gap-1.5 font-normal md:grid md:grid-cols-7 md:items-center"
                >
                  <div className={cn("flex w-full items-center gap-1.5", user.isMember ? "col-span-5" : "col-span-4")}>
                    <Checkbox
                      name="receiptIds"
                      value={r.id}
                      aria-label={r.title}
                      defaultChecked={dayjs(r.createdAt).format("YYYY-MM-DD") === dayjs().format("YYYY-MM-DD")}
                    />
                    <span className="-my-1 max-w-[calc(100dvw-60px)] truncate py-1">{r.title}</span>
                  </div>
                  <div className={cn("whitespace-nowrap md:text-right", user.isMember ? "col-span-2" : "col-span-3")}>
                    <span className="text-muted-foreground ml-6 text-xs sm:ml-auto">
                      {dayjs(r.createdAt).format("M/D/YY h:mma")}
                    </span>
                    {!user.isMember ? (
                      <span className="text-muted-foreground text-xs"> by {r.user.contact.email}</span>
                    ) : null}
                  </div>
                </Label>
              );
            })
          ) : (
            <div className="bg-muted text-muted-foreground flex items-center gap-2 rounded-md p-2 text-sm">
              <IconReceipt2 className="size-5" />
              <p>Upload receipts to get started.</p>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}
