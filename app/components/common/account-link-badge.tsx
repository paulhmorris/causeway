import { IconBuildingBank } from "@tabler/icons-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";

type Props = {
  account: {
    id: string;
    code: string;
    description: string;
  };
};

export function AccountLinkBadge({ account }: Props) {
  return (
    <Badge variant="secondary">
      <Link to={`/accounts/${account.id}`} prefetch="intent" className="flex items-center gap-2">
        <div>
          <IconBuildingBank className="size-3" />
        </div>
        {`${account.code} - ${account.description}`}
      </Link>
    </Badge>
  );
}
