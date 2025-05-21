import { parseFormData, useForm, validationError } from "@rvf/react-router";
import {
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { z } from "zod";

import { PageHeader } from "~/components/common/page-header";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType, EngagementType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { getToday } from "~/lib/utils";
import { getContactTypes } from "~/services.server/contact";
import { getEngagementTypes } from "~/services.server/engagement";
import { SessionService } from "~/services.server/session";

const schema = z.object({
  date: z.string(),
  description: z.string().optional(),
  typeId: z
    .string()
    .transform((v) => Number(v))
    .pipe(z.nativeEnum(EngagementType)),
  contactId: z.string().cuid({ message: "Contact required" }),
});

export const meta: MetaFunction = () => [{ title: "Add Engagement" }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const [contacts, contactTypes, engagementTypes] = await Promise.all([
    db.contact.findMany({
      where: {
        orgId,
        assignedUsers: user.isMember
          ? {
              some: {
                userId: user.id,
              },
            }
          : undefined,
        typeId: { notIn: [ContactType.Staff] },
      },
    }),
    getContactTypes(orgId),
    getEngagementTypes(orgId),
  ]);

  return {
    contacts,
    contactTypes,
    engagementTypes,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const result = await parseFormData(request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const engagement = await db.engagement.create({
      data: {
        orgId,
        userId: user.id,
        ...result.data,
        date: new Date(result.data.date),
      },
    });

    return Toasts.redirectWithSuccess(`/engagements/${engagement.id}`, {
      message: "Success",
      description: `Engagement recorded.`,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(error);
    return Toasts.dataWithError(null, { message: "An unknown error occurred" });
  }
};

export default function NewEngagementPage() {
  const { contacts, contactTypes, engagementTypes } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const form = useForm({
    schema,
    method: "post",
    defaultValues: {
      typeId: "",
      date: getToday(),
      description: "",
      contactId: searchParams.get("contactId") ?? "",
    },
  });

  return (
    <>
      <PageHeader title="Add Engagement" />
      <PageContainer>
        <form {...form.getFormProps()} className="space-y-4 sm:max-w-md">
          <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
            <FormField required label="Date" type="date" scope={form.scope("date")} />
            <FormSelect
              required
              label="Type"
              scope={form.scope("typeId")}
              placeholder="Select type"
              options={engagementTypes.map((t) => ({
                value: t.id,
                label: t.name,
              }))}
            />
          </div>
          <ContactDropdown
            types={contactTypes}
            contacts={contacts}
            scope={form.scope("contactId")}
            label="Contact"
            required
          />
          <FormTextarea scope={form.scope("description")} label="Description" />
          <Button>Submit</Button>
        </form>
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
