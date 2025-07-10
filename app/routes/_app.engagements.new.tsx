import { parseFormData, useForm, validationError } from "@rvf/react-router";
import {
  useLoaderData,
  useSearchParams,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType, EngagementType } from "~/lib/constants";
import { Toasts } from "~/lib/toast.server";
import { getToday } from "~/lib/utils";
import { cuid, number, optionalLongText, text } from "~/schemas/fields";
import { getContactTypes } from "~/services.server/contact";
import { getEngagementTypes } from "~/services.server/engagement";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.EngagementNew");

const schema = z.object({
  // This doesn't use date because it needs to be in YYYY-MM-DD format
  date: text,
  description: optionalLongText,
  typeId: number.pipe(z.enum(EngagementType)),
  contactId: cuid,
});

export const meta: MetaFunction = () => [{ title: "Add Engagement" }];

export const loader = async (args: LoaderFunctionArgs) => {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const [contacts, contactTypes, engagementTypes] = await db.$transaction([
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

export const action = async (args: ActionFunctionArgs) => {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
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
    logger.error(error);
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
