import { Prisma } from "@prisma/client";
import { IconAlertTriangle, IconCheck, IconUsers, IconX } from "@tabler/icons-react";
import { useEffect, useMemo } from "react";
import { ActionFunctionArgs, Link, LoaderFunctionArgs, useLoaderData } from "react-router";
import { useLocalStorage } from "usehooks-ts";
import { z } from "zod/v4";

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { ConfirmDestructiveModal } from "~/components/modals/confirm-destructive-modal";
import { PageContainer } from "~/components/page-container";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Callout } from "~/components/ui/callout";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Separator } from "~/components/ui/separator";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Sentry } from "~/integrations/sentry";
import {
  canBeDeleted,
  contactHealthSelect,
  displayName,
  findEmailCrossDuplicates,
  findNameDuplicates,
  type HealthContact,
  isMergeablePair,
  isMissingRequiredEmail,
  mergeCountsSelect,
  mergeDescription,
  type Pair,
  type PairedContact,
  pairKey,
} from "~/lib/contact-health";
import { handleLoaderError } from "~/lib/responses.server";
import { Toasts } from "~/lib/toast.server";
import { formatPhoneNumber } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

const logger = createLogger("Routes.ContactHealth");

/** Dismissals are one admin's judgement about their own screen, so they stay in the browser. */
const DISMISSED_STORAGE_KEY = "contact-health-dismissed";

const mergeSchema = z.object({
  _action: z.literal("merge"),
  keepId: z.string().min(1),
  deleteId: z.string().min(1),
});

export async function loader(args: LoaderFunctionArgs) {
  await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  // The session helpers throw Responses, which handleLoaderError would turn into a 500, so the guard
  // only covers the queries below it.
  try {
    const contacts = await db.contact.findMany({
      where: { orgId },
      select: contactHealthSelect,
      orderBy: { createdAt: "asc" },
    });

    const nameDuplicates = findNameDuplicates(contacts).filter(isMergeablePair);
    const emailCrossDuplicates = findEmailCrossDuplicates(contacts).filter(isMergeablePair);

    // Only the contacts that ended up in a pair need relation counts, and only the merge confirmation
    // reads them. Counting every contact up front meant four correlated subqueries per row of a table
    // that is almost entirely not duplicated.
    const pairedIds = [...nameDuplicates, ...emailCrossDuplicates].flatMap(([a, b]) => [a.id, b.id]);
    const counts = await db.contact.findMany({
      where: { id: { in: [...new Set(pairedIds)] } },
      select: { id: true, _count: { select: mergeCountsSelect } },
    });
    const countsById = new Map(counts.map((c) => [c.id, c._count]));

    const withCounts = ([a, b]: Pair<HealthContact>): Pair<PairedContact> => [
      { ...a, _count: countsById.get(a.id) ?? EMPTY_COUNTS },
      { ...b, _count: countsById.get(b.id) ?? EMPTY_COUNTS },
    ];

    const missingEmail = contacts.filter(isMissingRequiredEmail);

    logger.info("Contact health scanned", {
      orgId,
      contacts: contacts.length,
      nameDuplicates: nameDuplicates.length,
      emailCrossDuplicates: emailCrossDuplicates.length,
      missingEmail: missingEmail.length,
    });

    return {
      nameDuplicates: nameDuplicates.map(withCounts),
      emailCrossDuplicates: emailCrossDuplicates.map(withCounts),
      missingEmail,
    };
  } catch (e) {
    handleLoaderError(e, args.request);
  }
}

const EMPTY_COUNTS: PairedContact["_count"] = {
  transactions: 0,
  engagements: 0,
  accountSubscriptions: 0,
  assignedUsers: 0,
};

