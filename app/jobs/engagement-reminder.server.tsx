// TODO: This needs to be updated for multi-tenancy, in the case that a user has multiple orgs they should probably receive multiple emails per org.
import { render } from "@react-email/render";
import { logger, schedules } from "@trigger.dev/sdk/v3";

import { EngagementReminderEmail } from "emails/engagement-reminder";
import { SendEmailInput, sendEmail } from "~/integrations/email.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { constructOrgMailFrom } from "~/lib/utils";

const DAYS_CUTOFF = 30;

export const reminderTask = schedules.task({
  id: "engagement-reminder",
  retry: {},
  run: async () => {
    const thirtyDaysAgo = new Date(Date.now() - DAYS_CUTOFF * 24 * 60 * 60 * 1000);
    const assignments = await db.contactAssigment.findMany({
      where: {
        contact: {
          typeId: {
            not: ContactType.Staff,
          },
          engagements: {
            some: {},
            every: {
              date: {
                lte: thirtyDaysAgo,
              },
            },
          },
        },
      },
      select: {
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            org: {
              select: {
                name: true,
                host: true,
                replyToEmail: true,
              },
            },
          },
        },
        user: {
          select: {
            contact: {
              select: {
                firstName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (assignments.length === 0) {
      logger.info("No contacts to remind. Exiting.");
      return {
        success: true,
        count: 0,
      };
    }

    logger.info(`Found ${assignments.length} contacts to remind.`);

    type Accumulator = Record<
      string,
      {
        user: { firstName: string; email: string };
        contacts: Array<{
          id: string;
          firstName: string | null;
          lastName: string | null;
          org: { name: string; host: string; replyToEmail: string };
        }>;
      }
    >;
    const temp = assignments.reduce((acc: Accumulator, curr) => {
      if (!curr.user.contact.email || (!curr.contact.firstName && !curr.contact.lastName)) {
        return acc;
      }

      const userEmail = curr.user.contact.email;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (!acc[userEmail]) {
        acc[userEmail] = {
          user: {
            ...(curr.user.contact as { firstName: string; email: string }),
          },
          contacts: [],
        };
      }

      acc[userEmail].contacts.push(curr.contact);

      return acc;
    }, {});

    // Convert the map into an array of emails.
    const mappedEmails = [];
    for (const { user, contacts } of Object.values(temp)) {
      const org = contacts[0].org;
      const email: SendEmailInput = {
        from: constructOrgMailFrom(org),
        to: user.email,
        subject: "Contact Reminder",
        html: await render(<EngagementReminderEmail contacts={contacts} userFirstName={user.firstName} />),
      };
      mappedEmails.push(email);
    }

    const emails = await Promise.allSettled(mappedEmails.map((email) => sendEmail(email)));

    emails.forEach((result) => {
      if (result.status === "rejected") {
        Sentry.captureException(result.reason);
        logger.error(`Failed to send email ${result.reason}`);
      }
    });

    return {
      success: true,
      count: mappedEmails.length,
    };
  },
});

export const engagementReminder = schedules.create({
  task: reminderTask.id,
  // At 9a CST on Monday.
  cron: "0 15 * * 1",
  deduplicationKey: "engagement-reminder",
});
