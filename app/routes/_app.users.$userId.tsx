import { LoaderFunctionArgs, Outlet, useLoaderData } from "react-router";
import invariant from "tiny-invariant";

import { AccountLinkBadge } from "~/components/common/account-link-badge";
import { ContactLinkBadge } from "~/components/common/contact-link-badge";
import { ContactTypeBadge } from "~/components/common/contact-type-badge";
import { InvitationStatusBadge } from "~/components/common/invitation-status-badge";
import { PageHeader } from "~/components/common/page-header";
import { RoleBadge } from "~/components/common/role-badge";
import { PageContainer } from "~/components/page-container";
import { db } from "~/integrations/prisma.server";
import { handleLoaderError, Responses } from "~/lib/responses.server";
import { AuthService } from "~/services.server/auth";
import { SessionService } from "~/services.server/session";

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  const authorizedUser = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  invariant(params.userId, "userId not found");

  if (authorizedUser.isMember && authorizedUser.id !== params.userId) {
    throw Responses.forbidden({ message: "You do not have permission to view this page" });
  }

  try {
    const [accounts, user, accountsThatCanBeSubscribedTo] = await db.$transaction([
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

    const existingInvitations = await AuthService.getInvitationsByEmail(user.username);
    const latestInvitation =
      existingInvitations.length === 0
        ? null
        : existingInvitations.length === 1
          ? existingInvitations[0]
          : existingInvitations.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return {
      latestInvitation,
      user,
      accounts,
      accountsThatCanBeSubscribedTo,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export default function UserDetailsLayout() {
  const { user, latestInvitation } = useLoaderData<typeof loader>();

  return (
    <>
      <title>{`${user.contact.firstName}${user.contact.lastName ? " " + user.contact.lastName : ""}`}</title>
      <PageHeader title={`${user.contact.firstName}${user.contact.lastName ? " " + user.contact.lastName : ""}`} />

      <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-1">
        {latestInvitation ? <InvitationStatusBadge status={latestInvitation.status} /> : null}
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
