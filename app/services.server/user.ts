import { UserRole } from "@prisma/client";
import { z } from "zod/v4";

import { newUserSchema } from "~/components/forms/new-user-form";
import { clerkClient } from "~/integrations/clerk.server";
import { db } from "~/integrations/prisma.server";

export const UserService = {
  async create(data: z.infer<typeof newUserSchema> & { orgId: string }) {
    const { role, username, accountId, orgId, ...contact } = data;
    const clerkUser = await this.invite(username);
    const user = await db.user.create({
      data: {
        username,
        clerkId: clerkUser.id,
        role: UserRole.USER,
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

    return user;
  },

  invite(emailAddress: string) {
    return clerkClient.invitations.createInvitation({ emailAddress });
  },
};
