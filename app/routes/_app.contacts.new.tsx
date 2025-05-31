import { MembershipRole, Prisma } from "@prisma/client";
import { parseFormData, useForm, validationError } from "@rvf/react-router";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useLocation } from "react-router";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { FormField, FormSelect } from "~/components/ui/form";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType } from "~/lib/constants";
import { getPrismaErrorText, handlePrismaError, serverError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { NewContactSchema } from "~/schemas";
import { SessionService } from "~/services.server/session";

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

  const result = await parseFormData(request, NewContactSchema);
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
  const location = useLocation();
  const { contactTypes, usersWhoCanBeAssigned } = useLoaderData<typeof loader>();
  const [addressEnabled, setAddressEnabled] = useState(false);
  const form = useForm({
    schema: NewContactSchema,
    method: "put",
    defaultValues: {
      phone: "",
      email: "",
      lastName: "",
      firstName: "",
      alternateEmail: "",
      alternatePhone: "",
      organizationName: "",
      assignedUserIds: [],
      typeId: "",
      address: undefined,
    },
  });

  const shouldDisableTypeSelection = sessionUser.isMember && location.pathname.includes(sessionUser.contactId);

  return (
    <>
      <PageHeader title="New Contact" />
      <PageContainer>
        <form {...form.getFormProps()} className="space-y-4 sm:max-w-md">
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
            <>
              <Button type="button" variant="outline" onClick={() => setAddressEnabled(false)}>
                Remove Address
              </Button>
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
            </>
          )}
          <Separator className="my-4" />
          <fieldset>
            <legend className="text-muted-foreground mb-4 text-sm">
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
            <SubmitButton isSubmitting={form.formState.isSubmitting}>Create Contact</SubmitButton>
            <Button type="reset" variant="ghost">
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
