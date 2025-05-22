import { MembershipRole, UserRole } from "@prisma/client";
import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { useLoaderData, type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "react-router";
import { z } from "zod";

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
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { CheckboxSchema } from "~/models/schemas";
import { getContactTypes } from "~/services.server/contact";
import { sendPasswordSetupEmail } from "~/services.server/mail";
import { generatePasswordReset } from "~/services.server/password";
import { SessionService } from "~/services.server/session";

const validator = withZod(
  z.object({
    firstName: z.string().min(1, { message: "First name is required" }),
    lastName: z.string().optional(),
    username: z.string().email({ message: "Invalid email address" }),
    role: z.nativeEnum(MembershipRole),
    systemRole: z.nativeEnum(UserRole),
    typeId: z.coerce.number().pipe(z.nativeEnum(ContactType)),
    sendPasswordSetup: CheckboxSchema,
    accountId: z
      .string()
      .transform((v) => (v === "Select an account" ? undefined : v))
      .optional(),
  }),
);

export const meta: MetaFunction = () => [{ title: "New User" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

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

export const action = async ({ request }: ActionFunctionArgs) => {
  const authorizedUser = await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await validator.validate(await request.formData());
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

    if (sendPasswordSetup) {
      const { token } = await generatePasswordReset(user.username);
      await sendPasswordSetupEmail({ email: user.username, token, orgId });
    }

    return Toasts.redirectWithSuccess(`/users/${user.id}/profile`, {
      message: "User created",
      description: sendPasswordSetup
        ? "They will receive an email with instructions to set their password."
        : "You can use the password setup button to send them an email to set their password.",
    });
  } catch (error) {
    console.error(error);
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
          validator={validator}
          defaultValues={{
            firstName: "",
            lastName: "",
            username: "",
            role: MembershipRole.MEMBER,
            typeId: "",
            systemRole: UserRole.USER,
            accountId: "",
          }}
          method="post"
          className="space-y-4 sm:max-w-md"
        >
          {(form) => (
            <>
              <FormField label="First name" scope={form.scope("firstName")} placeholder="Sally" required />
              <FormField label="Last name" scope={form.scope("lastName")} placeholder="Jones" />
              <FormField required label="Username" scope={form.scope("username")} placeholder="sally@alliance436.org" />
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
                  <SubmitButton isSubmitting={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
                    Create
                  </SubmitButton>
                  <Button type="reset" variant="outline">
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
