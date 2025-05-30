import { IconArrowRight, IconChevronUp, IconMoon, IconSun } from "@tabler/icons-react";
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
          <button className="text-primary ring-offset-background hover:bg-muted focus-visible:ring-ring relative flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden md:w-full">
            <span className="sr-only">Open User Menu</span>
            <div className="flex flex-col space-y-1 text-left">
              <p className="text-base leading-none font-medium md:text-sm">
                {`${user.contact.firstName} ${user.contact.lastName}`}
              </p>
              <p className="text-muted-foreground text-sm leading-none md:text-xs">{user.contact.email}</p>
            </div>
            <IconChevronUp className="text-muted-foreground ml-auto size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="mb-2 w-[215px]" align="start" forceMount>
          <div className="md:hidden">
            <DropdownMenuLabel>
              <p className="text-muted-foreground text-xs leading-none font-medium">{user.org?.name}</p>
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
              className="hover:bg-secondary relative flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-base outline-hidden transition-colors select-none disabled:pointer-events-none disabled:opacity-50 sm:text-sm"
              onClick={handleToggleTheme}
            >
              <span>Toggle theme</span>
              <IconSun className="absolute right-2 size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
              <IconMoon className="absolute right-2 size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
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
