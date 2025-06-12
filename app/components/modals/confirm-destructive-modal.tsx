import { IconAlertTriangleFilled } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { SubmitButton } from "~/components/ui/submit-button";

export function ConfirmDestructiveModal({ description }: { description: string }) {
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
        type="submit"
        name="_action"
        value="delete"
        className="hover:border-destructive hover:bg-destructive hover:text-destructive-foreground w-min"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <DrawerDialog
        open={open}
        setOpen={setOpen}
        title="Are you absolutely sure?"
        description={description}
        icon={<IconAlertTriangleFilled className="text-destructive size-8" />}
      >
        <DrawerDialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" type="submit" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <fetcher.Form method="delete">
            <SubmitButton
              className="w-full sm:w-auto"
              variant="destructive"
              name="_action"
              value="delete"
              isSubmitting={isSubmitting}
            >
              Confirm
            </SubmitButton>
          </fetcher.Form>
        </DrawerDialogFooter>
      </DrawerDialog>
    </>
  );
}
