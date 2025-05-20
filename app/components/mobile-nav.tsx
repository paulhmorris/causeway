import { IconMenuDeep } from "@tabler/icons-react";
import { useState, type ComponentPropsWithoutRef } from "react";
import { NavLink } from "react-router";

import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { UserMenu } from "~/components/user-menu";
import { useUser } from "~/hooks/useUser";
import { adminNavLinks, globalNavLinks, superAdminNavLinks, userNavLinks } from "~/lib/constants";
import { cn } from "~/lib/utils";

export function MobileNav(props: ComponentPropsWithoutRef<"nav">) {
  const user = useUser();
  const [open, setOpen] = useState(false);

  return (
    <nav className={cn("flex items-center justify-between gap-4 border-b px-6 py-4 md:hidden", props.className)}>
      <UserMenu />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger>
          <span className="sr-only">Open Navigation Menu</span>
          <IconMenuDeep className="h-8 w-8" />
        </DialogTrigger>
        <DialogContent className="top-0 max-h-dvh max-w-full translate-y-0 overflow-y-scroll">
          <DialogTitle className="sr-only">Navigation links</DialogTitle>
          <ul className="mt-6 space-x-0 space-y-1">
            <MobileNavLink
              setOpen={setOpen}
              to={user.isMember ? "/dashboards/staff" : "/dashboards/admin"}
              name="Home"
            />
            {globalNavLinks.map((link) => (
              <MobileNavLink setOpen={setOpen} key={link.to} to={link.to} name={link.name} />
            ))}
            {user.isMember
              ? userNavLinks.map((link) => (
                  <MobileNavLink setOpen={setOpen} key={link.to} to={link.to} name={link.name} />
                ))
              : null}
          </ul>
          {user.isAdmin || user.isSuperAdmin ? (
            <>
              <Separator />
              <p className="text-sm font-semibold tracking-widest text-muted-foreground">ADMIN</p>
              <ul className="space-x-0 space-y-1">
                {adminNavLinks.map((link) => (
                  <MobileNavLink setOpen={setOpen} key={link.to} to={link.to} name={link.name} />
                ))}
              </ul>
            </>
          ) : null}
          {user.isSuperAdmin && superAdminNavLinks.length > 0 ? (
            <>
              <Separator />
              <p className="text-sm font-semibold tracking-widest text-muted-foreground">SUPER ADMIN</p>
              <ul className="space-x-0 space-y-1">
                {superAdminNavLinks.map((link) => (
                  <MobileNavLink setOpen={setOpen} key={link.to} to={link.to} name={link.name} />
                ))}
              </ul>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </nav>
  );
}

function MobileNavLink({ to, name, setOpen }: { to: string; name: string; setOpen: (value: boolean) => void }) {
  return (
    <li>
      <NavLink
        to={to}
        onClick={() => setOpen(false)}
        className={({ isActive }) =>
          cn(
            "flex cursor-pointer items-center rounded-md px-3 py-2 font-medium text-secondary-foreground hover:bg-primary/10",
            isActive && "bg-primary/10",
          )
        }
      >
        {name}
      </NavLink>
    </li>
  );
}
