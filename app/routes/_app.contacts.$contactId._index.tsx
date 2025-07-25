import { Engagement } from "@prisma/client";
import { IconAddressBook, IconPlus, IconUser } from "@tabler/icons-react";
import dayjs from "dayjs";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ContactCard } from "~/components/contacts/contact-card";
import { ContactEngagementsTable } from "~/components/contacts/contact-engagements-table";
import { RecentTransactionsTable } from "~/components/contacts/recent-donations-table";
import { ErrorComponent } from "~/components/error-component";
import { ConfirmDestructiveModal } from "~/components/modals/confirm-destructive-modal";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useUser } from "~/hooks/useUser";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { handleLoaderError, Responses } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cn } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ContactShow");

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  invariant(params.contactId, "contactId not found");

  try {
    const contact = await db.contact.findUniqueOrThrow({
      where: { id: params.contactId, orgId },
      include: {
        user: true,
        type: true,
        address: true,
        engagements: {
          include: {
            type: true,
          },
          orderBy: { date: "desc" },
        },
        assignedUsers: {
          include: {
            user: {
              include: {
                contact: true,
              },
            },
          },
        },
        transactions: {
          where: {
            date: { gte: dayjs().subtract(90, "d").toDate() },
          },
          include: {
            account: true,
          },
          orderBy: { date: "desc" },
        },
      },
    });

    const shouldHideTransactions = user.isMember && !contact.assignedUsers.some((a) => a.userId === user.id);

    if (shouldHideTransactions) {
      return { contact: { ...contact, transactions: [] } };
    }

    return { contact };
  } catch (e) {
    handleLoaderError(e);
  }
};

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  invariant(params.contactId, "contactId not found");

  const schema = z.object({ _action: z.enum(["delete"]) });
  const result = schema.safeParse(Object.fromEntries(await request.formData()));
  if (result.error) {
    return Toasts.dataWithError(
      { success: false },
      { message: "Error deleting contact", description: "Invalid request" },
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  if (result.data._action === "delete" && request.method === "DELETE") {
    const contact = await db.contact.findUniqueOrThrow({
      where: { id: params.contactId, orgId },
      include: {
        transactions: {
          select: { id: true },
        },
      },
    });

    if (contact.typeId === ContactType.Staff) {
      throw Responses.forbidden({ message: "You do not have permission to delete this contact." });
    }

    if (contact.transactions.length > 0) {
      return Toasts.dataWithError(
        { success: false },
        {
          message: "Error deleting contact",
          description: "This contact has transactions and cannot be deleted. Check the transactions page.",
        },
      );
    }

    try {
      await db.$transaction([
        db.contactAssigment.deleteMany({ where: { contactId: contact.id, orgId } }),
        db.engagement.deleteMany({ where: { contactId: contact.id, orgId } }),
        db.address.deleteMany({ where: { contactId: contact.id, orgId } }),
        db.contact.delete({ where: { id: contact.id, orgId } }),
      ]);
      return Toasts.redirectWithSuccess("/contacts", {
        message: "Contact deleted",
        description: `${contact.firstName} ${contact.lastName} was deleted successfully.`,
      });
    } catch (error) {
      logger.error("Error deleting contact", { error });
      Sentry.captureException(error);
      return Toasts.dataWithError({ success: false }, { message: "Error", description: "An unknown error occurred" });
    }
  }
}

export default function ContactDetailsPage() {
  const user = useUser();
  const { contact } = useLoaderData<typeof loader>();
  const isExternal = contact.typeId !== ContactType.Staff;
  const canDelete =
    !contact.user && contact.transactions.length === 0 && !user.isMember && contact.typeId !== ContactType.Staff;

  return (
    <>
      <title>
        {contact.firstName}
        {contact.lastName ? " " + contact.lastName : ""}
      </title>
      <PageHeader title="View Contact">
        {canDelete ? (
          <ConfirmDestructiveModal
            description={`This action cannot be undone. This will delete ${contact.firstName} ${contact.lastName ?? ""} and all associated engagements. Assigned users will be unassigned.`}
          />
        ) : null}
      </PageHeader>
      <div className="flex flex-wrap items-center gap-2 sm:mt-1">
        <Badge variant="outline" className="capitalize">
          <div>
            <IconAddressBook className="size-3" />
          </div>
          <span>{contact.type.name.toLowerCase()}</span>
        </Badge>
        {contact.user ? (
          <Badge variant="secondary">
            <Link to={`/users/${contact.user.id}`} prefetch="intent" className="flex items-center gap-1.5">
              <div>
                <IconUser className="size-3" />
              </div>
              <span>{contact.user.username}</span>
            </Link>
          </Badge>
        ) : null}
      </div>
      <PageContainer className="max-w-(--breakpoint-md)">
        <div className="space-y-5">
          {isExternal ? (
            <div className="space-y-2">
              <DaysSinceLastEngagement engagements={contact.engagements} />
              <Button asChild variant="outline">
                <Link
                  to={{
                    pathname: "/engagements/new",
                    search: `?contactId=${contact.id}`,
                  }}
                  prefetch="intent"
                >
                  <IconPlus className="mr-2 size-5" />
                  <span>New Engagement</span>
                </Link>
              </Button>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <ContactCard contact={contact} />
            {contact.assignedUsers.length > 0 ? (
              <Card className="flex-1 basis-48 bg-transparent">
                <CardHeader>
                  <CardTitle>Assigned Users</CardTitle>
                  <CardDescription>These users receive regular reminders to engage with this Contact.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul>
                    {contact.assignedUsers.map((a) => (
                      <li key={a.id}>
                        <Link to={`/users/${a.userId}`} prefetch="intent" className="text-primary text-sm font-medium">
                          {a.user.contact.firstName} {a.user.contact.lastName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ) : null}
          </div>
          {contact.transactions.length > 0 ? <RecentTransactionsTable transactions={contact.transactions} /> : null}
        </div>
        {isExternal && contact.engagements.length > 0 ? (
          <div className="mt-12">
            <h2 className="mb-4 text-2xl font-semibold">Engagements</h2>
            <ContactEngagementsTable data={contact.engagements} />
          </div>
        ) : null}
      </PageContainer>
    </>
  );
}

function DaysSinceLastEngagement({ engagements }: { engagements: Array<Engagement> }) {
  if (engagements.length === 0) return null;
  const daysSinceLastEngagement = dayjs().diff(dayjs(engagements[0].date), "d");

  return (
    <p className="text-sm">
      <span className={cn("font-bold", daysSinceLastEngagement > 30 ? "text-destructive" : "text-success")}>
        {daysSinceLastEngagement} day{daysSinceLastEngagement === 1 ? "" : "s"}{" "}
      </span>
      since last engagement.
    </p>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