export async function action(args: ActionFunctionArgs) {
  const user = await SessionService.requireAdmin(args);
  const orgId = await SessionService.requireOrgId(args);

  const data = Object.fromEntries(await args.request.formData());
  const result = mergeSchema.safeParse(data);
  if (!result.success) {
    logger.warn("Rejected malformed merge request", { orgId, issues: result.error.issues });
    return Toasts.dataWithError({ success: false }, { message: "Invalid request" });
  }

  const { keepId, deleteId } = result.data;

  // The page only ever pairs two distinct contacts, so this is a hand-made request. Without the
  // guard the transfers would be no-ops and the delete would destroy the contact outright.
  if (keepId === deleteId) {
    logger.warn("Rejected merge of a contact into itself", { orgId, keepId });
    return Toasts.dataWithError(
      { success: false },
      { message: "Can't merge", description: "A contact can't be merged into itself." },
    );
  }

  try {
    // Verify both contacts belong to this org
    const [keep, remove] = await Promise.all([
      db.contact.findUniqueOrThrow({ where: { id: keepId, orgId }, select: { id: true } }),
      db.contact.findUniqueOrThrow({
        where: { id: deleteId, orgId },
        select: {
          id: true,
          user: { select: { id: true } },
          address: { select: { id: true } },
          accountSubscriptions: { select: { id: true, accountId: true } },
          assignedUsers: { select: { id: true, userId: true } },
        },
      }),
    ]);

    // The loader never offers these, so this only catches a stale page or a hand-made request.
    if (remove.user) {
      logger.warn("Refused to merge a contact that backs a user account", { keepId, deleteId });
      return Toasts.dataWithError(
        { success: false },
        {
          message: "Can't merge",
          description: "This contact belongs to a user account. Deactivate the user before merging it away.",
        },
      );
    }

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

    logger.info("Merging contacts", {
      orgId,
      keepId,
      deleteId,
      adminUsername: user.username,
      subscriptions: remove.accountSubscriptions.length,
      assignments: remove.assignedUsers.length,
    });

    const moved = await db.$transaction(async (tx) => {
      // Transfer transactions
      const transactions = await tx.transaction.updateMany({
        where: { contactId: deleteId },
        data: { contactId: keepId },
      });

      // Transfer engagements
      const engagements = await tx.engagement.updateMany({
        where: { contactId: deleteId },
        data: { contactId: keepId },
      });

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
      let address: "moved" | "deleted" | "none" = "none";
      if (remove.address) {
        const keeperAddress = await tx.address.findUnique({ where: { contactId: keepId } });
        if (!keeperAddress) {
          await tx.address.update({ where: { id: remove.address.id }, data: { contactId: keepId } });
          address = "moved";
        } else {
          await tx.address.delete({ where: { id: remove.address.id } });
          address = "deleted";
        }
      }

      // Delete the duplicate contact (cascades receipts link)
      await tx.contact.delete({ where: { id: deleteId } });

      return {
        transactions: transactions.count,
        engagements: engagements.count,
        subscriptionsMoved: subsToTransfer.length,
        subscriptionsDropped: subsToDrop.length,
        assignmentsMoved: assignsToTransfer.length,
        assignmentsDropped: assignsToDrop.length,
        address,
      };
    });

    // The merge is irreversible and leaves no audit trail of its own, so the counts are the record.
    logger.info("Contacts merged", { orgId, keepId, deleteId, adminUsername: user.username, ...moved });

    return Toasts.dataWithSuccess(
      { success: true },
      {
        message: "Contacts merged",
        description: "All transactions, engagements, and subscriptions have been transferred.",
      },
    );
  } catch (error) {
    // findUniqueOrThrow misses when a contact was already merged away, or belongs to another org.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      logger.warn("Merge target not found in this org", { orgId, keepId, deleteId });
      return Toasts.dataWithError(
        { success: false },
        {
          message: "Can't merge",
          description: "One of these contacts no longer exists. Refresh the page and try again.",
        },
      );
    }

    logger.error("Error merging contacts", { error, orgId, keepId, deleteId, adminUsername: user.username });
    Sentry.captureException(error);
    return Toasts.dataWithError(
      { success: false },
      {
        message: "Error",
        description: "An unknown error occurred. Please try again.",
      },
    );
  }
}

