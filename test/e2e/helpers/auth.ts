import { faker } from "@faker-js/faker";
import { MembershipRole, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

import prisma from "test/e2e/helpers/db";
import { clerkClient } from "~/integrations/clerk.server";
import { ContactType } from "~/lib/constants";

export async function createAdmin() {
  const user = {
    firstName: "Admin",
    lastName: "E2E",
    username: `e2e-admin-${faker.internet.email().toLowerCase()}`,
    password: faker.internet.password(),
  };
  let org = await prisma.organization.findFirst({ where: { primaryEmail: "e2e-test@teamcauseway.com" } });
  org ??= await prisma.organization.create({
    data: {
      primaryEmail: "e2e-test@teamcauseway.com",
      name: "E2E Test Organization",
    },
  });
  const passwordHash = await bcrypt.hash(user.password, 10);
  const clerkUser = await clerkClient.users.createUser({
    externalId: faker.string.uuid(),
    passwordDigest: passwordHash,
    passwordHasher: "bcrypt",
    emailAddress: [user.username],
    lastName: user.lastName,
    firstName: user.firstName,
    privateMetadata: {
      isTest: true,
    },
  });
  const createdUser = await prisma.user.create({
    data: {
      clerkId: clerkUser.id,
      role: UserRole.USER,
      username: user.username,
      password: {
        create: {
          hash: passwordHash,
        },
      },
      memberships: {
        create: {
          orgId: org.id,
          role: MembershipRole.ADMIN,
        },
      },
      contact: {
        create: {
          orgId: org.id,
          typeId: ContactType.Staff,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.username,
        },
      },
    },
  });
  return {
    ...createdUser,
    password: user.password,
  };
}
