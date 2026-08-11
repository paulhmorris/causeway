import { ContactType } from "~/lib/constants";
import {
  canBeDeleted,
  displayName,
  findEmailCrossDuplicates,
  findNameDuplicates,
  type HealthContact,
  isMergeablePair,
  isMissingRequiredEmail,
  mergeDescription,
  type PairedContact,
  pairKey,
} from "~/lib/contact-health";

function buildContact(overrides: Partial<HealthContact> & { id: string }): HealthContact {
  return {
    firstName: "Riley",
    lastName: "Chen",
    organizationName: null,
    email: null,
    alternateEmail: null,
    phone: null,
    typeId: ContactType.Donor,
    type: { name: "Donor" },
    user: null,
    ...overrides,
  };
}

function buildPaired(overrides: Partial<PairedContact> & { id: string }): PairedContact {
  return {
    ...buildContact(overrides),
    _count: { transactions: 0, engagements: 0, accountSubscriptions: 0, assignedUsers: 0 },
    ...overrides,
  };
}

/** Pairs are unordered, so compare them as sorted id sets. */
function pairIds(pairs: Array<[HealthContact, HealthContact]>) {
  return pairs.map(([a, b]) => [a.id, b.id].sort().join("|")).sort();
}

describe("displayName", () => {
  it("falls back to the organization name when there is no personal name", () => {
    expect(
      displayName(buildContact({ id: "a", firstName: null, lastName: null, organizationName: "Acme Foundation" })),
    ).toBe("Acme Foundation");
  });

  it("prefers the personal name and tolerates a missing half", () => {
    expect(displayName(buildContact({ id: "a", lastName: null }))).toBe("Riley");
    expect(displayName(buildContact({ id: "a", firstName: "  Riley  ", lastName: " Chen " }))).toBe("Riley Chen");
  });

  it("is empty when the contact has no name at all", () => {
    expect(displayName(buildContact({ id: "a", firstName: null, lastName: null }))).toBe("");
  });
});

describe("findNameDuplicates", () => {
  it("matches regardless of case and surrounding whitespace", () => {
    const pairs = findNameDuplicates([
      buildContact({ id: "a" }),
      buildContact({ id: "b", firstName: "riley", lastName: " CHEN " }),
    ]);

    expect(pairIds(pairs)).toEqual(["a|b"]);
  });

  it("pairs organizations by their organization name", () => {
    const pairs = findNameDuplicates([
      buildContact({ id: "a", firstName: null, lastName: null, organizationName: "Acme Foundation" }),
      buildContact({ id: "b", firstName: null, lastName: null, organizationName: "acme foundation" }),
      buildContact({ id: "c", firstName: null, lastName: null, organizationName: "Other Org" }),
    ]);

    expect(pairIds(pairs)).toEqual(["a|b"]);
  });

  it("emits every combination within a group larger than two", () => {
    const pairs = findNameDuplicates([buildContact({ id: "a" }), buildContact({ id: "b" }), buildContact({ id: "c" })]);

    expect(pairIds(pairs)).toEqual(["a|b", "a|c", "b|c"]);
  });

  it("ignores contacts with no name rather than grouping them together", () => {
    const pairs = findNameDuplicates([
      buildContact({ id: "a", firstName: null, lastName: null }),
      buildContact({ id: "b", firstName: null, lastName: null }),
    ]);

    expect(pairs).toEqual([]);
  });
});

describe("findEmailCrossDuplicates", () => {
  it("matches one contact's alternate email against another's primary", () => {
    const pairs = findEmailCrossDuplicates([
      buildContact({ id: "a", email: "riley@work.com", alternateEmail: "riley@home.com" }),
      buildContact({ id: "b", email: "riley@home.com" }),
    ]);

    expect(pairIds(pairs)).toEqual(["a|b"]);
  });

  it("reports a mutual match only once", () => {
    const pairs = findEmailCrossDuplicates([
      buildContact({ id: "a", email: "one@x.com", alternateEmail: "two@x.com" }),
      buildContact({ id: "b", email: "two@x.com", alternateEmail: "one@x.com" }),
    ]);

    expect(pairIds(pairs)).toEqual(["a|b"]);
  });

  it("does not pair a contact whose own alternate email matches its own primary", () => {
    const pairs = findEmailCrossDuplicates([
      buildContact({ id: "a", email: "same@x.com", alternateEmail: "same@x.com" }),
    ]);

    expect(pairs).toEqual([]);
  });
});

