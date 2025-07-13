import { ReimbursementRequestStatus } from "@prisma/client";

import { Badge } from "~/components/ui/badge";
import { capitalize } from "~/lib/utils";

export function ReimbursementStatusBadge({ status }: { status: ReimbursementRequestStatus }) {
  return (
    <Badge
      variant={
        status === "APPROVED"
          ? "success"
          : status === "REJECTED"
            ? "destructive"
            : status === "VOID"
              ? "outline"
              : "secondary"
      }
    >
      {capitalize(status)}
    </Badge>
  );
}
