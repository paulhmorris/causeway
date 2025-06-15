import { ValidatedForm } from "@rvf/react-router";
import { z } from "zod/v4";

import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { optionalText, text } from "~/schemas/fields";

export const orgSettingsSchema = z.object({
  name: text,
  primaryEmail: optionalText,
});

type Props = {
  org: {
    name: string;
    primaryEmail: string | null;
  };
};

export function OrgSettingsForm({ org }: Props) {
  return (
    <ValidatedForm
      schema={orgSettingsSchema}
      defaultValues={{
        name: org.name,
        primaryEmail: org.primaryEmail ?? "",
      }}
      className="space-y-4 sm:max-w-md"
      method="post"
    >
      {(form) => (
        <>
          <div className="space-y-2">
            <FormField required label="Organization Name" scope={form.scope("name")} defaultValue={org.name} />
            <FormField
              label="Administrator Email"
              scope={form.scope("primaryEmail")}
              description="Receives all email communications"
            />
          </div>
          <ButtonGroup>
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
