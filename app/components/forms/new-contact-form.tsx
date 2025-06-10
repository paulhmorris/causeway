import { useForm } from "@rvf/react-router";
import { useState } from "react";
import { useLocation } from "react-router";
import { z } from "zod/v4";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { ContactType } from "~/lib/constants";
import { cuid, number, optionalEmail, optionalPhoneNumber, optionalText, text } from "~/schemas/fields";

export const AddressSchema = z.object({
  street: text,
  street2: optionalText,
  city: text,
  state: text,
  zip: text,
  country: text,
});

export const newContactSchema = z.object({
  firstName: optionalText,
  lastName: optionalText,
  organizationName: optionalText,
  email: optionalEmail,
  alternateEmail: optionalEmail,
  phone: optionalPhoneNumber,
  alternatePhone: optionalPhoneNumber,
  typeId: number.pipe(z.enum(ContactType)),
  address: AddressSchema.optional(),
  assignedUserIds: z.array(cuid).optional(),
});

type Props = {
  user: ReturnType<typeof useUser>;
  contactTypes: Array<{
    id: number;
    name: string;
  }>;
  usersWhoCanBeAssigned: Array<{
    id: string;
    contact: {
      firstName: string | null;
      lastName: string | null;
      email: string | null;
    };
  }>;
};

export function NewContactForm({ user, contactTypes, usersWhoCanBeAssigned }: Props) {
  const location = useLocation();
  const [addressEnabled, setAddressEnabled] = useState(false);
  const shouldDisableTypeSelection = user.isMember && location.pathname.includes(user.contactId);

  const form = useForm({
    schema: newContactSchema,
    method: "put",
    defaultValues: {
      phone: "",
      email: "",
      lastName: "",
      firstName: "",
      alternateEmail: "",
      alternatePhone: "",
      organizationName: "",
      assignedUserIds: [],
      typeId: "",
      address: undefined,
    },
  });

  return (
    <form {...form.getFormProps()} className="space-y-4 sm:max-w-md">
      <>
        <div className="flex items-start gap-2">
          <FormField label="First name" id="firstName" scope={form.scope("firstName")} placeholder="Joe" required />
          <FormField label="Last name" id="lastName" scope={form.scope("lastName")} placeholder="Donor" />
        </div>
        <FormField label="Email" id="email" scope={form.scope("email")} placeholder="joe@donor.com" />
        <FormField
          label="Alternate Email"
          id="email"
          scope={form.scope("alternateEmail")}
          placeholder="joe2@donor.com"
        />
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
      {!addressEnabled ? (
        <Button type="button" variant="outline" onClick={() => setAddressEnabled(true)}>
          Add Address
        </Button>
      ) : (
        <>
          <Button type="button" variant="outline" onClick={() => setAddressEnabled(false)}>
            Remove Address
          </Button>
          <fieldset className="space-y-4">
            <FormField label="Street 1" placeholder="1234 Main St." scope={form.scope("address.street")} required />
            <div className="flex items-start gap-2">
              <FormField label="Street 2" placeholder="Apt 4" scope={form.scope("address.street2")} />
              <FormField label="City" placeholder="Richardson" scope={form.scope("address.city")} required />
            </div>
            <div className="grid grid-cols-2 items-start gap-2 md:grid-cols-12">
              <div className="col-span-6">
                <FormField label="State / Province" placeholder="TX" scope={form.scope("address.state")} required />
              </div>
              <div className="col-span-1 w-full sm:col-span-3">
                <FormField label="Postal Code" placeholder="75080" scope={form.scope("address.zip")} required />
              </div>
              <div className="col-span-1 w-full sm:col-span-3">
                <FormField
                  label="Country"
                  placeholder="US"
                  scope={form.scope("address.country")}
                  required
                  defaultValue="US"
                />
              </div>
            </div>
          </fieldset>
        </>
      )}
      <Separator className="my-4" />
      <fieldset>
        <legend className="text-muted-foreground mb-4 text-sm">
          Assigned users will receive regular reminders to engage with this Contact.
        </legend>
        <div className="flex flex-col gap-2">
          {usersWhoCanBeAssigned.map((u) => {
            return (
              <Label key={u.id} className="inline-flex cursor-pointer items-center gap-2">
                <Checkbox
                  name="assignedUserIds"
                  value={u.id}
                  aria-label={`${u.contact.firstName} ${u.contact.lastName}`}
                  defaultChecked={user.isMember ? u.id === user.id : false}
                />
                <span>
                  {u.contact.firstName} {u.contact.lastName}
                </span>
              </Label>
            );
          })}
        </div>
      </fieldset>
      <Separator className="my-4" />
      <div className="flex items-center gap-2">
        <SubmitButton isSubmitting={form.formState.isSubmitting}>Create Contact</SubmitButton>
        <Button type="reset" variant="ghost">
          Reset
        </Button>
      </div>
    </form>
  );
}
