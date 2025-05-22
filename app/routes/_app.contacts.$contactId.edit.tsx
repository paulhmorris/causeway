import { UserRole } from "@prisma/client";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import { IconAddressBook, IconUser } from "@tabler/icons-react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData, useLocation } from "react-router";
import invariant from "tiny-invariant";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { forbidden, notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { UpdateContactSchema } from "~/models/schemas";
import { getContactTypes } from "~/services.server/contact";
import { SessionService } from "~/services.server/session";

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
  };
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  { title: `Edit ${data?.contact.firstName}${data?.contact.lastName ? " " + data.contact.lastName : ""}` },
];

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, UpdateContactSchema);
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
    return Toasts.dataWithError(null, {
      message: "Unknown error",
      description: "An error occurred while updating the contact. Please try again.",
    });
  }
};

export default function EditContactPage() {
  const user = useUser();
  const location = useLocation();
  const { contact, contactTypes, usersWhoCanBeAssigned } = useLoaderData<typeof loader>();
  const [addressEnabled, setAddressEnabled] = useState(
    Object.values(contact.address ?? {}).some((v) => v !== "") ? true : false,
  );
  const form = useForm({
    schema: UpdateContactSchema,
    method: "put",
    defaultValues: {
      ...contact,
      phone: contact.phone ?? undefined,
      email: contact.email ?? undefined,
      lastName: contact.lastName ?? undefined,
      firstName: contact.firstName ?? undefined,
      alternateEmail: contact.alternateEmail ?? undefined,
      alternatePhone: contact.alternatePhone ?? undefined,
      organizationName: contact.organizationName ?? undefined,
      assignedUserIds: contact.assignedUsers.map((a) => a.userId),
      typeId: "",
      address: contact.address
        ? {
            street: contact.address.street,
            street2: contact.address.street2 ?? undefined,
            city: contact.address.city,
            state: contact.address.state,
            zip: contact.address.zip,
            country: contact.address.country,
          }
        : undefined,
    },
  });

  const shouldDisableTypeSelection = user.isMember && location.pathname.includes(user.contactId);

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
        <form {...form.getFormProps()} className="space-y-4 sm:max-w-md">
          <input {...form.getInputProps("id", { type: "hidden" })} />
          <>
            <div className="flex items-start gap-2">
              <FormField label="First name" id="firstName" scope={form.scope("firstName")} placeholder="Joe" required />
              <FormField label="Last name" id="lastName" scope={form.scope("lastName")} placeholder="Donor" />
            </div>
            <FormField label="Email" id="email" scope={form.scope("email")} placeholder="joe@donor.com" />
            <FormField
              label="Alternate Email"
              id="email"
              scope={form.scope("alternateEmail")}
              placeholder="joe2@donor.com"
            />
            <FormField
              label="Phone"
              id="phone"
              scope={form.scope("phone")}
              placeholder="8885909724"
              inputMode="numeric"
              maxLength={10}
            />
            <FormField
              label="Alternate Phone"
              id="phone"
              scope={form.scope("alternatePhone")}
              placeholder="8885909724"
              inputMode="numeric"
              maxLength={10}
            />
            <FormSelect
              required
              disabled={shouldDisableTypeSelection}
              label="Type"
              scope={form.scope("typeId")}
              placeholder="Select type"
              options={contactTypes.map((ct) => ({
                label: ct.name,
                value: ct.id,
              }))}
            />
            <FormField
              label="Organization Name"
              scope={form.scope("organizationName")}
              description="Required if type is Organization"
            />
          </>

          {!addressEnabled ? (
            <Button type="button" variant="outline" onClick={() => setAddressEnabled(true)}>
              Add Address
            </Button>
          ) : (
            <fieldset className="space-y-4">
              <FormField label="Street 1" placeholder="1234 Main St." scope={form.scope("address.street")} required />
              <div className="flex items-start gap-2">
                <FormField label="Street 2" placeholder="Apt 4" scope={form.scope("address.street2")} />
                <FormField label="City" placeholder="Richardson" scope={form.scope("address.city")} required />
              </div>
              <div className="grid grid-cols-2 items-start gap-2 md:grid-cols-12">
                <div className="col-span-6">
                  <FormField label="State / Province" placeholder="TX" scope={form.scope("address.state")} required />
                </div>
                <div className="col-span-1 w-full sm:col-span-3">
                  <FormField label="Postal Code" placeholder="75080" scope={form.scope("address.zip")} required />
                </div>
                <div className="col-span-1 w-full sm:col-span-3">
                  <FormField
                    label="Country"
                    placeholder="US"
                    scope={form.scope("address.country")}
                    required
                    defaultValue="US"
                  />
                </div>
              </div>
            </fieldset>
          )}
          <Separator className="my-4" />
          {contact.typeId !== ContactType.Staff ? (
            <>
              <fieldset>
                <legend className="text-muted-foreground mb-4 text-sm">
                  Assign users to this Contact. They will receive regular reminders to log an engagement.
                  {contact.assignedUsers.some((a) => a.user.id === user.id) && user.isMember ? (
                    <p className="border-warning/25 bg-warning/10 text-warning-foreground mt-2 rounded border px-2 py-1.5 text-sm font-medium">
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
            <SubmitButton isSubmitting={form.formState.isSubmitting} disabled={!form.formState.isDirty}>
              Save
            </SubmitButton>
            <Button type="reset" variant="outline">
              Reset
            </Button>
          </div>
        </form>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
