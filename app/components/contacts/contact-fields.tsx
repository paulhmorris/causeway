import { ContactType } from "@prisma/client";
import { FormScope, useFormScope } from "@rvf/react-router";
import { useLocation } from "react-router";
import { z } from "zod";

import { FormField, FormSelect } from "~/components/ui/form";
import { useUser } from "~/hooks/useUser";
import { NewContactSchema } from "~/models/schemas";

export function ContactFields({
  contactTypes,
  scope,
}: {
  contactTypes: Array<ContactType>;
  scope: FormScope<z.infer<typeof NewContactSchema>>;
}) {
  const user = useUser();
  const location = useLocation();
  const form = useFormScope(scope);
  const shouldDisableTypeSelection = user.isMember && location.pathname.includes(user.contactId);

  return (
    <>
      <div className="flex items-start gap-2">
        <FormField label="First name" id="firstName" scope={form.scope("firstName")} placeholder="Joe" required />
        <FormField label="Last name" id="lastName" scope={form.scope("lastName")} placeholder="Donor" />
      </div>
      <FormField label="Email" id="email" scope={form.scope("email")} placeholder="joe@donor.com" />
      <FormField label="Alternate Email" id="email" scope={form.scope("alternateEmail")} placeholder="joe2@donor.com" />
      <FormField
        label="Phone"
        id="phone"
        scope={form.scope("phone")}
        placeholder="8885909724"
        inputMode="numeric"
        maxLength={10}
      />
      <FormField
        label="Alternate Phone"
        id="phone"
        scope={form.scope("alternatePhone")}
        placeholder="8885909724"
        inputMode="numeric"
        maxLength={10}
      />
      <FormSelect
        required
        disabled={shouldDisableTypeSelection}
        label="Type"
        scope={form.scope("typeId")}
        placeholder="Select type"
        options={contactTypes.map((ct) => ({
          label: ct.name,
          value: ct.id,
        }))}
      />
      <FormField
        label="Organization Name"
        scope={form.scope("organizationName")}
        description="Required if type is Organization"
      />
    </>
  );
}
