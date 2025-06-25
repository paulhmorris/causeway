import { MembershipRole } from "@prisma/client";
import { parseFormData, validationError } from "@rvf/react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { NewContactForm, newContactSchema } from "~/components/forms/new-contact-form";
import { PageContainer } from "~/components/page-container";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { handleLoaderError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ContactNew");

export const meta: MetaFunction = () => [{ title: "New Contact" }];

export const loader = async (args: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  try {
    const contactTypes = await db.contactType.findMany({
      where: {
        AND: [
          { OR: [{ orgId }, { orgId: null }] },
          // Members can't create staff contacts
          user.isMember ? { id: { notIn: [ContactType.Staff] } } : {},
        ],
      },
    });
    const usersWhoCanBeAssigned = await db.user.findMany({
      where: {
        memberships: {
          some: {
            orgId,
            role: { in: [MembershipRole.ADMIN, MembershipRole.MEMBER] },
          },
        },
      },
      select: {
        id: true,
        contact: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      contactTypes,
      usersWhoCanBeAssigned,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, newContactSchema);
  if (result.error) {
    return validationError(result.error);
  }

  const { address, assignedUserIds, ...formData } = result.data;
  try {
    // Verify email is unique
    if (formData.email) {
      const existingContact = await db.contact.findUnique({
        where: {
          email_orgId: {
            email: formData.email,
            orgId,
          },
        },
      });

      if (existingContact) {
        return validationError({
          fieldErrors: {
            email: `A contact with this email already exists - ${existingContact.firstName} ${existingContact.lastName}`,
          },
        });
      }
    }

    const contact = await db.contact.create({
      data: {
        ...formData,
        orgId,
        address: address ? { create: { ...address, orgId } } : undefined,
        assignedUsers: assignedUserIds
          ? { createMany: { data: assignedUserIds.map((userId) => ({ userId, orgId })) } }
          : undefined,
      },
    });

    return Toasts.redirectWithSuccess(`/contacts/${contact.id}`, {
      message: "Contact created",
      description: `${contact.firstName} ${contact.lastName} was created successfully.`,
    });
  } catch (error) {
    logger.error(error);
    Sentry.captureException(error);
    return Toasts.dataWithError(null, { message: "Error", description: "An unknown error occurred." });
  }
};

export default function NewContactPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="New Contact" />
      <PageContainer>
        <NewContactForm contactTypes={data.contactTypes} usersWhoCanBeAssigned={data.usersWhoCanBeAssigned} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
