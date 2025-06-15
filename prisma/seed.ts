/* eslint-disable no-console */
import { faker } from "@faker-js/faker";
import { MembershipRole, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import dayjs from "dayjs";

import {
  ContactType,
  accountTypes,
  contactTypes,
  defaultAccounts,
  engagementTypes,
  transactionCategories,
  transactionItemMethods,
  transactionItemTypes,
} from "~/lib/constants";

const db = new PrismaClient();

async function seed() {
  // cleanup the existing database
  await db.$transaction([
    db.transactionCategory.deleteMany(),
    db.transactionItem.deleteMany(),
    db.transaction.deleteMany(),
    db.membership.deleteMany(),
    db.user.deleteMany(),
    db.accountSubscription.deleteMany(),
    db.contact.deleteMany(),
    db.accountSubscription.deleteMany(),
    db.accountType.deleteMany(),
    db.account.deleteMany(),
    db.organization.deleteMany(),
    db.engagementType.deleteMany(),
    db.engagement.deleteMany(),
    db.transactionItemType.deleteMany(),
    db.contactType.deleteMany(),
    db.accountType.deleteMany(),
    db.transactionItemMethod.deleteMany(),
  ]);

  // TODO: change admin org host
  const _org = await db.organization.create({ data: { name: "NP Ally" } });
  const org = await db.organization.create({ data: { name: "Alliance 436" } });
  const org2 = await db.organization.create({ data: { name: "Moms of Courage" } });

  await db.$transaction([
    db.transactionCategory.createMany({ data: transactionCategories }),
    db.transactionItemType.createMany({ data: transactionItemTypes }),
    db.transactionItemMethod.createMany({ data: transactionItemMethods }),
    db.contactType.createMany({ data: contactTypes }),
    db.accountType.createMany({ data: accountTypes }),
    db.engagementType.createMany({ data: engagementTypes }),
  ]);

  const email = "paulh.morris@gmail.com";

  const hashedPassword = await bcrypt.hash("password", 10);

  await db.user.create({
    data: {
      username: email,
      role: UserRole.SUPERADMIN,
      contact: {
        create: {
          firstName: "Paul",
          lastName: "Morris",
          email,
          typeId: ContactType.Outreach,
          orgId: org.id,
        },
      },
      password: {
        create: {
          hash: hashedPassword,
        },
      },
      memberships: {
        createMany: {
          data: [
            {
              orgId: org.id,
              role: MembershipRole.ADMIN,
            },
            {
              orgId: org2.id,
              role: MembershipRole.ADMIN,
            },
          ],
        },
      },
    },
  });

  const user = await db.user.create({
    data: {
      username: "cassian@therebellion.com",
      role: "USER",
      contact: {
        create: {
          firstName: "Cassian",
          lastName: "Andor",
          email: "cassian@therebllion.com",
          typeId: ContactType.Missionary,
          orgId: org.id,
        },
      },
      memberships: {
        create: {
          orgId: org.id,
          role: MembershipRole.MEMBER,
        },
      },
      password: {
        create: {
          hash: hashedPassword,
        },
      },
    },
  });

  const donorContact = await db.contact.create({
    data: {
      firstName: "Joe",
      lastName: "Donor",
      email: "mr@donor.com",
      phone: "5555555555",
      typeId: 1,
      address: {
        create: {
          street: "1234 Main St",
          city: "Anytown",
          state: "CA",
          zip: "12345",
          country: "USA",
          orgId: org.id,
        },
      },
      orgId: org.id,
    },
  });

  const donorContact2 = await db.contact.create({
    data: {
      firstName: "Joe",
      lastName: "Donor",
      email: "mr@donor.com",
      phone: "5555555555",
      typeId: 1,
      address: {
        create: {
          street: "1234 Main St",
          city: "Anytown",
          state: "CA",
          zip: "12345",
          country: "USA",
          orgId: org2.id,
        },
      },
      orgId: org2.id,
    },
  });

  const account = await db.account.create({
    data: {
      typeId: 3,
      code: "3001-CA",
      subscribers: {
        create: {
          subscriberId: user.contactId,
        },
      },
      description: "Jessica Caudle - Ministry Fund",
      orgId: org.id,
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  const account2 = await db.account.create({
    data: {
      typeId: 3,
      code: "3001-MC",
      subscribers: {
        create: {
          subscriberId: user.contactId,
        },
      },
      description: "MoC - Ministry Fund",
      orgId: org2.id,
      user: {
        connect: {
          id: user.id,
        },
      },
    },
  });

  await db.account.createMany({
    data: defaultAccounts.map((a) => ({
      ...a,
      orgId: org.id,
    })),
  });

  await db.account.createMany({
    data: defaultAccounts.map((a) => ({
      ...a,
      orgId: org2.id,
    })),
  });

  for (let i = 0; i < 100; i++) {
    await db.transaction.create({
      data: {
        amountInCents: faker.number.int({ min: 100, max: 100_000 }),
        date: dayjs(faker.date.past()).startOf("day").toDate(),
        description: faker.lorem.word(),
        accountId: account.id,
        contactId: donorContact.id,
        categoryId: faker.number.int({ min: 1, max: 18 }),
        orgId: org.id,
        transactionItems: {
          createMany: {
            data: [
              {
                amountInCents: faker.number.int({ min: 100, max: 50_000 }),
                description: faker.lorem.word(),
                typeId: 1,
                orgId: org.id,
              },
              {
                amountInCents: faker.number.int({ min: 100, max: 50_000 }),
                description: faker.lorem.word(),
                typeId: 2,
                orgId: org.id,
              },
            ],
          },
        },
      },
    });
  }

  for (let i = 0; i < 10; i++) {
    await db.transaction.create({
      data: {
        amountInCents: faker.number.int({ min: 100, max: 100_000 }),
        date: faker.date.past(),
        description: faker.lorem.word(),
        accountId: account2.id,
        contactId: donorContact2.id,
        categoryId: faker.number.int({ min: 1, max: 18 }),
        orgId: org2.id,
        transactionItems: {
          createMany: {
            data: [
              {
                amountInCents: faker.number.int({ min: 100, max: 50_000 }),
                description: faker.lorem.word(),
                typeId: 1,
                orgId: org2.id,
              },
              {
                amountInCents: faker.number.int({ min: 100, max: 50_000 }),
                description: faker.lorem.word(),
                typeId: 2,
                orgId: org2.id,
              },
            ],
          },
        },
      },
    });
  }

  console.log(`Database has been seeded. 🌱`);
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
