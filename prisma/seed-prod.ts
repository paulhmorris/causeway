/* eslint-disable no-console */
import { MembershipRole, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import {
  ContactType,
  accountTypes,
  contactTypes,
  defaultAccounts,
  engagementTypes,
  transactionItemMethods,
  transactionItemTypes,
} from "~/lib/constants";

const prisma = new PrismaClient();

async function seed() {
  // cleanup the existing database
  await prisma.$transaction([
    prisma.transactionItem.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.membership.deleteMany(),
    prisma.user.deleteMany(),
    prisma.accountSubscription.deleteMany(),
    prisma.contact.deleteMany(),
    prisma.accountSubscription.deleteMany(),
    prisma.accountType.deleteMany(),
    prisma.account.deleteMany(),
    prisma.organization.deleteMany(),
    prisma.engagementType.deleteMany(),
    prisma.engagement.deleteMany(),
    prisma.transactionItemType.deleteMany(),
    prisma.contactType.deleteMany(),
    prisma.accountType.deleteMany(),
    prisma.transactionItemMethod.deleteMany(),
  ]);

  const org = await prisma.organization.create({
    data: { name: "Alliance 436", subdomain: "alliance436", primaryEmail: "jared@alliance436.org" },
  });

  await prisma.$transaction([
    prisma.transactionItemType.createMany({ data: transactionItemTypes.map((t) => ({ ...t, orgId: org.id })) }),
    prisma.transactionItemMethod.createMany({ data: transactionItemMethods.map((t) => ({ ...t, orgId: org.id })) }),
    prisma.contactType.createMany({ data: contactTypes.map((t) => ({ ...t, orgId: org.id })) }),
    prisma.accountType.createMany({ data: accountTypes.map((t) => ({ ...t, orgId: org.id })) }),
    prisma.engagementType.createMany({ data: engagementTypes.map((t) => ({ ...t, orgId: org.id })) }),
  ]);

  await prisma.user.create({
    data: {
      username: "paulh.morris@gmail.com",
      role: "SUPERADMIN",
      contact: {
        create: {
          firstName: "Paul",
          lastName: "Morris",
          email: "paulh.morris@gmail.com",
          typeId: ContactType.Outreach,
          orgId: org.id,
        },
      },
      password: {
        create: {
          hash: await bcrypt.hash("qVa0gGdSkhEZsDrr", 10),
        },
      },
    },
  });

  await prisma.user.create({
    data: {
      username: "jaredn7@gmail.com",
      role: UserRole.USER,
      memberships: {
        create: {
          orgId: org.id,
          role: MembershipRole.ADMIN,
        },
      },
      contact: {
        create: {
          firstName: "Jared",
          lastName: "Nielsen",
          email: "jaredn7@gmail.com",
          typeId: ContactType.Staff,
          orgId: org.id,
        },
      },
      password: {
        create: {
          hash: await bcrypt.hash("mTs3zV5c6mUP8MMd", 10),
        },
      },
    },
  });

  await prisma.account.createMany({
    data: defaultAccounts.map((a) => ({
      ...a,
      orgId: org.id,
    })),
  });

  console.log(`Production database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
