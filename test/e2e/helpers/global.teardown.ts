import { test as teardown } from "@playwright/test";

import db from "./db";

teardown("delete test data", async () => {
  const [memberships, users, contacts, trxItems, trx, accounts, org] = await db.$transaction([
    db.membership.deleteMany({ where: { user: { username: { contains: "e2e-" } } } }),
    db.user.deleteMany({ where: { username: { contains: "e2e-" } } }),
    db.contact.deleteMany({ where: { email: { contains: "e2e-" } } }),
    db.transactionItem.deleteMany({ where: { transaction: { account: { description: { contains: "E2E" } } } } }),
    db.transaction.deleteMany({ where: { account: { description: { contains: "E2E" } } } }),
    db.account.deleteMany({ where: { description: { contains: "E2E" } } }),
    db.organization.deleteMany({ where: { host: { contains: "E2E-Test" } } }),
  ]);

  console.info("Deleted test data:", {
    memberships: memberships.count,
    users: users.count,
    contacts: contacts.count,
    transactionItems: trxItems.count,
    transactions: trx.count,
    accounts: accounts.count,
    organizations: org.count,
  });
});
