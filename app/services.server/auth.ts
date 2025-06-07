import { Password, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { customAlphabet } from "nanoid";

import { sendEmail } from "~/integrations/email.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";

const logger = createLogger("AuthService");

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePasswords(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function generateVerificationCode(userId: string) {
  const nanoid = customAlphabet("1234567890", 6);
  const verificationCode = nanoid(6);

  const user = await db.user.update({
    where: { id: userId },
    data: {
      verificationCode,
      verificationCodeExpiry: new Date(Date.now() + 1000 * 60 * 15),
    },
  });

  await sendEmail({
    from: "Alliance 436 <no-reply@alliance436.org>",
    to: user.username,
    subject: "Your verification code",
    html: `Your verification code is ${verificationCode.toUpperCase()}. It is valid for 15 minutes.`,
  });
}

export async function checkVerificationCode(email: string, code: string) {
  const user = await db.user.findUnique({
    where: { username: email },
    select: {
      id: true,
      verificationCode: true,
      verificationCodeExpiry: true,
      memberships: true,
    },
  });

  if (!user) {
    logger.info(`User with email ${email} not found`);
    return null;
  }

  if (user.verificationCode?.toLowerCase() !== code.toLowerCase()) {
    logger.info(`User ${email}: supplied invalid verification code`);
    return null;
  }

  if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
    logger.info(`User ${email} supplied expired verification code`);
    return null;
  }

  await db.user.update({
    where: { id: user.id },
    data: { verificationCode: null, verificationCodeExpiry: null },
  });

  return user;
}

export async function verifyLogin({
  username,
  password,
}: {
  username: NonNullable<User["username"]>;
  password: Password["hash"];
}) {
  let userWithPassword = await db.user.findUnique({
    where: {
      // Not deactivated
      isActive: true,
      username,
    },
    include: {
      password: true,
      memberships: true,
    },
  });

  if (!userWithPassword || !userWithPassword.password) {
    return null;
  }

  if (userWithPassword.lockoutExpiration && userWithPassword.lockoutExpiration > new Date()) {
    logger.info(`User ${userWithPassword.username} is locked out`);
    const { password: _password, ...userWithoutPw } = userWithPassword;
    return userWithoutPw;
  }

  const isValid = await comparePasswords(password, userWithPassword.password.hash);

  if (!isValid) {
    if (userWithPassword.loginAttempts >= 5) {
      logger.info(`User ${userWithPassword.username} had 5 failed login attempts. Locking them out.`);
      userWithPassword = await db.user.update({
        where: { id: userWithPassword.id },
        data: {
          lockoutExpiration: new Date(Date.now() + 1000 * 60 * 15),
          loginAttempts: 0,
        },
        include: {
          password: true,
          memberships: true,
        },
      });
    } else {
      logger.info(`User ${userWithPassword.username} supplied invalid credentials, incrementing login attempts`);
      userWithPassword = await db.user.update({
        where: { id: userWithPassword.id },
        data: {
          lastLoginAttempt: new Date(),
          loginAttempts: {
            increment: 1,
          },
        },
        include: {
          password: true,
          memberships: true,
        },
      });
    }
    return null;
  }

  const { password: _password, ...userWithoutPassword } = userWithPassword;

  return userWithoutPassword;
}
