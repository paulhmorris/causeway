import { Receipt } from "@prisma/client";
import { IconExternalLink } from "@tabler/icons-react";

type Props = {
  receipt: Pick<Receipt, "id" | "title" | "s3Url">;
};

export function ReceiptLink({ receipt }: Props) {
  if (!receipt.s3Url) {
    return (
      <span key={receipt.id} className="text-muted-foregrounded-none block">
        {receipt.title} (Link missing or broken - try refreshing)
      </span>
    );
  }

  return (
    <a
      key={receipt.id}
      href={receipt.s3Url}
      className="text-primary flex items-center gap-1.5 font-medium"
      target="_blank"
      rel="noreferrer"
    >
      <span className="truncate">{receipt.title}</span>
      <IconExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
    </a>
  );
}
