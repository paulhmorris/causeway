import { MembershipRole, UserRole } from "@prisma/client";
import { ValidatedForm } from "@rvf/react-router";
import { z } from "zod/v4";

import { Button } from "~/components/ui/button";
import { FormField, FormSelect } from "~/components/ui/form";
import { SelectItem } from "~/components/ui/select";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { ContactType } from "~/lib/constants";
import { email, number, optionalSelect, optionalText, selectEnum, text } from "~/schemas/fields";

type Props = {
  contactTypes: Array<{
    id: number;
    name: string;
  }>;
  accounts: Array<{
    id: string;
    code: string;
    description: string;
  }>;
};

export const newUserSchema = z.object({
  firstName: text,
  lastName: optionalText,
  username: email,
  role: selectEnum(MembershipRole),
  systemRole: selectEnum(UserRole),
  typeId: number.pipe(selectEnum(ContactType)),
  accountId: optionalSelect.transform((v) => (v === "Select an account" ? undefined : v)),
});

export function NewUserForm({ accounts, contactTypes }: Props) {
  const user = useUser();

  return (
    <ValidatedForm
      schema={newUserSchema}
      defaultValues={{
        firstName: "",
        lastName: "",
        username: "",
        typeId: "",
        accountId: "",
        role: MembershipRole.MEMBER,
        systemRole: UserRole.USER,
      }}
      method="post"
      className="space-y-4 sm:max-w-md"
      noValidate
    >
      {(form) => (
        <>
          <FormField label="First name" scope={form.scope("firstName")} placeholder="Sally" required />
          <FormField label="Last name" scope={form.scope("lastName")} placeholder="Jones" />
          <FormField required label="Username" scope={form.scope("username")} placeholder="sally@teamcauseway.org" />
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
          <FormSelect required scope={form.scope("role")} label="Organization Role" placeholder="Select an org role">
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
          <div className="flex items-center gap-2">
            <SubmitButton isSubmitting={form.formState.isSubmitting}>Invite</SubmitButton>
            <Button type="reset" variant="ghost">
              Reset
            </Button>
          </div>
        </>
      )}
    </ValidatedForm>
  );
}
