import { ContactType } from "@prisma/client";
import { useLocation } from "react-router";

import { FormField, FormSelect } from "~/components/ui/form";
import { useUser } from "~/hooks/useUser";

export function ContactFields({ contactTypes }: { contactTypes: Array<ContactType> }) {
  const user = useUser();
  const location = useLocation();
  const shouldDisableTypeSelection = user.isMember && location.pathname.includes(user.contactId);

  return (
    <>
      <div className="flex items-start gap-2">
        <FormField label="First name" id="firstName" name="firstName" placeholder="Joe" required />
        <FormField label="Last name" id="lastName" name="lastName" placeholder="Donor" />
      </div>
      <FormField label="Email" id="email" name="email" placeholder="joe@donor.com" />
      <FormField label="Alternate Email" id="email" name="alternateEmail" placeholder="joe2@donor.com" />
      <FormField label="Phone" id="phone" name="phone" placeholder="8885909724" inputMode="numeric" maxLength={10} />
      <FormField
        label="Alternate Phone"
        id="phone"
        name="alternatePhone"
        placeholder="8885909724"
        inputMode="numeric"
        maxLength={10}
      />
      <FormSelect
        required
        disabled={shouldDisableTypeSelection}
        label="Type"
        name="typeId"
        placeholder="Select type"
        options={contactTypes.map((ct) => ({
          label: ct.name,
          value: ct.id,
        }))}
      />
      <FormField label="Organization Name" name="organizationName" description="Required if type is Organization" />
    </>
  );
}
