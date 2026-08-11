import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { JSX, useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { SubmitButton } from "~/components/ui/submit-button";

type Props = {
  description: string;
  triggerLabel?: string;
  triggerIcon?: JSX.Element;
  confirmLabel?: string;
  method?: "post" | "delete";
  /** Value submitted as `_action`. */
  actionValue?: string;
  /** Extra hidden fields submitted with the confirmation. */
  fields?: Record<string, string>;
};

export function ConfirmDestructiveModal({
  description,
  triggerLabel = "Delete",
  triggerIcon,
  confirmLabel = "Confirm",
  method = "delete",
  actionValue = "delete",
  fields,
}: Props) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher();
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data && !isSubmitting) {
      setOpen(false);
    }
  }, [fetcher.data, isSubmitting]);

  return (
    <>
      <Button
        variant="outline"
        type="button"
        className="hover:border-destructive hover:bg-destructive hover:text-destructive-foreground w-min"
        onClick={() => setOpen(true)}
      >
        {triggerIcon}
        {triggerLabel}
      </Button>
      <DrawerDialog
        open={open}
        setOpen={setOpen}
        title="Are you absolutely sure?"
        description={description}
        icon={<IconAlertTriangleFilled className="text-destructive size-8" />}
      >
        <DrawerDialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" type="button" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <fetcher.Form method={method}>
            {Object.entries(fields ?? {}).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <SubmitButton
              className="w-full sm:w-auto"
              variant="destructive"
              name="_action"
              value={actionValue}
              isSubmitting={isSubmitting}
            >
              {confirmLabel}
            </SubmitButton>
          </fetcher.Form>
        </DrawerDialogFooter>
      </DrawerDialog>
    </>
  );
}
