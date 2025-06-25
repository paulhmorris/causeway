import { test as teardown } from "@playwright/test";

import { clerkClient } from "~/integrations/clerk.server";

import db from "./db";

teardown("delete test data", async () => {
  const [userToDelete, memberships, contacts, trxItems, trx, accounts, org] = await db.$transaction([
    db.user.findFirst({ where: { username: { contains: "e2e-" } } }),
    db.membership.deleteMany({ where: { user: { username: { contains: "e2e-" } } } }),
    db.contact.deleteMany({ where: { email: { contains: "e2e-" } } }),
    db.transactionItem.deleteMany({ where: { transaction: { account: { description: { contains: "E2E" } } } } }),
    db.transaction.deleteMany({ where: { account: { description: { contains: "E2E" } } } }),
    db.account.deleteMany({ where: { description: { contains: "E2E" } } }),
    db.organization.deleteMany({ where: { primaryEmail: { contains: "e2e-test" } } }),
  ]);

  if (userToDelete?.clerkId) {
    console.info(`Deleting Clerk user with ID: ${userToDelete.clerkId}`);
    await clerkClient.users.deleteUser(userToDelete.clerkId);
  }

  console.info("Deleted test data:", {
    user: userToDelete?.username,
    memberships: memberships.count,
    contacts: contacts.count,
    transactionItems: trxItems.count,
    transactions: trx.count,
    accounts: accounts.count,
    organizations: org.count,
  });
});
