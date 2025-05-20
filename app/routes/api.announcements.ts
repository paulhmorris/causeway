import { Prisma } from "@prisma/client";
import { ActionFunctionArgs } from "@remix-run/node";
import { withZod } from "@remix-validated-form/with-zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { validationError } from "remix-validated-form";
import { z } from "zod";
import { zfd } from "zod-form-data";
dayjs.extend(utc);

import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { getPrismaErrorText } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export const validator = withZod(
  z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal("create"),
      title: z.string(),
      content: z.string(),
      expiresAt: zfd.text(z.coerce.date().optional()),
    }),
    z.object({
      intent: z.literal("update"),
      id: z.coerce.number(),
      title: z.string(),
      content: z.string(),
      expiresAt: zfd.text(z.coerce.date().optional()),
    }),
    z.object({
      intent: z.literal("expire"),
      id: z.coerce.number(),
    }),
  ]),
);

export async function action({ request }: ActionFunctionArgs) {
  await SessionService.requireAdmin(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await validator.validate(await request.formData());
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
      return Toasts.jsonWithSuccess(
        { success: true },
        {
          title: "Announcement Created",
          description: `The announcement is now visible to all users and admins${announcement.expiresAt ? " and will expire at " + dayjs(announcement.expiresAt).utc().format("M/D/YY h:mm a") : "."}`,
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
      return Toasts.jsonWithSuccess(
        { success: true },
        {
          title: "Announcement Updated",
          description: `The announcement is now visible to all users and admins${announcement.expiresAt ? " and will expire at " + dayjs(announcement.expiresAt).utc().format("M/D/YY h:mm a") : "."}`,
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
      return Toasts.jsonWithInfo(
        { success: true },
        { title: "Announcement Expired", description: "The announcement is no longer visible to users or admins." },
      );
    }
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return Toasts.jsonWithError({ success: false }, { title: "Error", description: getPrismaErrorText(error) });
    }
  }
}
