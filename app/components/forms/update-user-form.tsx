import { MembershipRole, UserRole } from "@prisma/client";
import { ValidatedForm } from "@rvf/react-router";
import { useRouteLoaderData } from "react-router";
import { z } from "zod/v4";

import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { loader } from "~/routes/_app.users.$userId";
import { cuid, email, optionalSelect, selectEnum, text } from "~/schemas/fields";

export const updateUserSchema = z.object({
  id: cuid,
  firstName: text,
  lastName: text,
  username: email,
  role: selectEnum(UserRole),
  accountId: optionalSelect.transform((v) => (v === "Select an account" ? undefined : v)),
  subscribedAccountIds: z.array(z.string()).optional(),
});

export function UpdateUserForm() {
  const layoutData = useRouteLoaderData<typeof loader>("routes/_app.users.$userId");
  const authorizedUser = useUser();

  if (!layoutData) {
    throw new Error("Update User Form must be used within the User ID layout");
  }
  const { user, accounts, accountsThatCanBeSubscribedTo } = layoutData;

  const isYou = authorizedUser.id === user.id;

  return (
    <ValidatedForm
      method="post"
      schema={updateUserSchema}
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
              <FormField required label="First name" scope={form.scope("firstName")} />
              <FormField label="Last name" scope={form.scope("lastName")} />
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
              {accountsThatCanBeSubscribedTo.map((a) => {
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
  );
}
