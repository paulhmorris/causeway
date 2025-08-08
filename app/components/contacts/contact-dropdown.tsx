import { type Contact, type ContactType as PContactType } from "@prisma/client";
import { FormScope } from "@rvf/react-router";

import { FormCombobox, FormSelectProps } from "~/components/ui/form";
import { ContactType } from "~/lib/constants";

export function ContactDropdown(
  props: {
    scope: FormScope<string | undefined>;
    types: Array<PContactType>;
    contacts: Array<Contact>;
  } & Omit<FormSelectProps, "name" | "placeholder" | "scope">,
) {
  const { contacts, label, scope } = props;
  return (
    <FormCombobox
      label={label}
      scope={scope}
      options={contacts.map((c) => ({
        value: c.id,
        label: c.typeId === ContactType.Organization ? c.organizationName : `${c.firstName} ${c.lastName ?? ""}`,
      }))}
    />
  );
}
