import { IconHome, IconSelector, IconWorld } from "@tabler/icons-react";
import { type ComponentPropsWithoutRef } from "react";
import { Form, Link, NavLink } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Separator } from "~/components/ui/separator";
import { UserMenu } from "~/components/user-menu";
import { useUser } from "~/hooks/useUser";
import { AppNavLink, adminNavLinks, globalNavLinks, superAdminNavLinks, userNavLinks } from "~/lib/constants";
import { cn, normalizeEnum } from "~/lib/utils";

export function DesktopNav(props: ComponentPropsWithoutRef<"nav">) {
  const user = useUser();
  const hasMultipleOrgs = user.memberships.length > 1;
  const role = user.memberships.find((m) => m.orgId === user.org?.id)?.role;

  return (
    <nav
      className={cn(
        "fixed inset-y-0 left-0 z-10 hidden w-64 flex-col overflow-y-scroll border-r border-border bg-card px-5 py-10 md:flex",
        props.className,
      )}
    >
      {hasMultipleOrgs ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary ring-offset-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:w-full">
              <span className="sr-only">Change Organization</span>
              <IconWorld className="size-10 shrink-0" stroke={1.2} />
              <div className="flex flex-col text-left">
                <span className="text-pretty">{user.org?.name}</span>
                {role ? <span className="text-xs font-medium text-muted-foreground">{normalizeEnum(role)}</span> : null}
              </div>
              <IconSelector className="ml-auto size-5 shrink-0 text-muted-foreground" />
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
      ) : (
        <div className="flex items-center px-2.5">
          <Link to="/" className="inline-flex items-center space-x-2 text-sm font-bold text-primary">
            <IconWorld className="size-10" stroke={1.2} />
            <div className="flex flex-col">
              <span className="text-pretty">{user.org?.name}</span>
              {role ? <span className="text-xs font-medium text-muted-foreground">{normalizeEnum(role)}</span> : null}
            </div>
          </Link>
        </div>
      )}
      <ul className="relative mt-8 space-x-0 space-y-1">
        <DesktopNavLink
          to={user.isMember ? "/dashboards/staff" : "/dashboards/admin"}
          name="Home"
          icon={IconHome}
          end={false}
        />
        {globalNavLinks.map((link) => (
          <DesktopNavLink key={link.to} {...link} />
        ))}
        {user.isMember ? userNavLinks.map((link) => <DesktopNavLink key={link.to} {...link} />) : null}
      </ul>
      {user.isAdmin || user.isSuperAdmin ? (
        <>
          <Separator className="my-4" />
          <p className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground">ADMIN</p>
          <ul className="space-x-0 space-y-1">
            {adminNavLinks.map((link) => (
              <DesktopNavLink key={link.to} {...link} />
            ))}
          </ul>
        </>
      ) : null}
      {user.isSuperAdmin && superAdminNavLinks.length > 0 ? (
        <>
          <Separator className="my-4" />
          <p className="mb-4 text-xs font-semibold tracking-widest text-muted-foreground">SUPER ADMIN</p>
          <ul className="space-x-0 space-y-1">
            {superAdminNavLinks.map((link) => (
              <DesktopNavLink key={link.to} {...link} />
            ))}
          </ul>
        </>
      ) : null}

      <Separator className="my-4 mt-auto" />
      <UserMenu />
    </nav>
  );
}

function DesktopNavLink({ to, name, end, icon: Icon }: AppNavLink) {
  return (
    <li>
      <NavLink
        end={end}
        to={to}
        className={({ isActive }) =>
          cn(
            "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
            isActive ? "bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted",
          )
        }
      >
        <Icon className="size-5" />
        <span>{name}</span>
      </NavLink>
    </li>
  );
}
