import { MembershipRole, Prisma } from "@prisma/client";
import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { AddressForm } from "~/components/contacts/address-fields";
import { ContactFields } from "~/components/contacts/contact-fields";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { getPrismaErrorText, handlePrismaError, serverError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { NewContactSchema } from "~/models/schemas";
import { SessionService } from "~/services.server/session";

const NewContactValidator = withZod(NewContactSchema);

export const meta: MetaFunction = () => [{ title: "New Contact" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

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
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw handlePrismaError(error);
    }
    throw serverError("An error occurred while loading the page. Please try again.");
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await NewContactValidator.validate(await request.formData());
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
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = getPrismaErrorText(error);
      return Toasts.dataWithError(
        { message: `An error occurred: ${message}` },
        { description: message, message: "Error creating contact" },
      );
    }
    throw serverError("An error occurred while creating the contact. Please try again.");
  }
};

export default function NewContactPage() {
  const sessionUser = useUser();
  const { contactTypes, usersWhoCanBeAssigned } = useLoaderData<typeof loader>();
  const [addressEnabled, setAddressEnabled] = useState(false);

  return (
    <>
      <PageHeader title="New Contact" />
      <PageContainer>
        <ValidatedForm validator={NewContactValidator} method="post" className="space-y-4 sm:max-w-md">
          <ContactFields contactTypes={contactTypes} />
          {!addressEnabled ? (
            <Button type="button" variant="outline" onClick={() => setAddressEnabled(true)}>
              Add Address
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setAddressEnabled(false)}>
                Remove Address
              </Button>
              <AddressForm />
            </>
          )}
          <Separator className="my-4" />
          <fieldset>
            <legend className="mb-4 text-sm text-muted-foreground">
              Assigned users will receive regular reminders to engage with this Contact.
            </legend>
            <div className="flex flex-col gap-2">
              {usersWhoCanBeAssigned.map((user) => {
                return (
                  <Label key={user.id} className="inline-flex cursor-pointer items-center gap-2">
                    <Checkbox
                      name="assignedUserIds"
                      value={user.id}
                      aria-label={`${user.contact.firstName} ${user.contact.lastName}`}
                      defaultChecked={sessionUser.isMember ? user.id === sessionUser.id : false}
                    />
                    <span>
                      {user.contact.firstName} {user.contact.lastName}
                    </span>
                  </Label>
                );
              })}
            </div>
          </fieldset>
          <Separator className="my-4" />
          <div className="flex items-center gap-2">
            <SubmitButton>Create Contact</SubmitButton>
            <Button type="reset" variant="outline">
              Reset
            </Button>
          </div>
        </ValidatedForm>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
