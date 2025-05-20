import { useFetcher } from "react-router";
import { IconAlertTriangleFilled, IconLoader } from "@tabler/icons-react";
import { useEffect, useState } from "react";

import { Button } from "~/components/ui/button";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";

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
        className="w-min hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
        onClick={() => setOpen(true)}
      >
        Delete
      </Button>
      <DrawerDialog
        open={open}
        setOpen={setOpen}
        title="Are you absolutely sure?"
        description={description}
        icon={<IconAlertTriangleFilled className="mb-2 h-8 w-8 self-center text-destructive" />}
      >
        <DrawerDialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" type="submit" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <fetcher.Form method="delete">
            <Button
              className="w-full sm:w-auto"
              variant="destructive"
              name="_action"
              value="delete"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
              <span>Confirm</span>
            </Button>
          </fetcher.Form>
        </DrawerDialogFooter>
      </DrawerDialog>
    </>
  );
}
