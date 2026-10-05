import { clerk } from "@clerk/testing/playwright";
import { faker } from "@faker-js/faker";
import type { Page } from "@playwright/test";
import { MembershipRole, UserRole } from "@prisma/client";
import prisma from "test/e2e/helpers/db";

import { clerkClient } from "~/integrations/clerk.server";
import { ContactType } from "~/lib/constants";

export const E2E_ORG_EMAIL = "e2e-test@teamcauseway.com";

/** Teardown deletes users, contacts, and Clerk users by this prefix. */
export function e2eEmail(label: string) {
  return `e2e-${label}-${faker.string.alphanumeric(8).toLowerCase()}@example.com`;
}

export function createClerkUser(email: string) {
  return clerkClient.users.createUser({
    emailAddress: [email],
    firstName: "Admin",
    lastName: "E2E",
    skipPasswordRequirement: true,
    privateMetadata: { isTest: true },
  });
}

/**
 * Creates an org admin. With `linked: false` the user has no `clerkId`,
 * like an invited user who hasn't signed in yet.
 */
export async function createAdmin({ linked = true }: { linked?: boolean } = {}) {
  const email = e2eEmail("admin");
  const org = await prisma.organization.findFirstOrThrow({ where: { primaryEmail: E2E_ORG_EMAIL } });
  const clerkUser = await createClerkUser(email);

  const user = await prisma.user.create({
    data: {
      clerkId: linked ? clerkUser.id : null,
      role: UserRole.USER,
      username: email,
      memberships: { create: { orgId: org.id, role: MembershipRole.ADMIN } },
      contact: {
        create: { orgId: org.id, typeId: ContactType.Staff, firstName: "Admin", lastName: "E2E", email },
      },
    },
  });
  return { ...user, clerkUserId: clerkUser.id };
}

/** `/no-access` has no loader, so it's a safe place to load Clerk before signing in. */
export async function signIn(page: Page, email: string) {
  await page.goto("/no-access");
  await clerk.signIn({ page, emailAddress: email });
}
