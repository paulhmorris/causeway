import { IconAddressBook } from "@tabler/icons-react";

import { Badge } from "~/components/ui/badge";

export function ContactTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="capitalize">
      <div>
        <IconAddressBook className="size-3" />
      </div>
      <span>{type}</span>
    </Badge>
  );
}
