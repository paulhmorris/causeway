import { IconChevronDown } from "@tabler/icons-react";
import { Form, Link } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useUser } from "~/hooks/useUser";
import { normalizeEnum } from "~/lib/utils";

export function OrgSelector() {
  const user = useUser();
  const hasMultipleOrgs = user.memberships.length > 1;
  const role = user.memberships.find((m) => m.orgId === user.org?.id)?.role;

  if (!hasMultipleOrgs) {
    return (
      <div className="flex items-center px-2.5">
        <Link to="/" className="text-primary inline-flex items-center space-x-2 text-sm font-bold">
          <img src="/logo.svg" aria-hidden="true" className="aspect-square size-10" />
          <div className="flex flex-col">
            <span className="text-pretty">{user.org?.name}</span>
            {role ? <span className="text-muted-foreground text-xs font-medium">{normalizeEnum(role)}</span> : null}
          </div>
        </Link>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="text-primary ring-offset-card hover:bg-muted focus-visible:ring-ring relative flex cursor-pointer items-center gap-x-3 rounded-md px-2.5 py-1 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden md:w-full">
          <span className="sr-only">Change Organization</span>
          <span className="font-display text-4xl font-bold" aria-hidden="true">
            C
          </span>

          <div className="flex flex-col text-left">
            <span className="text-pretty">{user.org?.name}</span>
            {role ? <span className="text-muted-foreground text-xs font-medium">{normalizeEnum(role)}</span> : null}
          </div>
          <IconChevronDown className="text-muted-foreground ml-auto size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="mb-2 w-[215px] space-y-1" align="center" forceMount>
        <Form action="/api/change-org" method="post">
          {user.memberships.map((m) => (
            <DropdownMenuItem asChild key={m.orgId} className="cursor-pointer" disabled={user.org?.id === m.orgId}>
              <button type="submit" name="orgId" value={m.orgId} className="w-full">
                {m.org.name}
              </button>
            </DropdownMenuItem>
          ))}
        </Form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
