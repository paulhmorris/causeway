import { Prisma } from "@prisma/client";

import { ContactType } from "~/lib/constants";

export const contactHealthSelect = {
  id: true,
  firstName: true,
  lastName: true,
  organizationName: true,
  email: true,
  alternateEmail: true,
  phone: true,
  typeId: true,
  type: { select: { name: true } },
  user: { select: { id: true } },
} satisfies Prisma.ContactSelect;

export type HealthContact = Prisma.ContactGetPayload<{ select: typeof contactHealthSelect }>;

export const mergeCountsSelect = {
  transactions: true,
  engagements: true,
  accountSubscriptions: true,
  assignedUsers: true,
} satisfies Prisma.ContactCountOutputTypeSelect;

export const pairedContactSelect = {
  ...contactHealthSelect,
  _count: { select: mergeCountsSelect },
} satisfies Prisma.ContactSelect;

/** A contact shown in a duplicate pair, where the merge confirmation needs its relation counts. */
export type PairedContact = Prisma.ContactGetPayload<{ select: typeof pairedContactSelect }>;

export type Pair<T> = [T, T];

/** A contact row in the contacts table, which flags the same issues the health page reports. */
export const contactListSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  typeId: true,
  type: { select: { name: true } },
  _count: { select: { accountSubscriptions: true } },
} satisfies Prisma.ContactSelect;

export type ListContact = Prisma.ContactGetPayload<{ select: typeof contactListSelect }>;

/** Stable identity for an unordered pair, used as the dismissal key in local storage. */
export function pairKey(a: Pick<HealthContact, "id">, b: Pick<HealthContact, "id">) {
  return [a.id, b.id].sort().join("-");
}

/** Organizations have no first or last name, so their name lives in a different column. */
export function displayName(contact: Pick<HealthContact, "firstName" | "lastName" | "organizationName">) {
  const personal = [contact.firstName, contact.lastName]
    .map((part) => part?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  return personal || contact.organizationName?.trim() || "";
}

function nameKey(contact: HealthContact) {
  return displayName(contact).toLowerCase();
}

/**
 * A merge deletes one of the pair, and `User.contact` cascades, so removing a contact that backs a
 * login would take the user account with it. Such a contact can be the keeper but never the one
 * deleted.
 */
export function canBeDeleted(contact: Pick<HealthContact, "user">) {
  return contact.user === null;
}

export function isMergeablePair<T extends Pick<HealthContact, "user">>([a, b]: Pair<T>) {
  return canBeDeleted(a) || canBeDeleted(b);
}

/** Contacts sharing a normalized name, as every unordered pair within each matching group. */
export function findNameDuplicates(contacts: Array<HealthContact>): Array<Pair<HealthContact>> {
  const byName = new Map<string, Array<HealthContact>>();
  for (const contact of contacts) {
    const key = nameKey(contact);
    if (!key) continue;
    const group = byName.get(key) ?? [];
    group.push(contact);
    byName.set(key, group);
  }

  const pairs: Array<Pair<HealthContact>> = [];
  for (const group of byName.values()) {
    for (let i = 0; i < group.length - 1; i++) {
      for (let j = i + 1; j < group.length; j++) {
        pairs.push([group[i], group[j]]);
      }
    }
  }
  return pairs;
}

/** One contact's alternate email matching another's primary, reported once per unordered pair. */
export function findEmailCrossDuplicates(contacts: Array<HealthContact>): Array<Pair<HealthContact>> {
  const byPrimaryEmail = new Map<string, HealthContact>();
  for (const contact of contacts) {
    if (contact.email) byPrimaryEmail.set(contact.email.toLowerCase(), contact);
  }

  const pairs: Array<Pair<HealthContact>> = [];
  const seen = new Set<string>();
  for (const contact of contacts) {
    if (!contact.alternateEmail) continue;
    const match = byPrimaryEmail.get(contact.alternateEmail.toLowerCase());
    if (!match || match.id === contact.id) continue;

    const key = [contact.id, match.id].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([contact, match]);
  }
  return pairs;
}

/** Only donors are chased for an address — the rest legitimately have no email on file. */
export const TYPE_IDS_NEEDING_EMAIL = [ContactType.Donor, ContactType.Donor_and_Missionary];

/** Prisma filter matching {@link isMissingRequiredEmail}, for counting without loading the rows. */
export const missingRequiredEmailWhere = {
  email: null,
  typeId: { in: TYPE_IDS_NEEDING_EMAIL },
} satisfies Prisma.ContactWhereInput;

export function isMissingRequiredEmail(contact: Pick<HealthContact, "email" | "typeId">) {
  return !contact.email && TYPE_IDS_NEEDING_EMAIL.includes(contact.typeId);
}

/** Missionaries are funded through an account, so one with no subscribers is an incomplete setup. */
const TYPE_IDS_NEEDING_SUBSCRIPTION = [ContactType.Missionary, ContactType.Donor_and_Missionary];

export function isMissingAccountSubscription(contact: Pick<ListContact, "typeId" | "_count">) {
  return contact._count.accountSubscriptions === 0 && TYPE_IDS_NEEDING_SUBSCRIPTION.includes(contact.typeId);
}

/**
 * The single issue worth flagging on a contact row, with the page that fixes it, or null when there
 * is nothing to fix. A missing email is fixed on the edit form; a subscription is managed from the
 * contact's own page.
 */
export function contactWarning(contact: ListContact) {
  if (isMissingRequiredEmail(contact)) {
    return { label: "Missing email", to: `/contacts/${contact.id}/edit` };
  }
  if (isMissingAccountSubscription(contact)) {
    return { label: "No account subscription", to: `/contacts/${contact.id}` };
  }
  return null;
}

function pluralize(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatList(items: Array<string>) {
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Duplicates usually share a name, so the confirmation identifies each side by position and email. */
export function mergeDescription(remove: PairedContact, keepSide: string, removeSide: string) {
  const identifier = remove.email ?? remove.alternateEmail ?? "no email on file";
  const moving = [
    { count: remove._count.transactions, noun: "transaction" },
    { count: remove._count.engagements, noun: "engagement" },
    { count: remove._count.accountSubscriptions, noun: "subscription" },
    { count: remove._count.assignedUsers, noun: "assignment" },
  ]
    .filter((item) => item.count > 0)
    .map((item) => pluralize(item.count, item.noun));

  const sentences = [`The contact on the ${removeSide} (${identifier}) will be permanently deleted.`];

  if (moving.length > 0) {
    sentences.push(`${formatList(moving)} will move to the contact on the ${keepSide}.`);
  } else {
    sentences.push("It has nothing attached to move.");
  }

  // Both relations are uniquely constrained on the contact, so a row that would collide with one the
  // keeper already has can't be re-pointed and is deleted instead.
  if (remove._count.accountSubscriptions > 0 || remove._count.assignedUsers > 0) {
    sentences.push(
      "Its subscriptions and assignments that duplicate one the kept contact already has will be deleted rather than moved.",
    );
  }

  sentences.push("This cannot be undone.");
  return sentences.join(" ");
}
