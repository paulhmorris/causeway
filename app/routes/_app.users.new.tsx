import { UserRole } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { NewUserForm, newUserSchema } from "~/components/forms/new-user-form";
import { PageContainer } from "~/components/page-container";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";
import { UserService } from "~/services.server/user";

const logger = createLogger("Routes.UserNew");

export const loader = async (args: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  return {
    accounts: await db.account.findMany({
      where: { orgId, user: null },
      orderBy: { code: "asc" },
    }),
    contactTypes: await getContactTypes(orgId),
  };
};

export const action = async (args: ActionFunctionArgs) => {
  const authorizedUser = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, newUserSchema);
  if (result.error) {
    return validationError(result.error);
  }

  const { systemRole, username, ...contact } = result.data;

  // Someone trying to create a SUPERADMIN
  if (systemRole === UserRole.SUPERADMIN && !authorizedUser.isSuperAdmin) {
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "You do not have permission to create a Super Admin",
    });
  }

  try {
    const isExistingUser = (await db.user.count({ where: { username } })) > 0;
    if (isExistingUser) {
      return Toasts.dataWithError(null, { message: "Error", description: "A user with this email already exists." });
    }

    const user = await UserService.create({ orgId, ...result.data });

    return Toasts.redirectWithSuccess(`/users/${user.id}/profile`, {
      message: "Success",
      description: `${contact.firstName} has been invited to join the organization.`,
    });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(null, {
      message: "Unexpected error",
      description: "An unexpected error occurred. Please try again.",
    });
  }
};

export default function NewUserPage() {
  const { contactTypes, accounts } = useLoaderData<typeof loader>();
  return (
    <>
      <title>New User</title>
      <PageHeader
        title="New User"
        description="Users can log in to this portal, request reimbursements, view transactions for a linked account, and view assigned contacts."
      />
      <PageContainer>
        <NewUserForm accounts={accounts} contactTypes={contactTypes} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
