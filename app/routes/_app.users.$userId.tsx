import { LoaderFunctionArgs, Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { AccountLinkBadge } from "~/components/common/account-link-badge";
import { ContactLinkBadge } from "~/components/common/contact-link-badge";
import { ContactTypeBadge } from "~/components/common/contact-type-badge";
import { PageHeader } from "~/components/common/page-header";
import { RoleBadge } from "~/components/common/role-badge";
import { PageContainer } from "~/components/page-container";
import { db } from "~/integrations/prisma.server";
import { forbidden, handleLoaderError } from "~/lib/responses.server";
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
    const [accounts, user, accountsThatCanBeSubscribedTo] = await Promise.all([
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
          clerkId: true,
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

    return {
      user,
      accounts,
      accountsThatCanBeSubscribedTo,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export default function UserDetailsLayout() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <>
      <title>{`${user.contact.firstName}${user.contact.lastName ? " " + user.contact.lastName : ""}`}</title>
      <PageHeader title={`${user.contact.firstName}${user.contact.lastName ? " " + user.contact.lastName : ""}`} />

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-1">
        <ContactTypeBadge type={user.contact.type.name.toLowerCase()} />
        <RoleBadge role={user.role.toLowerCase()} />
        <ContactLinkBadge contact={user.contact} />
        {user.account ? <AccountLinkBadge account={user.account} /> : null}
      </div>

      <PageContainer>
        <Outlet />
      </PageContainer>
    </>
  );
}
