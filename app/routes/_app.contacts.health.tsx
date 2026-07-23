import { IconAlertTriangle, IconCheck, IconUsers, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { ActionFunctionArgs, Form, Link, LoaderFunctionArgs, useLoaderData } from "react-router";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import { Toasts } from "~/lib/toast.server";
import { formatPhoneNumber } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ContactHealth");

const mergeSchema = z.object({
  _action: z.literal("merge"),
  keepId: z.string().min(1),
  deleteId: z.string().min(1),
});

type ContactSummary = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  alternateEmail: string | null;
  phone: string | null;
  type: { name: string };
  _count: { transactions: number; accountSubscriptions: number };
};

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const contacts = await db.contact.findMany({
    where: { orgId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      alternateEmail: true,
      phone: true,
      type: { select: { name: true } },
      _count: { select: { transactions: true, accountSubscriptions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Name duplicates: same normalized full name
  const nameMap = new Map<string, ContactSummary[]>();
  for (const c of contacts) {
    const key = `${(c.firstName ?? "").trim()} ${(c.lastName ?? "").trim()}`.toLowerCase().trim();
    if (!key || key === " ") continue;
    const group = nameMap.get(key) ?? [];
    group.push(c);
    nameMap.set(key, group);
  }
  const nameDuplicates: Array<[ContactSummary, ContactSummary]> = [];
  for (const group of nameMap.values()) {
    if (group.length < 2) continue;
    // Emit pairs
    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) {
        nameDuplicates.push([group[i], group[j]]);
      }
    }
  }

  // Also check cross-email: contact A's email matches contact B's alternateEmail
  const emailToContact = new Map<string, ContactSummary>();
  for (const c of contacts) {
    if (c.email) emailToContact.set(c.email.toLowerCase(), c);
  }
  const emailCrossDuplicates: Array<[ContactSummary, ContactSummary]> = [];
  for (const c of contacts) {
    if (!c.alternateEmail) continue;
    const match = emailToContact.get(c.alternateEmail.toLowerCase());
    if (match && match.id !== c.id) {
      // Avoid double-reporting
      const alreadyReported = emailCrossDuplicates.some(
        ([a, b]) => (a.id === c.id && b.id === match.id) || (a.id === match.id && b.id === c.id),
      );
      if (!alreadyReported) {
        emailCrossDuplicates.push([c, match]);
      }
    }
  }

  // Incomplete: missing email
  const missingEmail = contacts.filter((c) => !c.email);

  return { nameDuplicates, emailCrossDuplicates, missingEmail };
}

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const data = Object.fromEntries(await args.request.formData());
  const result = mergeSchema.safeParse(data);
  if (!result.success) {
    return Toasts.dataWithError(null, { message: "Invalid request" });
  }

  const { keepId, deleteId } = result.data;

  try {
    // Verify both contacts belong to this org
    const [keep, remove] = await Promise.all([
      db.contact.findUniqueOrThrow({ where: { id: keepId, orgId }, select: { id: true } }),
      db.contact.findUniqueOrThrow({
        where: { id: deleteId, orgId },
        select: {
          id: true,
          address: { select: { id: true } },
          accountSubscriptions: { select: { id: true, accountId: true } },
          assignedUsers: { select: { id: true, userId: true } },
        },
      }),
    ]);

    // Find which subscriptions and assignments the keeper already has (to avoid unique conflicts)
    const keeperSubscriptions = await db.accountSubscription.findMany({
      where: { subscriberId: keep.id },
      select: { accountId: true },
    });
    const keeperAssignments = await db.contactAssigment.findMany({
      where: { contactId: keep.id },
      select: { userId: true },
    });
    const keeperAccountIds = new Set(keeperSubscriptions.map((s) => s.accountId));
    const keeperUserIds = new Set(keeperAssignments.map((a) => a.userId));

    await db.$transaction(async (tx) => {
      // Transfer transactions
      await tx.transaction.updateMany({ where: { contactId: deleteId }, data: { contactId: keepId } });

      // Transfer engagements
      await tx.engagement.updateMany({ where: { contactId: deleteId }, data: { contactId: keepId } });

      // Transfer account subscriptions (skip ones the keeper already has)
      const subsToTransfer = remove.accountSubscriptions.filter((s) => !keeperAccountIds.has(s.accountId));
      if (subsToTransfer.length > 0) {
        await tx.accountSubscription.updateMany({
          where: { id: { in: subsToTransfer.map((s) => s.id) } },
          data: { subscriberId: keepId },
        });
      }
      const subsToDrop = remove.accountSubscriptions.filter((s) => keeperAccountIds.has(s.accountId));
      if (subsToDrop.length > 0) {
        await tx.accountSubscription.deleteMany({ where: { id: { in: subsToDrop.map((s) => s.id) } } });
      }

      // Transfer contact assignments (skip ones the keeper already has)
      const assignsToTransfer = remove.assignedUsers.filter((a) => !keeperUserIds.has(a.userId));
      if (assignsToTransfer.length > 0) {
        await tx.contactAssigment.updateMany({
          where: { id: { in: assignsToTransfer.map((a) => a.id) } },
          data: { contactId: keepId },
        });
      }
      const assignsToDrop = remove.assignedUsers.filter((a) => keeperUserIds.has(a.userId));
      if (assignsToDrop.length > 0) {
        await tx.contactAssigment.deleteMany({ where: { id: { in: assignsToDrop.map((a) => a.id) } } });
      }

      // Transfer address if keeper has none
      if (remove.address) {
        const keeperAddress = await tx.address.findUnique({ where: { contactId: keepId } });
        if (!keeperAddress) {
          await tx.address.update({ where: { id: remove.address.id }, data: { contactId: keepId } });
        } else {
          await tx.address.delete({ where: { id: remove.address.id } });
        }
      }

      // Delete the duplicate contact (cascades receipts link)
      await tx.contact.delete({ where: { id: deleteId } });
    });

    logger.info("Contacts merged", { keepId, deleteId, adminUsername: user.username });

    return Toasts.dataWithSuccess(null, {
      message: "Contacts merged",
      description: "All transactions, engagements, and subscriptions have been transferred.",
    });
  } catch (error) {
    logger.error("Error merging contacts", { error });
    Sentry.captureException(error);
    return Toasts.dataWithError(null, {
      message: "Error",
      description: "An unknown error occurred. Please try again.",
    });
  }
}

export default function ContactHealthPage() {
  const { nameDuplicates, emailCrossDuplicates, missingEmail } = useLoaderData<typeof loader>();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const pairKey = (a: ContactSummary, b: ContactSummary) => [a.id, b.id].sort().join("|");
  const dismiss = (a: ContactSummary, b: ContactSummary) => setDismissed((prev) => new Set([...prev, pairKey(a, b)]));
  const isDismissed = (a: ContactSummary, b: ContactSummary) => dismissed.has(pairKey(a, b));

  const visibleNameDups = nameDuplicates.filter(([a, b]) => !isDismissed(a, b));
  const visibleEmailDups = emailCrossDuplicates.filter(([a, b]) => !isDismissed(a, b));
  const totalIssues = visibleNameDups.length + visibleEmailDups.length + missingEmail.length;

  return (
    <>
      <title>Contact Health</title>
      <PageHeader title="Contact Health">
        <Button variant="outline" asChild>
          <Link to="/contacts" prefetch="intent">
            Back to Contacts
          </Link>
        </Button>
      </PageHeader>

      <PageContainer className="max-w-4xl">
        {totalIssues === 0 ? (
          <Callout variant="info">
            <div className="flex items-center gap-2">
              <IconCheck className="size-4" />
              <span>No issues found. Your contacts database looks clean.</span>
            </div>
          </Callout>
        ) : (
          <p className="text-muted-foreground mb-6 text-sm">
            {totalIssues} issue{totalIssues === 1 ? "" : "s"} found. Review and resolve each one below.
          </p>
        )}

        {visibleNameDups.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-medium">Same name</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              These contacts share an identical name and may be duplicates.
            </p>
            <div className="space-y-4">
              {visibleNameDups.map(([a, b]) => (
                <DuplicatePairCard key={pairKey(a, b)} a={a} b={b} onDismiss={() => dismiss(a, b)} />
              ))}
            </div>
          </section>
        ) : null}

        {visibleEmailDups.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-medium">Overlapping email addresses</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              One contact's primary email matches another's alternate email.
            </p>
            <div className="space-y-4">
              {visibleEmailDups.map(([a, b]) => (
                <DuplicatePairCard key={pairKey(a, b)} a={a} b={b} onDismiss={() => dismiss(a, b)} />
              ))}
            </div>
          </section>
        ) : null}

        {missingEmail.length > 0 ? (
          <section className="mb-10">
            <h2 className="mb-1 text-lg font-medium">Missing email</h2>
            <p className="text-muted-foreground mb-4 text-sm">
              These contacts have no email address on file. Donors need an email for giving receipts.
            </p>
            <div className="divide-border divide-y rounded-md border">
              {missingEmail.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="text-muted-foreground ml-2">{c.type.name}</span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/contacts/${c.id}/edit`} prefetch="intent">
                      Edit
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </PageContainer>
    </>
  );
}

function ContactColumn({ contact }: { contact: ContactSummary }) {
  const name = [contact.firstName, contact.lastName].filter(Boolean).join(" ") || "—";
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{name}</p>
      <dl className="space-y-1">
        <Row label="Type" value={contact.type.name} />
        <Row label="Email" value={contact.email} />
        {contact.alternateEmail ? <Row label="Alt email" value={contact.alternateEmail} /> : null}
        <Row label="Phone" value={contact.phone ? formatPhoneNumber(contact.phone) : null} />
        <Row label="Transactions" value={String(contact._count.transactions)} />
        <Row label="Subscriptions" value={String(contact._count.accountSubscriptions)} />
      </dl>
      <Button variant="outline" size="sm" asChild>
        <Link to={`/contacts/${contact.id}`} prefetch="intent">
          View
        </Link>
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={value ? "" : "text-muted-foreground"}>{value ?? "—"}</dd>
    </div>
  );
}

function DuplicatePairCard({ a, b, onDismiss }: { a: ContactSummary; b: ContactSummary; onDismiss: () => void }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <IconAlertTriangle className="text-warning size-4" aria-hidden="true" />
            Possible duplicate
          </CardTitle>
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs"
            aria-label="Not a duplicate"
          >
            <IconX className="size-3.5" aria-hidden="true" />
            Not a duplicate
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <ContactColumn contact={a} />
          <ContactColumn contact={b} />
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap gap-2">
          <MergeForm keepId={a.id} deleteId={b.id} label={`Keep left, remove right`} />
          <MergeForm keepId={b.id} deleteId={a.id} label={`Keep right, remove left`} />
        </div>
      </CardContent>
    </Card>
  );
}

function MergeForm({ keepId, deleteId, label }: { keepId: string; deleteId: string; label: string }) {
  return (
    <Form method="post">
      <input type="hidden" name="_action" value="merge" />
      <input type="hidden" name="keepId" value={keepId} />
      <input type="hidden" name="deleteId" value={deleteId} />
      <Button type="submit" variant="outline" size="sm" className="flex items-center gap-1.5">
        <IconUsers className="size-3.5" aria-hidden="true" />
        {label}
      </Button>
    </Form>
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
