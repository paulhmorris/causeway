import { z } from "zod/v4";

import { newUserSchema } from "~/components/forms/new-user-form";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/prisma.server";

export const UserService = {
  async create(data: z.infer<typeof newUserSchema> & { orgId: string }) {
    const { role, username, accountId, orgId, systemRole, ...contact } = data;

    const user = await db.user.create({
      select: { id: true, contactId: true },
      data: {
        username,
        role: systemRole,
        memberships: {
          create: { orgId, role },
        },
        account: {
          connect: accountId ? { id: accountId } : undefined,
        },
        contact: {
          create: {
            orgId,
            email: username,
            ...contact,
          },
        },
      },
    });

    // Create account subscription
    if (accountId) {
      await db.account.update({
        select: {},
        where: { id: accountId, orgId },
        data: {
          subscribers: {
            create: { subscriberId: user.contactId },
          },
        },
      });
    }

    const clerkUser = await this.invite(username);
    await db.user.update({
      where: { id: user.id },
      data: { clerkId: clerkUser.id },
    });
    return user;
  },

  invite(emailAddress: string) {
    return clerkClient.invitations.createInvitation({ emailAddress });
  },
};
