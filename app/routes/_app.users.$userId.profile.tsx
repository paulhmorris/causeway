import { UserRole } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs } from "react-router";
import { Link, useRouteLoaderData } from "react-router";

import { ErrorComponent } from "~/components/error-component";
import { UpdateUserForm, updateUserSchema } from "~/components/forms/update-user-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Toasts } from "~/lib/toast.server";
import { loader } from "~/routes/_app.users.$userId";
import { SessionService } from "~/services.server/session";

export const action = async (args: ActionFunctionArgs) => {
  const authorizedUser = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, updateUserSchema);
  if (result.error) {
    return validationError(result.error);
  }

  const { username, role, id, accountId, subscribedAccountIds, ...contact } = result.data;

  const userToBeUpdated = await db.user.findUniqueOrThrow({
    select: { role: true, username: true, accountId: true },
    where: { id },
  });

  if (authorizedUser.isMember) {
    // Users can only edit themselves
    if (authorizedUser.id !== id) {
      return Toasts.dataWithWarning(null, {
        message: "Permission denied",
        description: "You do not have permission to edit this user.",
      });
    }

    // Users can't edit their role, username, or assigned account
    if (
      role !== userToBeUpdated.role ||
      username !== userToBeUpdated.username ||
      accountId !== userToBeUpdated.accountId
    ) {
      return Toasts.dataWithWarning(null, {
        message: "Permission denied",
        description: "You do not have permission to edit this field.",
      });
    }
  }

  if (authorizedUser.systemRole !== UserRole.SUPERADMIN && role === UserRole.SUPERADMIN) {
    return Toasts.dataWithWarning(null, {
      message: "Permission denied",
      description: "You do not have permission to create a Super Admin.",
    });
  }

  const updatedUser = await db.user.update({
    where: {
      id,
      memberships: {
        some: { orgId },
      },
    },
    data: {
      role,
      username,
      account: accountId
        ? {
            connect: {
              id: accountId,
            },
          }
        : { disconnect: true },
      contact: {
        update: {
          ...contact,
          accountSubscriptions: {
            // Rebuild the account subscriptions
            deleteMany: {},
            create: subscribedAccountIds ? subscribedAccountIds.map((id) => ({ accountId: id })) : undefined,
          },
        },
      },
    },
  });

  return Toasts.dataWithSuccess({ user: updatedUser }, { message: "User updated", description: "Great job." });
};

export default function UserDetailsPage() {
  const authorizedUser = useUser();
  const layoutData = useRouteLoaderData<typeof loader>("routes/_app.users.$userId");

  if (!layoutData) {
    throw new Error("User Details Page must be used within the User ID layout");
  }

  const { user } = layoutData;
  const isYou = authorizedUser.id === user.id;

  return (
    <>
      <UpdateUserForm />
      <div className="mt-4 max-w-lg">
        {user.contactAssignments.length > 0 ? (
          <Card className="flex-1 basis-48 bg-transparent">
            <CardHeader>
              <CardTitle>Contact Assignments</CardTitle>
              <CardDescription>
                {isYou ? "You" : "This user"} will receive regular reminders to engage with these Contacts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul>
                {user.contactAssignments.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/contacts/${a.contactId}`}
                      prefetch="intent"
                      className="text-primary text-sm font-medium"
                    >
                      {a.contact.firstName} {a.contact.lastName}
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
