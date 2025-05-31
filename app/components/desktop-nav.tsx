import { IconHome } from "@tabler/icons-react";
import { type ComponentPropsWithoutRef } from "react";
import { NavLink } from "react-router";

import { OrgSelector } from "~/components/org-selector";
import { Separator } from "~/components/ui/separator";
import { UserMenu } from "~/components/user-menu";
import { useUser } from "~/hooks/useUser";
import { AppNavLink, adminNavLinks, globalNavLinks, superAdminNavLinks, userNavLinks } from "~/lib/constants";
import { cn } from "~/lib/utils";

export function DesktopNav(props: ComponentPropsWithoutRef<"nav">) {
  const user = useUser();

  return (
    <nav
      className={cn(
        "border-border bg-card fixed inset-y-0 left-0 z-10 hidden w-64 flex-col overflow-y-scroll border-r px-5 pt-4 pb-6 md:flex",
        props.className,
      )}
    >
      <OrgSelector />
      <ul className="relative mt-8 space-y-1 space-x-0">
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
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest">ADMIN</p>
          <ul className="space-y-1 space-x-0">
            {adminNavLinks.map((link) => (
              <DesktopNavLink key={link.to} {...link} />
            ))}
          </ul>
        </>
      ) : null}
      {user.isSuperAdmin && superAdminNavLinks.length > 0 ? (
        <>
          <Separator className="my-4" />
          <p className="text-muted-foreground mb-4 text-xs font-semibold tracking-widest">SUPER ADMIN</p>
          <ul className="space-y-1 space-x-0">
            {superAdminNavLinks.map((link) => (
              <DesktopNavLink key={link.to} {...link} />
            ))}
          </ul>
        </>
      ) : null}

      <div className="my-4 mt-auto"></div>
      <UserMenu />
    </nav>
  );
}

function DesktopNavLink({ to, name, end, prefetch, icon: Icon }: AppNavLink) {
  return (
    <li>
      <NavLink
        end={end}
        to={to}
        prefetch={prefetch ? "intent" : "none"}
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
