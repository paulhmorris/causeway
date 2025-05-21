import { Announcement } from "@prisma/client";
import { ValidatedForm } from "@rvf/react-router";
import { IconBellFilled, IconClock, IconSelector } from "@tabler/icons-react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useFetcher } from "react-router";
dayjs.extend(utc);

import { AnnouncementModal } from "~/components/modals/announcement-modal";
import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Separator } from "~/components/ui/separator";
import { useUser } from "~/hooks/useUser";
import { validator } from "~/routes/api.announcements";

export function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const user = useUser();
  const fetcher = useFetcher<{ success: boolean }>();
  const isSubmitting = fetcher.state !== "idle";

  return (
    <>
      <Collapsible
        defaultOpen={true}
        className="border-primary/50 bg-primary/5 text-foreground flex flex-col items-start rounded-md border p-3 text-sm"
      >
        <div className="mb-3 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="sr-only">An announcement from your administration.</span>
            <IconBellFilled className="text-primary size-6" />
          </div>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon">
              <IconSelector className="size-6" />
              <span className="sr-only">Toggle content</span>
            </Button>
          </CollapsibleTrigger>
        </div>
        {!user.isMember ? (
          <>
            <span className="text-muted-foreground text-xs">
              {announcement.expiresAt
                ? `Expires ${dayjs(announcement.expiresAt).utc().format("MM/DD/YY h:mm a")}`
                : "Never expires"}
            </span>
            <ValidatedForm
              method="post"
              action="/api/announcements"
              fetcher={fetcher}
              validator={validator}
              className="my-2 flex items-center gap-2"
            >
              <input type="hidden" name="id" value={announcement.id} />
              <AnnouncementModal intent="update" announcement={announcement} />
              <Button
                variant="outline"
                size="sm"
                name="intent"
                value="expire"
                className="hover:border-destructive hover:bg-destructive hover:text-destructive-foreground"
                type="submit"
                disabled={isSubmitting}
              >
                <IconClock className="size-4" />
                <span>Expire Now</span>
              </Button>
            </ValidatedForm>
            <Separator className="my-2" />
          </>
        ) : null}
        <span className="mb-1 block text-lg font-bold">{announcement.title}</span>
        <CollapsibleContent>{announcement.content}</CollapsibleContent>
      </Collapsible>
    </>
  );
}