export default function ContactHealthPage() {
  const { nameDuplicates, emailCrossDuplicates, missingEmail } = useLoaderData<typeof loader>();
  const [dismissed, setDismissed] = useLocalStorage<Array<string>>(DISMISSED_STORAGE_KEY, []);

  const livePairKeys = useMemo(
    () => new Set([...nameDuplicates, ...emailCrossDuplicates].map(([a, b]) => pairKey(a, b))),
    [nameDuplicates, emailCrossDuplicates],
  );

  // A merged or deleted contact can never form a pair again, so its dismissal would sit in storage
  // forever. Returning the same array when nothing is stale keeps this from writing on every load.
  useEffect(() => {
    setDismissed((prev) =>
      prev.every((key) => livePairKeys.has(key)) ? prev : prev.filter((key) => livePairKeys.has(key)),
    );
  }, [livePairKeys, setDismissed]);

  const dismissedKeys = useMemo(() => new Set(dismissed), [dismissed]);
  const dismiss = (a: PairedContact, b: PairedContact) =>
    setDismissed((prev) => [...new Set([...prev, pairKey(a, b)])]);
  const isDismissed = (a: PairedContact, b: PairedContact) => dismissedKeys.has(pairKey(a, b));

  const visibleNameDups = nameDuplicates.filter(([a, b]) => !isDismissed(a, b));
  const visibleEmailDups = emailCrossDuplicates.filter(([a, b]) => !isDismissed(a, b));
  const totalIssues = visibleNameDups.length + visibleEmailDups.length + missingEmail.length;

  return (
    <>
      <title>Contact Health</title>
      <PageHeader title="Contact Health">
        <div className="flex items-center gap-2">
          {dismissed.length > 0 ? (
            <Button variant="ghost" onClick={() => setDismissed([])}>
              Restore {dismissed.length} dismissed
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/contacts" prefetch="intent">
              Back to Contacts
            </Link>
          </Button>
        </div>
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
              These donors have no email address on file, so they can't be sent a giving receipt. Other contact types
              are not listed here.
            </p>
            <div className="divide-border divide-y rounded-md border">
              {missingEmail.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <span className="font-medium">{displayName(c) || "—"}</span>
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

function ContactColumn({ contact }: { contact: PairedContact }) {
  const name = displayName(contact) || "—";
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">{name}</p>
        {contact.user ? <Badge variant="secondary">User account</Badge> : null}
      </div>
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

function DuplicatePairCard({ a, b, onDismiss }: { a: PairedContact; b: PairedContact; onDismiss: () => void }) {
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
          {canBeDeleted(b) ? <MergeAction keep={a} remove={b} keepSide="left" removeSide="right" /> : null}
          {canBeDeleted(a) ? <MergeAction keep={b} remove={a} keepSide="right" removeSide="left" /> : null}
        </div>
        {canBeDeleted(a) && canBeDeleted(b) ? null : (
          <p className="text-muted-foreground mt-2 text-xs">
            Only one direction is offered: a contact attached to a user account can be kept, but removing it would
            delete the account.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MergeAction({
  keep,
  remove,
  keepSide,
  removeSide,
}: {
  keep: PairedContact;
  remove: PairedContact;
  keepSide: string;
  removeSide: string;
}) {
  return (
    <ConfirmDestructiveModal
      method="post"
      actionValue="merge"
      fields={{ keepId: keep.id, deleteId: remove.id }}
      triggerLabel={`Keep ${keepSide}, remove ${removeSide}`}
      triggerIcon={<IconUsers className="size-3.5" aria-hidden="true" />}
      confirmLabel="Merge contacts"
      description={mergeDescription(remove, keepSide, removeSide)}
    />
  );
}

export function ErrorBoundary() {
  return <ErrorComponent />;
}
