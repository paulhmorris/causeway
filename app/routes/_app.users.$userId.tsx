import { ValidatedForm } from "@rvf/react-router";
import { IconAddressBook, IconBuildingBank, IconKey, IconLockPlus, IconUserCircle } from "@tabler/icons-react";
import { Link, LoaderFunctionArgs, MetaFunction, NavLink, Outlet, useFetcher, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { PageHeader } from "~/components/common/page-header";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { forbidden, handleLoaderError } from "~/lib/responses.server";
import { cn } from "~/lib/utils";
import { passwordResetSchema } from "~/routes/resources.reset-password";
import { SessionService } from "~/services.server/session";

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  const authorizedUser = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  invariant(params.userId, "userId not found");

  if (authorizedUser.isMember && authorizedUser.id !== params.userId) {
    throw forbidden({ message: "You do not have permission to view this page" });
  }

  try {
    const [accounts, userWithPassword, accountsThatCanBeSubscribedTo] = await Promise.all([
      db.account.findMany({
        where: {
          orgId,
          OR: [{ user: null }, { user: { id: params.userId } }],
        },
        orderBy: { code: "asc" },
      }),
      db.user.findUniqueOrThrow({
        where: {
          id: params.userId,
          memberships: {
            some: { orgId },
          },
        },
        select: {
          id: true,
          username: true,
          role: true,
          contactAssignments: {
            select: {
              id: true,
              contactId: true,
              contact: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          password: true,
          account: {
            select: {
              id: true,
              code: true,
              description: true,
            },
          },
          contact: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              type: {
                select: {
                  name: true,
                },
              },
              accountSubscriptions: {
                select: {
                  accountId: true,
                },
              },
            },
          },
        },
      }),
      db.account.findMany({
        where: { orgId },
        select: {
          id: true,
          code: true,
          description: true,
          subscribers: {
            select: {
              subscriberId: true,
            },
          },
        },
        orderBy: { code: "asc" },
      }),
    ]);

    const { password: _password, ...userWithoutPassword } = userWithPassword;

    return {
      accounts,
      user: userWithoutPassword,
      accountsThatCanBeSubscribedTo,
      hasPassword: !!_password,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title: `${data?.user.contact.firstName}${data?.user.contact.lastName ? " " + data.user.contact.lastName : ""}`,
  },
];

const links = [{ label: "Profile", to: "profile" }];

export default function UserDetailsLayout() {
  const authorizedUser = useUser();
  const { user, hasPassword } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  const isYou = authorizedUser.id === user.id;

  return (
    <>
      <PageHeader title={`${user.contact.firstName}${user.contact.lastName ? " " + user.contact.lastName : ""}`}>
        <div className="mt-2 flex items-center gap-2">
          <ValidatedForm
            id="reset-password-form"
            fetcher={fetcher}
            schema={passwordResetSchema}
            method="post"
            action="/resources/reset-password"
            defaultValues={{ username: user.username, _action: hasPassword ? "reset" : "setup" }}
          >
            {(form) => (
              <>
                <input type="hidden" name="username" value={user.username} />
                <SubmitButton
                  isSubmitting={form.formState.isSubmitting}
                  variant="outline"
                  type="submit"
                  name="_action"
                  value={hasPassword ? "reset" : "setup"}
                >
                  <span>Send Password {hasPassword ? "Reset" : "Setup"}</span>
                  {!hasPassword ? <IconLockPlus className="size-4" /> : null}
                </SubmitButton>
              </>
            )}
          </ValidatedForm>
        </div>
      </PageHeader>

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-1">
        <Badge variant="outline" className="capitalize">
          <div>
            <IconAddressBook className="size-3" />
          </div>
          <span>{user.contact.type.name.toLowerCase()}</span>
        </Badge>
        <Badge variant="outline" className="capitalize">
          <div>
            <IconKey className="size-3" />
          </div>
          <span>{user.role.toLowerCase()}</span>
        </Badge>
        <Badge variant="secondary" className="capitalize">
          <Link to={`/contacts/${user.contact.id}`} prefetch="intent" className="flex items-center gap-2">
            <div>
              <IconUserCircle className="size-3" />
            </div>
            <span>
              {user.contact.firstName} {user.contact.lastName}
            </span>
          </Link>
        </Badge>
        {user.account ? (
          <Badge variant="secondary">
            <Link to={`/accounts/${user.account.id}`} prefetch="intent" className="flex items-center gap-2">
              <div>
                <IconBuildingBank className="size-3" />
              </div>
              {`${user.account.code} - ${user.account.description}`}
            </Link>
          </Badge>
        ) : null}
      </div>

      <PageContainer>
        <ul className="bg-muted text-muted-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md p-1">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                className={({ isActive }) =>
                  cn(
                    "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                    isActive ? "bg-background text-foreground shadow-xs" : "hover:bg-background/50",
                  )
                }
                to={link.to}
              >
                <span>{link.label}</span>
              </NavLink>
            </li>
          ))}
          {isYou ? (
            <NavLink
              className={({ isActive }) =>
                cn(
                  "ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50",
                  isActive ? "bg-background text-foreground shadow-xs" : "hover:bg-background/50",
                )
              }
              to="password"
            >
              <span>Password</span>
            </NavLink>
          ) : null}
        </ul>
        <div className="pt-4">
          <Outlet />
        </div>
      </PageContainer>
    </>
  );
}
