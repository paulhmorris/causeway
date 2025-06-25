import { Invitation } from "@clerk/backend";
import { IconMailPlus } from "@tabler/icons-react";

import { Badge } from "~/components/ui/badge";

export function InvitationStatusBadge({ status }: { status: Invitation["status"] }) {
  return (
    <Badge
      variant={
        status === "accepted" ? "success" : status === "revoked" || status === "expired" ? "destructive" : "warning"
      }
      className="capitalize"
      title="Invitation Status"
    >
      <div>
        <IconMailPlus className="size-3" />
      </div>
      <span>{status.toLowerCase()}</span>
    </Badge>
  );
}
