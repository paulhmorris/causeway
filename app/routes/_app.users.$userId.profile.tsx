import { MembershipRole, UserRole } from "@prisma/client";
import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs } from "react-router";
import { Link, useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { ErrorComponent } from "~/components/error-component";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { loader } from "~/routes/_app.users.$userId";
import { cuid, email, optionalSelect, text } from "~/schemas/fields";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  id: cuid,
  firstName: text,
  lastName: text,
  username: email,
  role: z.enum(UserRole),
  accountId: optionalSelect.transform((v) => (v === "Select an account" ? undefined : v)),
  subscribedAccountIds: z.array(z.string()).optional(),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  const authorizedUser = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  const { username, role, id, accountId, subscribedAccountIds, ...contact } = result.data;

  const userToBeUpdated = await db.user.findUnique({ where: { id } });
  if (!userToBeUpdated) {
    throw notFound({ message: "User not found" });
  }

  if (authorizedUser.isMember) {
    // Users can only edit themselves
    if (authorizedUser.id !== id) {
      return Toasts.dataWithWarning(
        null,
        { message: "Permission denied", description: "You do not have permission to edit this user." },
        { status: 403 },
      );
    }

    // Users can't edit their role, username, or assigned account
    if (
      role !== userToBeUpdated.role ||
      username !== userToBeUpdated.username ||
      accountId !== userToBeUpdated.accountId
    ) {
      return Toasts.dataWithWarning(
        null,
        { message: "Permission denied", description: "You do not have permission to edit this field." },
        { status: 403 },
      );
    }
  }

  if (authorizedUser.systemRole !== UserRole.SUPERADMIN && role === UserRole.SUPERADMIN) {
    return Toasts.dataWithWarning(
      null,
      { message: "Permission denied", description: "You do not have permission to create a Super Admin." },
      { status: 403 },
    );
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
    throw new Error("Missing layout data");
  }

  const { user, accounts } = layoutData;
  const isYou = authorizedUser.id === user.id;

  return (
    <>
      <ValidatedForm
        method="post"
        schema={schema}
        defaultValues={{
          id: user.id,
          role: user.role,
          username: user.username,
          accountId: user.account?.id ?? "",
          lastName: user.contact.lastName ?? "",
          firstName: user.contact.firstName ?? "",
          subscribedAccountIds: user.contact.accountSubscriptions.map((a) => a.accountId),
        }}
      >
        {(form) => (
          <>
            <div className="space-y-4 sm:max-w-md">
              <div className="flex gap-2">
                <FormField label="First name" scope={form.scope("firstName")} required />
                <FormField label="Last name" scope={form.scope("lastName")} required />
              </div>
              <input type="hidden" name="id" value={user.id} />
              {!authorizedUser.isMember ? (
                <>
                  <FormField
                    label="Username"
                    scope={form.scope("username")}
                    disabled={authorizedUser.role === MembershipRole.MEMBER}
                    required
                  />
                  <FormSelect
                    required
                    disabled={isYou}
                    description={isYou ? "You cannot edit your own role." : ""}
                    scope={form.scope("role")}
                    label="Role"
                    placeholder="Select a role"
                  >
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    {authorizedUser.isSuperAdmin ? <SelectItem value="SUPERADMIN">Super Admin</SelectItem> : null}
                  </FormSelect>
                </>
              ) : (
                <>
                  <input type="hidden" name="username" value={user.username} />
                  <input type="hidden" name="role" value={user.role} />
                </>
              )}
              {!authorizedUser.isMember ? (
                <FormSelect
                  scope={form.scope("accountId")}
                  label="Linked Account"
                  placeholder="Select an account"
                  defaultValue={user.account?.id}
                  description="Link this user to an account. They will be able to see this account and all related transactions."
                  options={accounts.map((a) => ({ label: `${a.code} - ${a.description}`, value: a.id }))}
                />
              ) : (
                <input type="hidden" name="accountId" value={user.account?.id} />
              )}
            </div>
            <fieldset className="mt-4 sm:max-w-2xl">
              <legend className="text-sm font-medium">
                Account Subscriptions <span className="text-muted-foreground text-xs">(optional)</span>
              </legend>
              <p className="text-muted-foreground text-sm">
                Users can be subscribed to another account. When they log in, they will see it on their dashboard.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {layoutData.accountsThatCanBeSubscribedTo.map((a) => {
                  return (
                    <Label key={a.id} className="inline-flex cursor-pointer items-center gap-2">
                      <Checkbox
                        name="subscribedAccountIds"
                        value={a.id}
                        defaultChecked={user.contact.accountSubscriptions.some((acc) => acc.accountId === a.id)}
                      />
                      <span>
                        {a.code} - {a.description}
                      </span>
                    </Label>
                  );
                })}
              </div>
            </fieldset>
            <ButtonGroup className="mt-4">
              <SubmitButton isSubmitting={form.formState.isSubmitting}>Save</SubmitButton>
              <Button type="reset" variant="ghost">
                Reset
              </Button>
            </ButtonGroup>
          </>
        )}
      </ValidatedForm>
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
                    <Link to={`/contacts/${a.contactId}`} className="text-primary text-sm font-medium">
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
