import { FormScope, useFormScope } from "@rvf/react-router";
import { z } from "zod/v4";

import { AddressSchema } from "~/components/forms/new-contact-form";
import { FormField } from "~/components/ui/form";

export function AddressFields({ scope }: { scope: FormScope<z.infer<typeof AddressSchema>> }) {
  const form = useFormScope(scope);

  return (
    <fieldset className="space-y-4">
      <FormField label="Street 1" placeholder="1234 Main St." scope={form.scope("street")} required />
      <div className="flex items-start gap-2">
        <FormField label="Street 2" placeholder="Apt 4" scope={form.scope("street2")} />
        <FormField label="City" placeholder="Richardson" scope={form.scope("city")} required />
      </div>
      <div className="grid grid-cols-2 items-start gap-2 md:grid-cols-12">
        <div className="col-span-6">
          <FormField label="State / Province" placeholder="TX" scope={form.scope("state")} required />
        </div>
        <div className="col-span-1 w-full sm:col-span-3">
          <FormField label="Postal Code" placeholder="75080" scope={form.scope("zip")} required />
        </div>
        <div className="col-span-1 w-full sm:col-span-3">
          <FormField label="Country" placeholder="US" scope={form.scope("country")} required defaultValue="US" />
        </div>
      </div>
    </fieldset>
  );
}
