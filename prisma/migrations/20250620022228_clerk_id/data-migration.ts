import { PrismaClient } from "@prisma/client";

import { clerkClient } from "~/integrations/clerk.server";
const db = new PrismaClient();

async function main() {
  console.info("Starting data migration...");
  const allUsers = await db.user.findMany({
    select: {
      id: true,
      clerkId: true,
      username: true,
      createdAt: true,
      password: {
        select: { hash: true },
      },
      contact: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  console.info(`Found ${allUsers.length} users to process.`);

  for (const user of allUsers) {
    if (!user.password?.hash) {
      console.warn(`User ${user.username} (${user.id}) has no password hash, skipping Clerk ID creation.`);
      continue;
    }

    console.info(`Processing user: ${user.username} (${user.id})`);
    if (!user.clerkId) {
      console.info(`User ${user.username} has no Clerk ID, creating...`);
      try {
        const clerkUser = await clerkClient.users.createUser({
          externalId: user.id,
          passwordDigest: user.password.hash,
          passwordHasher: "bcrypt",
          createdAt: user.createdAt,
          emailAddress: [user.username],
          lastName: user.contact.lastName ?? undefined,
          firstName: user.contact.firstName ?? undefined,
        });
        await db.user.update({
          where: { id: user.id },
          data: { clerkId: clerkUser.id },
        });
        console.info(`Created Clerk user with ID: ${clerkUser.id}!`);
      } catch (error) {
        console.error(`Error creating Clerk user for ${user.username}:`, error);
        continue;
      }
    } else {
      console.info(`User ${user.username} already has Clerk ID: ${user.clerkId}`);
    }
  }
}

main()
  .then(() => {
    console.info("Data migration completed successfully.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error during data migration:", error);
    process.exit(1);
  });
