import { Prisma, UserRole } from "@prisma/client";
import { ValidatedForm, validationError } from "@rvf/react-router";
import { withZod } from "@rvf/zod";
import { IconAddressBook, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
import invariant from "tiny-invariant";
import { PageHeader } from "~/components/common/page-header";
import { AddressForm } from "~/components/contacts/address-fields";
import { ContactFields } from "~/components/contacts/contact-fields";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { forbidden, getPrismaErrorText, notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { UpdateContactSchema } from "~/models/schemas";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";

const UpdateContactValidator = withZod(UpdateContactSchema);

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  invariant(params.contactId, "contactId not found");

  // Users can only edit their assigned contacts
  if (user.isMember && params.contactId !== user.contactId) {
    const assignment = await db.contactAssigment.findUnique({
      where: {
        orgId,
        contactId_userId: {
          contactId: params.contactId,
          userId: user.id,
        },
      },
    });
    if (!assignment) {
      throw forbidden({ message: "You do not have permission to edit this contact." });
    }
  }

  const [contactTypes, usersWhoCanBeAssigned] = await Promise.all([
    getContactTypes(orgId),
    db.user.findMany({
      where: {
        memberships: {
          some: { orgId },
        },
        role: { notIn: [UserRole.SUPERADMIN] },
        contactId: { not: params.contactId },
      },
      include: {
        contact: true,
      },
    }),
  ]);

  const contact = await db.contact.findUnique({
    where: { id: params.contactId, orgId },
    include: {
      user: true,
      assignedUsers: {
        include: {
          user: {
            include: {
              contact: true,
            },
          },
        },
      },
      address: true,
      type: true,
    },
  });

  if (!contact) {
    throw notFound({ message: "Contact not found" });
  }

  return {
    contact,
    contactTypes,
    usersWhoCanBeAssigned,
    // ...setFormDefaults("contact-form", { ...contact, typeId: contact.typeId.toString() }),
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `Edit ${data?.contact.firstName}${data?.contact.lastName ? " " + data.contact.lastName : ""}` },
];

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await UpdateContactValidator.validate(await request.formData());
  if (result.error) {
    return validationError(result.error);
  }

  const { address, assignedUserIds, ...formData } = result.data;

  if (formData.typeId === ContactType.Organization && !formData.organizationName) {
    return validationError(
      {
        fieldErrors: {
          organizationName: "Organization name is required for organization contacts.",
        },
      },
      result.data,
    );
  }

  try {
    // Users can only edit their assigned contacts and themselves
    if (user.isMember && formData.id !== user.contactId) {
      const assignment = await db.contactAssigment.findUnique({
        where: {
          orgId,
          contactId_userId: {
            contactId: formData.id,
            userId: user.id,
          },
        },
      });
      if (!assignment) {
        throw forbidden({ message: "You do not have permission to edit this contact." });
      }
    }

    // Users can't change their contact type
    if (user.isMember) {
      if (formData.typeId !== user.contact.typeId) {
        return forbidden({ message: "You do not have permission to change your contact type." });
      }
    }

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

      if (existingContact && existingContact.id !== formData.id) {
        return validationError({
          fieldErrors: {
            email: `A contact with this email already exists - ${existingContact.firstName} ${existingContact.lastName}`,
          },
        });
      }
    }

    const contact = await db.contact.update({
      where: { id: formData.id, orgId },
      data: {
        ...formData,
        assignedUsers: {
          // Rebuild the assigned users list
          deleteMany: {},
          create: assignedUserIds ? assignedUserIds.map((userId) => ({ userId, orgId })) : undefined,
        },
        address: address
          ? {
              upsert: {
                create: { ...address, orgId },
                update: { ...address, orgId },
              },
            }
          : undefined,
      },
      include: {
        address: true,
      },
    });

    return Toasts.redirectWithSuccess(`/contacts/${contact.id}`, {
      message: "Contact updated",
      description: `${contact.firstName} ${contact.lastName} was updated successfully.`,
    });
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const message = getPrismaErrorText(error);
      return Toasts.dataWithError(
        { message: `An error occurred: ${message}` },
        { description: message, message: "Error updating contact" },
      );
    }
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "An error occurred while updating the contact. Please try again.",
    });
  }
};

export default function EditContactPage() {
  const user = useUser();
  const { contact, contactTypes, usersWhoCanBeAssigned } = useLoaderData<typeof loader>();
  const [addressEnabled, setAddressEnabled] = useState(
    Object.values(contact.address ?? {}).some((v) => v !== "") ? true : false,
  );

  return (
    <>
      <PageHeader title="Edit Contact" />
      <div className="mt-1">
        {user.contactId === contact.id ? (
          <div className="max-w-sm">
            <Callout variant="warning">
              This is your contact information. Changing this email will not affect your login credentials, but may have
              other unintended effects.
            </Callout>
          </div>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:mt-1">
            <Badge variant="outline" className="capitalize">
              <div>
                <IconAddressBook className="size-3" />
              </div>
              <span>{contact.type.name.toLowerCase()}</span>
            </Badge>
            {contact.user ? (
              <Badge variant="secondary">
                <Link to={`/users/${contact.user.id}`} className="flex items-center gap-1.5">
                  <div>
                    <IconUser className="size-3" />
                  </div>
                  <span>{contact.user.username}</span>
                </Link>
              </Badge>
            ) : null}
          </div>
        )}
      </div>
      <PageContainer>
        <ValidatedForm
          id="contact-form"
          validator={UpdateContactValidator}
          method="post"
          className="space-y-4 sm:max-w-md"
        >
          <input type="hidden" name="id" value={contact.id} />
          <ContactFields contactTypes={contactTypes} />

          {!addressEnabled ? (
            <Button type="button" variant="outline" onClick={() => setAddressEnabled(true)}>
              Add Address
            </Button>
          ) : (
            <AddressForm />
          )}
          <Separator className="my-4" />
          {contact.typeId !== ContactType.Staff ? (
            <>
              <fieldset>
                <legend className="mb-4 text-sm text-muted-foreground">
                  Assign users to this Contact. They will receive regular reminders to log an engagement.
                  {contact.assignedUsers.some((a) => a.user.id === user.id) && user.isMember ? (
                    <p className="mt-2 rounded border border-warning/25 bg-warning/10 px-2 py-1.5 text-sm font-medium text-warning-foreground">
                      If you unassign yourself, you will no longer be able to view this contact&apos;s transactions or
                      make edits.
                    </p>
                  ) : null}
                </legend>
                <div className="flex flex-col gap-2">
                  {usersWhoCanBeAssigned.map((user) => {
                    return (
                      <Label key={user.id} className="inline-flex cursor-pointer items-center gap-2">
                        <Checkbox
                          name="assignedUserIds"
                          value={user.id}
                          defaultChecked={contact.assignedUsers.some((a) => a.user.id === user.id)}
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
            </>
          ) : null}
          <div className="flex items-center gap-2">
            <SubmitButton>Save</SubmitButton>
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
