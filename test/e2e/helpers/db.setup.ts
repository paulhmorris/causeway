import { test as setup } from "@playwright/test";

import db from "test/e2e/helpers/db";
import { AccountType } from "~/lib/constants";

setup("setup db", async () => {
  // cleanup the existing database
  await db.$transaction([
    db.transaction.deleteMany({ where: { account: { description: { contains: "E2E" } } } }),
    db.transactionItem.deleteMany({ where: { description: { contains: "E2E" } } }),
    db.account.deleteMany({ where: { description: { contains: "E2E" } } }),
    db.membership.deleteMany({ where: { org: { primaryEmail: "e2e-test@teamcauseway.com" } } }),
    db.organization.deleteMany({ where: { primaryEmail: "e2e-test@teamcauseway.com" } }),
  ]);

  const org = await db.organization.create({
    data: {
      primaryEmail: "e2e-test@teamcauseway.com",
      name: "E2E-Test Organization",
    },
  });

  const [accounts] = await db.$transaction([
    db.account.createMany({
      data: [
        {
          orgId: org.id,
          code: "9998-E2E",
          typeId: AccountType.Benevolence,
          description: "E2E Account 1",
        },
        {
          orgId: org.id,
          code: "9999-E2E",
          typeId: AccountType.Benevolence,
          description: "E2E Account 2",
        },
      ],
    }),
  ]);
  console.info(`DB Setup: Created ${accounts.count} accounts`);
});
