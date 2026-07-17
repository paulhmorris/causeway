import { IconHeartbeat, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, Link, useFetcher, useLoaderData, useSearchParams, useSubmit } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ContactsTable } from "~/components/contacts/contacts-table";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { DrawerDialog, DrawerDialogFooter } from "~/components/ui/drawer-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { SubmitButton } from "~/components/ui/submit-button";
import { db } from "~/integrations/prisma.server";
import { ContactType } from "~/lib/constants";
import { handleLoaderError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { SessionService } from "~/services.server/session";

export type ContactWithCount = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  typeId: number;
  type: { name: string };
  _count: { accountSubscriptions: number };
};

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const onlyMine = new URL(args.request.url).searchParams.get("mine") === "true";

  try {
    if (onlyMine) {
      const contacts = await db.contact.findMany({
        where: {
          orgId,
          OR: [
            { assignedUsers: { some: { userId: user.id } } },
            { user: { id: user.id } },
          ],
        },
        include: { type: true, _count: { select: { accountSubscriptions: true } } },
      });
      return { contacts };
    }

    const contacts = await db.contact.findMany({
      where: { orgId },
      include: { type: true, _count: { select: { accountSubscriptions: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { contacts };
  } catch (e) {
    handleLoaderError(e);
  }
}

const quickEditSchema = z.object({
  _action: z.literal("quick-edit-email"),
  contactId: z.string().min(1),
  email: z.string().email("Must be a valid email").optional().or(z.literal("")),
});

export async function action(args: ActionFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const data = Object.fromEntries(await args.request.formData());
  const result = quickEditSchema.safeParse(data);
  if (!result.success) {
    return Toasts.dataWithError(null, { message: "Invalid data" });
  }

  const { contactId, email } = result.data;
  await db.contact.update({
    where: { id: contactId, orgId },
    data: { email: email || null },
  });

  return Toasts.dataWithSuccess({ ok: true }, { message: "Contact updated", description: "Email address saved." });
}

export default function ContactIndexPage() {
  const { contacts } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher<typeof action>();
  const [quickEditContact, setQuickEditContact] = useState<ContactWithCount | null>(null);

  const isSubmitting = fetcher.state !== "idle";
  const submitSucceeded = fetcher.data && "ok" in fetcher.data;

  function handleWarningClick(contact: ContactWithCount) {
    setQuickEditContact(contact);
  }

  function handleDrawerClose(open: boolean) {
    if (!open) setQuickEditContact(null);
  }

  return (
    <>
      <title>Contacts</title>
      <PageHeader title="Contacts">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/contacts/health" prefetch="intent">
              <IconHeartbeat className="mr-2 size-4" />
              <span>Health Check</span>
            </Link>
          </Button>
          <Button asChild>
            <Link to="/contacts/new" prefetch="intent">
              <IconPlus className="mr-2 size-5" />
              <span>New Contact</span>
            </Link>
          </Button>
        </div>
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
        <ContactsTable data={contacts} onWarningClick={handleWarningClick} />
      </PageContainer>

      <DrawerDialog
        open={!!quickEditContact}
        setOpen={handleDrawerClose}
        title="Add missing email"
        description={
          quickEditContact
            ? `${quickEditContact.firstName ?? ""} ${quickEditContact.lastName ?? ""} — ${quickEditContact.type.name}`
            : ""
        }
      >
        {quickEditContact ? (
          <fetcher.Form method="post" className="space-y-4">
            <input type="hidden" name="_action" value="quick-edit-email" />
            <input type="hidden" name="contactId" value={quickEditContact.id} />
            <div className="space-y-1.5">
              <Label htmlFor="quick-edit-email">Email address</Label>
              <Input
                id="quick-edit-email"
                name="email"
                type="email"
                placeholder="donor@example.com"
                autoFocus
                defaultValue={quickEditContact.email ?? ""}
              />
            </div>
            <DrawerDialogFooter className="gap-2">
              <SubmitButton isSubmitting={isSubmitting}>
                {submitSucceeded ? "Saved" : "Save"}
              </SubmitButton>
              <Button type="button" variant="outline" onClick={() => setQuickEditContact(null)}>
                Close
              </Button>
            </DrawerDialogFooter>
          </fetcher.Form>
        ) : null}
      </DrawerDialog>
    </>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
