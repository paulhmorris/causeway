import { IconKey } from "@tabler/icons-react";

import { Badge } from "~/components/ui/badge";

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge variant="outline" className="capitalize">
      <div>
        <IconKey className="size-3" />
      </div>
      <span>{role}</span>
    </Badge>
  );
}
