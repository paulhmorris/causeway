import { parseFormData, ValidatedForm, validationError } from "@rvf/react-router";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { ActionFunctionArgs, LoaderFunctionArgs, useLoaderData, type MetaFunction } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod/v4";
dayjs.extend(utc);

import { PageHeader } from "~/components/common/page-header";
import { ContactDropdown } from "~/components/contacts/contact-dropdown";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { ButtonGroup } from "~/components/ui/button-group";
import { FormField, FormSelect, FormTextarea } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { ContactType, EngagementType } from "~/lib/constants";
import { handleLoaderError, notFound } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { cuid, date, number, optionalLongText } from "~/schemas/fields";
import { ContactService } from "~/services.server/contact";
import { EngagementService } from "~/services.server/engagement";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.EngagementEdit");

const schema = z.object({
  id: number,
  date: date,
  description: optionalLongText,
  typeId: number.pipe(z.enum(EngagementType)),
  contactId: cuid,
});

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;
  try {
    const user = await SessionService.requireUser(args);
    const orgId = await SessionService.requireOrgId(args);

    invariant(params.engagementId, "engagementId not found");

    const [contacts, contactTypes, engagement, engagementTypes] = await db.$transaction([
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
      ContactService.getTypes(orgId),
      db.engagement.findUnique({
        where: { id: Number(params.engagementId), orgId },
      }),
      EngagementService.getTypes(orgId),
    ]);

    if (!engagement) {
      throw notFound("Engagement not found");
    }

    return {
      engagement,
      engagementTypes,
      contacts,
      contactTypes,
    };
  } catch (e) {
    handleLoaderError(e);
  }
};

export const meta: MetaFunction = () => [{ title: "Edit Account" }];

export const action = async (args: ActionFunctionArgs) => {
  await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const result = await parseFormData(args.request, schema);
  if (result.error) {
    return validationError(result.error);
  }

  try {
    const engagement = await db.engagement.update({
      where: { id: result.data.id, orgId },
      data: result.data,
    });

    return Toasts.redirectWithSuccess(`/engagements/${engagement.id}`, { message: "Engagement updated" });
  } catch (e) {
    logger.error(e);
    Sentry.captureException(e);
    return Toasts.dataWithError(null, { message: "An unknown error occurred" }, { status: 500 });
  }
};

export default function EditEngagementPage() {
  const { engagement, engagementTypes, contacts, contactTypes } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Edit Engagement" />
      <PageContainer>
        <ValidatedForm
          method="post"
          schema={schema}
          defaultValues={{
            ...engagement,
            description: engagement.description ?? "",
            date: dayjs(engagement.date).format("YYYY-MM-DD"),
          }}
          className="space-y-4 sm:max-w-md"
        >
          {(form) => (
            <>
              <input type="hidden" name="id" value={engagement.id} />
              <div className="flex flex-wrap items-start gap-2 sm:flex-nowrap">
                <FormField
                  required
                  scope={form.scope("date")}
                  label="Date"
                  type="date"
                  defaultValue={dayjs(engagement.date).utc().format("YYYY-MM-DD")}
                />
                <FormSelect
                  required
                  scope={form.scope("typeId")}
                  label="Type"
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
              <FormTextarea scope={form.scope("description")} label="Description" rows={8} />
              <ButtonGroup>
                <SubmitButton isSubmitting={form.formState.isSubmitting}>Save</SubmitButton>
                <Button type="reset" variant="ghost">
                  Reset
                </Button>
              </ButtonGroup>
            </>
          )}
        </ValidatedForm>
      </PageContainer>
    </>
  );
}