describe("pairKey", () => {
  it("is the same whichever way round the pair is given", () => {
    const a = buildContact({ id: "zeta" });
    const b = buildContact({ id: "alpha" });

    expect(pairKey(a, b)).toBe(pairKey(b, a));
    expect(pairKey(a, b)).toBe("alpha-zeta");
  });

  it("distinguishes different pairs sharing a contact", () => {
    expect(pairKey({ id: "a" }, { id: "b" })).not.toBe(pairKey({ id: "a" }, { id: "c" }));
  });
});

describe("merge safety", () => {
  const plain = buildContact({ id: "plain" });
  const backsLogin = buildContact({ id: "staff", user: { id: "user1" } });

  it("refuses to delete a contact that backs a user account", () => {
    // Contact.delete cascades to User, so this is the rule that stops a merge deleting a login.
    expect(canBeDeleted(plain)).toBe(true);
    expect(canBeDeleted(backsLogin)).toBe(false);
  });

  it("keeps a pair where only one side backs a login, since one direction is still legal", () => {
    expect(isMergeablePair([plain, backsLogin])).toBe(true);
    expect(isMergeablePair([backsLogin, plain])).toBe(true);
  });

  it("drops a pair where both sides back a login", () => {
    expect(isMergeablePair([backsLogin, buildContact({ id: "staff2", user: { id: "user2" } })])).toBe(false);
  });
});

describe("isMissingRequiredEmail", () => {
  it("flags donors with no email", () => {
    expect(isMissingRequiredEmail({ email: null, typeId: ContactType.Donor })).toBe(true);
    expect(isMissingRequiredEmail({ email: null, typeId: ContactType.Donor_and_Missionary })).toBe(true);
  });

  it("ignores types that have no reason to carry an email", () => {
    expect(isMissingRequiredEmail({ email: null, typeId: ContactType.Staff })).toBe(false);
    expect(isMissingRequiredEmail({ email: null, typeId: ContactType.Organization })).toBe(false);
    expect(isMissingRequiredEmail({ email: null, typeId: ContactType.External })).toBe(false);
  });

  it("ignores donors that already have an email", () => {
    expect(isMissingRequiredEmail({ email: "riley@x.com", typeId: ContactType.Donor })).toBe(false);
  });
});

describe("mergeDescription", () => {
  it("names the side being deleted and lists what moves", () => {
    const remove = buildPaired({
      id: "b",
      email: "riley@old.com",
      _count: { transactions: 12, engagements: 3, accountSubscriptions: 0, assignedUsers: 1 },
    });

    const description = mergeDescription(remove, "left", "right");

    expect(description).toContain("The contact on the right (riley@old.com) will be permanently deleted.");
    expect(description).toContain(
      "12 transactions, 3 engagements and 1 assignment will move to the contact on the left.",
    );
    expect(description).toContain("This cannot be undone.");
  });

  it("singularizes a count of one and omits relations with nothing to move", () => {
    const remove = buildPaired({
      id: "b",
      email: "riley@old.com",
      _count: { transactions: 1, engagements: 0, accountSubscriptions: 0, assignedUsers: 0 },
    });

    const description = mergeDescription(remove, "left", "right");

    expect(description).toContain("1 transaction will move");
    expect(description).not.toContain("engagement");
  });

  it("says so when there is nothing attached", () => {
    const description = mergeDescription(buildPaired({ id: "b", email: "riley@old.com" }), "left", "right");

    expect(description).toContain("It has nothing attached to move.");
  });

  it("warns about dropped rows only when subscriptions or assignments exist", () => {
    const withSubs = mergeDescription(
      buildPaired({
        id: "b",
        _count: { transactions: 0, engagements: 0, accountSubscriptions: 2, assignedUsers: 0 },
      }),
      "left",
      "right",
    );
    const withoutSubs = mergeDescription(
      buildPaired({ id: "b", _count: { transactions: 5, engagements: 0, accountSubscriptions: 0, assignedUsers: 0 } }),
      "left",
      "right",
    );

    expect(withSubs).toContain("deleted rather than moved");
    expect(withoutSubs).not.toContain("deleted rather than moved");
  });

  it("falls back through alternate email to a placeholder when there is no primary", () => {
    expect(mergeDescription(buildPaired({ id: "b", alternateEmail: "alt@x.com" }), "left", "right")).toContain(
      "(alt@x.com)",
    );
    expect(mergeDescription(buildPaired({ id: "b" }), "left", "right")).toContain("(no email on file)");
  });
});
