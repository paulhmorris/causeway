import { Announcement } from "@prisma/client";
import { FormScope, ValidatedForm } from "@rvf/react-router";
import { IconLoader, IconPlus } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { FormField, FormTextarea } from "~/components/ui/form";
import { schema } from "~/routes/api.announcements";

type Props = {
  intent: "create" | "update";
  announcement?: Pick<Announcement, "id" | "title" | "content" | "expiresAt">;
};

export function AnnouncementModal({ intent, announcement }: Props) {
  const [open, setOpen] = useState(false);
  const fetcher = useFetcher<{ success: boolean }>();
  const isSubmitting = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.data && !isSubmitting && fetcher.data.success) {
      setOpen(false);
    }
  }, [fetcher.data, isSubmitting]);

  return (
    <>
      <Button
        type="button"
        size={intent === "update" ? "sm" : "default"}
        variant="outline"
        onClick={() => setOpen(true)}
      >
        {intent === "create" ? <IconPlus className="size-4" /> : null}
        <span>{intent === "update" ? "Edit" : "New Announcement"}</span>
      </Button>
      <DrawerDialog
        title={intent === "update" ? "Edit Announcement" : "New Announcement"}
        open={open}
        setOpen={setOpen}
      >
        <ValidatedForm
          method="post"
          action="/api/announcements"
          schema={schema}
          fetcher={fetcher}
          className="space-y-4"
          defaultValues={{
            intent: "update",
            id: announcement?.id,
            title: intent === "update" ? (announcement?.title ?? "") : "",
            content: intent === "update" ? (announcement?.content ?? "") : "",
            expiresAt:
              intent === "update"
                ? announcement?.expiresAt
                  ? dayjs(announcement.expiresAt).format("YYYY-MM-DD")
                  : ""
                : "",
          }}
        >
          {(form) => (
            <>
              <input type="hidden" name="id" value={announcement?.id} />
              <FormField label="Title" scope={form.scope("title")} required />
              <FormTextarea label="Content" scope={form.scope("content")} required />
              <FormField
                label="Expires"
                scope={form.scope("expiresAt") as FormScope<string>}
                type="date"
                description="Will disappear after midnight on this day"
                min={dayjs().format("YYYY-MM-DD")}
              />
              <DrawerDialogFooter className="mt-4">
                <Button variant="outline" type="submit" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" name="intent" value={intent} disabled={isSubmitting}>
                  {isSubmitting ? <IconLoader className="size-4 animate-spin" /> : null}
                  <span>Submit</span>
                </Button>
              </DrawerDialogFooter>
            </>
          )}
        </ValidatedForm>
      </DrawerDialog>
    </>
  );
}
