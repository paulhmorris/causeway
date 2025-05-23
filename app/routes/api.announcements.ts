import { parseFormData, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ActionFunctionArgs } from "react-router";
import { z } from "zod/v4";
dayjs.extend(utc);

import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal("create"),
    id: z.never(),
    title: z.string(),
    content: z.string(),
    expiresAt: z.coerce.date().optional(),
  }),
  z.object({
    intent: z.literal("update"),
    id: z.coerce.number(),
    title: z.string(),
    content: z.string(),
    expiresAt: z.coerce.date().optional(),
  }),
  z.object({
    intent: z.literal("expire"),
    id: z.coerce.number(),
    title: z.never(),
    content: z.never(),
    expiresAt: z.never(),
  }),
]);

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    if (result.data.intent === "create") {
      const { title, content, expiresAt } = result.data;
      const expiry = expiresAt ? dayjs(expiresAt).utc().endOf("day") : undefined;
      const endOfToday = dayjs().utc().endOf("day");

      if (expiry?.isBefore(endOfToday)) {
        return validationError({
          fieldErrors: {
            expiresAt: "The expiration date must be in the future.",
          },
        });
      }

      const announcement = await db.announcement.create({
        data: {
          orgId,
          title,
          content,
          expiresAt: expiry?.toDate(),
        },
      });
      return Toasts.dataWithSuccess(
        { success: true },
        {
          message: "Announcement Created",
          description: `The announcement is now visible to all users and admins${announcement.expiresAt ? " and will expire on " + dayjs(announcement.expiresAt).utc().format("M/D/YY h:mm a") : "."}`,
        },
      );
    }

    if (result.data.intent === "update") {
      const { id, title, content, expiresAt } = result.data;
      const expiry = expiresAt ? dayjs(expiresAt).utc().endOf("day") : undefined;
      const endOfToday = dayjs().utc().endOf("day");

      if (expiry?.isBefore(endOfToday)) {
        return validationError({
          fieldErrors: {
            expiresAt: "The expiration date must be in the future.",
          },
        });
      }

      const announcement = await db.announcement.update({
        where: { id, orgId },
        data: {
          title,
          content,
          expiresAt: expiry ? expiry.toDate() : null,
        },
      });
      return Toasts.dataWithSuccess(
        { success: true },
        {
          message: "Announcement Updated",
          description: `The announcement is now visible to all users and admins${announcement.expiresAt ? " and will expire on " + dayjs(announcement.expiresAt).utc().format("M/D/YY h:mm a") : "."}`,
        },
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (result.data.intent === "expire") {
      const { id } = result.data;
      await db.announcement.update({
        where: { id, orgId },
        data: {
          expiresAt: dayjs().subtract(7, "day").toDate(),
        },
      });
      return Toasts.dataWithSuccess(
        { success: true },
        { message: "Announcement Expired", description: "The announcement is no longer visible to users or admins." },
      );
    }
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError({ success: false }, { message: "An unknown error occurred." });
  }
}
