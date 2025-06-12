import { type Contact, type ContactType as PContactType } from "@prisma/client";
import { FormScope } from "@rvf/react-router";

import { FormSelect, FormSelectProps } from "~/components/ui/form";
import { SelectGroup, SelectItem, SelectLabel } from "~/components/ui/select";
import { ContactType } from "~/lib/constants";

export function ContactDropdown(
  props: {
    scope: FormScope<string | undefined>;
    types: Array<PContactType>;
    contacts: Array<Contact>;
  } & Omit<FormSelectProps, "name" | "placeholder" | "scope">,
) {
  const { types, contacts, label, scope, ...rest } = props;
  return (
    <FormSelect scope={scope} label={label} placeholder="Select contact" {...rest}>
      {types
        .filter((t) => contacts.some((c) => c.typeId === t.id))
        .map((type) => {
          return (
            <SelectGroup key={type.name}>
              <SelectLabel>{type.name}</SelectLabel>
              {contacts
                .filter((c) => c.typeId === type.id)
                .map((c) => {
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.typeId === ContactType.Organization ? `${c.organizationName}` : `${c.firstName} ${c.lastName}`}
                    </SelectItem>
                  );
                })}
            </SelectGroup>
          );
        })}
    </FormSelect>
  );
}
