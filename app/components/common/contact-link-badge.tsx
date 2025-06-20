import { IconUserCircle } from "@tabler/icons-react";
import { Link } from "react-router";

import { Badge } from "~/components/ui/badge";

type Props = {
  contact: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
};

export function ContactLinkBadge({ contact }: Props) {
  return (
    <Badge variant="secondary" className="capitalize">
      <Link to={`/contacts/${contact.id}`} prefetch="intent" className="flex items-center gap-2">
        <div>
          <IconUserCircle className="size-3" />
        </div>
        <span>
          {contact.firstName}
          {contact.lastName ? " " + contact.lastName : null}
        </span>
      </Link>
    </Badge>
  );
}
