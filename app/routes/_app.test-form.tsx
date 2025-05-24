import { useForm } from "@rvf/react-router";
import { z } from "zod/v4";

import { FormField } from "~/components/ui/form";

const schema = z.object({
  firstName: z.string().min(1, { error: "First name is required" }),
});

export default function TestForm() {
  const form = useForm({
    schema,
    defaultValues: {
      firstName: "",
    },
  });

  return (
    <form {...form.getFormProps()} className="max-w-md">
      <FormField scope={form.scope("firstName")} label="First Name" />
    </form>
  );
}
