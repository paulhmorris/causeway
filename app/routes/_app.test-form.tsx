import { parseFormData, useForm } from "@rvf/react-router";
import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";

import { FormCheckbox, FormField, FormTextarea, UncontrolledCheckbox } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { Toasts } from "~/lib/toast.server";
import { optionalCheckbox, optionalCheckboxGroup, optionalLongText, text } from "~/schemas/fields";

const checkboxItems = [
  { value: "1", label: "Checkbox 1" },
  { value: "2", label: "Checkbox 2" },
  { value: "3", label: "Checkbox 3" },
  { value: "4", label: "Checkbox 4" },
];

const schema = z.object({
  firstName: text,
  textArea: optionalLongText,
  checkboxGroup: optionalCheckboxGroup,
  isActive: optionalCheckbox,
});

export async function action({ request }: ActionFunctionArgs) {
  const submission = await parseFormData(request, schema);
  if (submission.error) {
    return Toasts.dataWithError(submission.error, {
      message: "Form submission failed",
      description: JSON.stringify(submission.error.fieldErrors, null, 2),
    });
  }

  return Toasts.dataWithInfo(null, {
    message: "Form submitted",
    description: JSON.stringify(submission.submittedData, null, 2),
  });
}

export default function TestForm() {
  const form = useForm({
    method: "post",
    schema,
    defaultValues: {
      firstName: "",
      textArea: "",
      isActive: false,
      checkboxGroup: [],
    },
  });

  return (
    <form {...form.getFormProps()} className="max-w-md">
      <FormField description="hello" scope={form.scope("firstName")} label="First Name" />
      <FormTextarea scope={form.scope("textArea")} label="Text Area" />
      <div className="mt-2"></div>
      <FormCheckbox label="Test checkbox" scope={form.scope("isActive")} />
      <fieldset className="mt-2">
        <legend>Checkbox group</legend>
        <div className="mt-2 flex flex-col gap-2">
          {checkboxItems.map((i) => (
            <UncontrolledCheckbox key={i.value} label={i.label} value={i.value} name="checkboxGroup" />
          ))}
        </div>
      </fieldset>
      <div className="mt-8"></div>
      <SubmitButton isSubmitting={form.formState.isSubmitting}>Save</SubmitButton>
      <pre className="mt-4 rounded border bg-gray-100 p-4 text-xs whitespace-pre-wrap">
        <code>{JSON.stringify(form.value(), null, 2)}</code>
      </pre>
      {form.error() ? (
        <pre className="mt-4 rounded border bg-red-100 p-4 text-xs whitespace-pre-wrap">
          <code>{JSON.stringify(form.error(), null, 2)}</code>
        </pre>
      ) : null}
    </form>
  );
}
