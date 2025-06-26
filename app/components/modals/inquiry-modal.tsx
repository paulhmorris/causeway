import { ValidatedForm } from "@rvf/react-router";
import { IconLoader } from "@tabler/icons-react";
import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useIsClient } from "usehooks-ts";

import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { DrawerDialog } from "~/components/ui/drawer-dialog";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SelectItem } from "~/components/ui/select";
import { useUser } from "~/hooks/useUser";
import { schema } from "~/routes/api.inquiries";

export function NewInquiryModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const user = useUser();
  const fetcher = useFetcher<{ success: boolean }>();
  const isSubmitting = fetcher.state !== "idle";
  const isClient = useIsClient();

  useEffect(() => {
    if (fetcher.data && !isSubmitting && fetcher.data.success) {
      onOpenChange(false);
    }
  }, [fetcher.data, isSubmitting, onOpenChange]);

  if (!isClient) {
    return null;
  }

  return (
    <DrawerDialog
      title="Ask a question"
      description="Your message will be sent to an administrator"
      open={open}
      setOpen={onOpenChange}
    >
      <ValidatedForm
        method="post"
        action="/api/inquiries"
        fetcher={fetcher}
        schema={schema}
        defaultValues={{
          name: `${user.contact.firstName} ${user.contact.lastName}`,
          email: user.username,
          method: "Email",
          phone: "",
          otherMethod: "",
          message: "",
        }}
      >
        {(form) => (
          <>
            <div className="space-y-4">
              <FormField scope={form.scope("name")} label="Name" required />
              <FormSelect scope={form.scope("method")} label="Contact Method" placeholder="Select method" required>
                <SelectItem value="Phone">Phone</SelectItem>
                <SelectItem value="Email">Email</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                <SelectItem value="Signal">Signal</SelectItem>
                <SelectItem value="Other">Other (please specify)</SelectItem>
              </FormSelect>
              <FormField scope={form.scope("otherMethod")} label="Other Method" />
              <FormField scope={form.scope("email")} label="Email" />
              <FormField scope={form.scope("phone")} label="Phone" />
              <FormTextarea scope={form.scope("message")} label="Message" maxLength={1000} rows={5} required />
            </div>
            <DialogFooter className="mt-4 gap-2 sm:space-x-0">
              <Button variant="outline" type="submit" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
                <span>Submit</span>
              </Button>
            </DialogFooter>
          </>
        )}
      </ValidatedForm>
    </DrawerDialog>
  );
}
