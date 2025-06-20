import { MembershipRole, UserRole } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { checkbox, email, number, optionalSelect, optionalText, text } from "~/schemas/fields";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.UserNew");

const schema = z.object({
  firstName: text,
  lastName: optionalText,
  username: email,
  role: z.enum(MembershipRole),
  systemRole: z.enum(UserRole),
  typeId: number.pipe(z.enum(ContactType)),
  sendPasswordSetup: checkbox,
  accountId: optionalSelect.transform((v) => (v === "Select an account" ? undefined : v)),
});

export const meta: MetaFunction = () => [{ title: "New User" }];

export const loader = async (args: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  return {
    accounts: await db.account.findMany({
      where: {
        orgId,
        user: null,
      },
      orderBy: { code: "asc" },
    }),
    contactTypes: await getContactTypes(orgId),
  };
};

export const action = async (args: ActionFunctionArgs) => {
  const authorizedUser = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { role, systemRole, username, sendPasswordSetup, accountId, ...contact } = result.data;

  // Someone trying to create a SUPERADMIN
  if (systemRole === UserRole.SUPERADMIN && !authorizedUser.isSuperAdmin) {
    return Toasts.dataWithError(
      { message: "You do not have permission to create a Super Admin" },
      {
        message: "Permission denied",
        description: "You do not have permission to create a Super Admin",
      },
    );
  }

  try {
    const user = await db.user.create({
      data: {
        role: UserRole.USER,
        username,
        memberships: {
          create: {
            orgId,
            role,
          },
        },
        account: {
          connect: accountId
            ? {
                id: accountId,
              }
            : undefined,
        },
        contact: {
          create: {
            orgId,
            email: username,
            ...contact,
          },
        },
      },
    });

    // Create account subscription
    if (accountId) {
      await db.account.update({
        where: { id: accountId, orgId },
        data: {
          subscribers: {
            create: {
              subscriberId: user.contactId,
            },
          },
        },
      });
    }

    return Toasts.redirectWithSuccess(`/users/${user.id}/profile`, {
      message: "User created",
      description: sendPasswordSetup
        ? "They will receive an email with instructions to set their password."
        : "You can use the password setup button to send them an email to set their password.",
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
  const user = useUser();
  const { contactTypes, accounts } = useLoaderData<typeof loader>();
  return (
    <>
      <PageHeader
        title="New User"
        description="Users can log in to this portal, request reimbursements, view transactions for a linked account, and view assigned contacts."
      />
      <PageContainer>
        <ValidatedForm
          schema={schema}
          defaultValues={{
            firstName: "",
            lastName: "",
            username: "",
            role: MembershipRole.MEMBER,
            typeId: "",
            systemRole: UserRole.USER,
            accountId: "",
            sendPasswordSetup: "",
          }}
          method="post"
          className="space-y-4 sm:max-w-md"
        >
          {(form) => (
            <>
              <FormField label="First name" scope={form.scope("firstName")} placeholder="Sally" required />
              <FormField label="Last name" scope={form.scope("lastName")} placeholder="Jones" />
              <FormField
                required
                label="Username"
                scope={form.scope("username")}
                placeholder="sally@teamcauseway.org"
              />
              <FormSelect
                required
                scope={form.scope("typeId")}
                label="Contact Type"
                placeholder="Select a type"
                options={contactTypes.map((type) => ({
                  value: type.id,
                  label: type.name,
                }))}
              />
              <FormSelect
                required
                scope={form.scope("role")}
                label="Organization Role"
                placeholder="Select an org role"
              >
                <SelectItem value={MembershipRole.MEMBER}>Member</SelectItem>
                <SelectItem value={MembershipRole.ADMIN}>Admin</SelectItem>
              </FormSelect>
              {user.isSuperAdmin ? (
                <FormSelect
                  required
                  scope={form.scope("systemRole")}
                  label="System Role"
                  placeholder="Select a system role"
                >
                  <SelectItem value={UserRole.USER}>User</SelectItem>
                  <SelectItem value={UserRole.SUPERADMIN}>Super Admin</SelectItem>
                </FormSelect>
              ) : (
                <input type="hidden" name="systemRole" value={UserRole.USER} />
              )}
              <FormSelect
                scope={form.scope("accountId")}
                label="Linked Account"
                placeholder="Select an account"
                description="Link this user to an account. They will be able to see this account and all related transactions."
                options={accounts.map((a) => ({ label: `${a.code} - ${a.description}`, value: a.id }))}
              />
              <div>
                <div className="mb-1">
                  <Label className="inline-flex cursor-pointer items-center gap-2">
                    <Checkbox name="sendPasswordSetup" defaultChecked={false} aria-label="Send Password Setup" />
                    <span>Send Password Setup</span>
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <SubmitButton isSubmitting={form.formState.isSubmitting}>Create</SubmitButton>
                  <Button type="reset" variant="ghost">
                    Reset
                  </Button>
                </div>
              </div>
            </>
          )}
        </ValidatedForm>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
