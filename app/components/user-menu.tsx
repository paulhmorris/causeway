import { IconArrowRight, IconMoon, IconSelector, IconSun } from "@tabler/icons-react";
import { useState } from "react";
import { Form, Link } from "react-router";
import { Theme, useTheme } from "remix-themes";

import { NewInquiryModal } from "~/components/modals/inquiry-modal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { useUser } from "~/hooks/useUser";

export function UserMenu() {
  const user = useUser();
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [_, setTheme] = useTheme();

  function handleToggleTheme() {
    setTheme((theme) => (theme === Theme.DARK ? Theme.LIGHT : Theme.DARK));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary ring-offset-background hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:w-full">
            <span className="sr-only">Open User Menu</span>
            <div className="flex flex-col space-y-2 text-left md:space-y-0">
              <p className="text-base font-medium leading-none md:text-sm">
                {`${user.contact.firstName} ${user.contact.lastName}`}
              </p>
              <p className="text-sm leading-none text-muted-foreground md:text-xs">{user.contact.email}</p>
            </div>
            <IconSelector className="ml-auto size-5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mb-2 w-[215px]" align="start" forceMount>
          <div className="md:hidden">
            <DropdownMenuLabel>
              <p className="text-xs font-medium leading-none text-muted-foreground">{user.org?.name}</p>
            </DropdownMenuLabel>
            {user.memberships.length > 1 ? (
              <>
                <DropdownMenuItem asChild className="py-0.5">
                  <Link className="flex cursor-pointer items-center justify-between gap-2" to="/choose-org">
                    <span>Change Org</span>
                    <IconArrowRight className="size-4" />
                  </Link>
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuSeparator />
          </div>
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer sm:hidden" to={user.isMember ? "/dashboards/staff" : "/dashboards/admin"}>
                Home
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer" to={`/users/${user.id}/profile`}>
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link className="cursor-pointer" to="/feature-request">
                Feature Request
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onClick={() => setInquiryOpen(true)}>
              New Inquiry
            </DropdownMenuItem>
            <button
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-base outline-none transition-colors hover:bg-secondary focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50 sm:text-sm"
              onClick={handleToggleTheme}
            >
              <span>Toggle theme</span>
              <IconSun className="absolute right-2 size-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <IconMoon className="absolute right-2 size-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </button>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="px-0 py-0">
            <Form className="w-full" method="post" action="/logout" navigate={false}>
              <button className="w-full px-2 py-1.5 text-left">Log out</button>
            </Form>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <NewInquiryModal open={inquiryOpen} onOpenChange={setInquiryOpen} />
    </>
  );
}
