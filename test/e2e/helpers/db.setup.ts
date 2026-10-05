import { test as setup } from "@playwright/test";
import { E2E_ORG_EMAIL } from "test/e2e/helpers/auth";
import db from "test/e2e/helpers/db";

import { AccountType } from "~/lib/constants";

setup("setup db", async () => {
  // cleanup the existing database
  await db.$transaction([
    db.transaction.deleteMany({ where: { account: { description: { contains: "E2E" } } } }),
    db.transactionItem.deleteMany({ where: { description: { contains: "E2E" } } }),
    db.account.deleteMany({ where: { description: { contains: "E2E" } } }),
    db.membership.deleteMany({ where: { org: { primaryEmail: E2E_ORG_EMAIL } } }),
    db.organization.deleteMany({ where: { primaryEmail: E2E_ORG_EMAIL } }),
  ]);

  const org = await db.organization.create({
    data: {
      primaryEmail: E2E_ORG_EMAIL,
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
