import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Form, Link, useLoaderData, useSearchParams, useSubmit } from "react-router";
import { IconPlus } from "@tabler/icons-react";

import { PageHeader } from "~/components/common/page-header";
import { ContactsTable } from "~/components/contacts/contacts-table";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Label } from "~/components/ui/label";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { SessionService } from "~/services.server/session";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(request);
  const orgId = await SessionService.requireOrgId(request);

  const onlyMine = new URL(request.url).searchParams.get("mine") === "true";

  // Only show a user's assigned contacts
  try {
    if (onlyMine) {
      const contacts = await db.contact.findMany({
        where: {
          orgId,
          OR: [
            {
              assignedUsers: {
                some: {
                  userId: user.id,
                },
              },
            },
            {
              user: {
                id: user.id,
              },
            },
          ],
        },
        include: { type: true },
      });
      return { contacts };
    }

    const contacts = await db.contact.findMany({
      where: { orgId },
      include: { type: true },
      orderBy: { createdAt: "desc" },
    });
    return { contacts };
  } catch (error) {
    console.error(error);
    Sentry.captureException(error);
    throw error;
  }
}

export const meta: MetaFunction = () => [{ title: "Contacts" }];

export default function ContactIndexPage() {
  const { contacts } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();

  return (
    <>
      <PageHeader title="Contacts">
        <Button asChild>
          <Link to="/contacts/new">
            <IconPlus className="mr-2 h-5 w-5" />
            <span>New Contact</span>
          </Link>
        </Button>
      </PageHeader>

      <PageContainer>
        <Form className="mb-4 flex items-center gap-2" onChange={(e) => submit(e.currentTarget)}>
          <Label className="inline-flex cursor-pointer items-center gap-2">
            <Checkbox
              name="mine"
              value="true"
              aria-label="Only my contacts"
              defaultChecked={searchParams.get("mine") === "true"}
            />
            <span>Only my contacts</span>
          </Label>
        </Form>
        <ContactsTable data={contacts} />
      </PageContainer>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
