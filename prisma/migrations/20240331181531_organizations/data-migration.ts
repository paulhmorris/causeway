import { MembershipRole, PrismaClient, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(
    async (tx) => {
      // Get the default organization
      let defaultOrg = await tx.organization.findFirst();
      defaultOrg ??= await tx.organization.create({
        data: {
          name: "Alliance 436",
          host: "alliance436.org",
        },
      });

      const users = await tx.user.findMany({
        select: {
          id: true,
          role: true,
          contactId: true,
          account: {
            select: {
              id: true,
            },
          },
        },
      });
      for (const user of users) {
        // Subscribe each user to their account
        if (user.account) {
          await tx.accountSubscription.upsert({
            where: {
              accountId_subscriberId: {
                accountId: user.account.id,
                subscriberId: user.contactId,
              },
            },
            update: {},
            create: {
              accountId: user.account.id,
              subscriberId: user.contactId,
            },
          });
          console.info(`Subscribed user ${user.id} to account ${user.account.id}`);
        }
        // Create a membership for each user
        await tx.user.update({
          where: { id: user.id },
          data: {
            memberships: {
              create: {
                role:
                  user.role === UserRole.ADMIN
                    ? MembershipRole.ADMIN
                    : user.role === UserRole.SUPERADMIN
                      ? MembershipRole.ADMIN
                      : MembershipRole.MEMBER,
                orgId: defaultOrg.id,
              },
            },
          },
        });
        console.info(`Created membership for user ${user.id}`);
      }

      // Link everything to the default organization
      const account = await tx.account.updateMany({ data: { orgId: defaultOrg.id } });
      const transaction = await tx.transaction.updateMany({ data: { orgId: defaultOrg.id } });
      const transactionItem = await tx.transactionItem.updateMany({ data: { orgId: defaultOrg.id } });
      const reimbursementRequest = await tx.reimbursementRequest.updateMany({ data: { orgId: defaultOrg.id } });
      const receipt = await tx.receipt.updateMany({ data: { orgId: defaultOrg.id } });
      const contact = await tx.contact.updateMany({ data: { orgId: defaultOrg.id } });
      const contactAssigment = await tx.contactAssigment.updateMany({ data: { orgId: defaultOrg.id } });
      const address = await tx.address.updateMany({ data: { orgId: defaultOrg.id } });
      const engagement = await tx.engagement.updateMany({ data: { orgId: defaultOrg.id } });
      const announcement = await tx.announcement.updateMany({ data: { orgId: defaultOrg.id } });

      console.info("Linked everything to the default organization:");
      console.info({
        account,
        transaction,
        transactionItem,
        reimbursementRequest,
        receipt,
        contact,
        contactAssigment,
        address,
        engagement,
        announcement,
      });
    },
    {
      maxWait: 5000,
      timeout: 10_000,
    },
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
