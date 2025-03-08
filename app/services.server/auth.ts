import { Password, User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";

import { sendEmail } from "~/integrations/email.server";
import { db } from "~/integrations/prisma.server";

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePasswords(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function generateVerificationCode(userId: string) {
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
    console.info("DEBUG: User not found");
    return null;
  }

  if (user.verificationCode?.toLowerCase() !== code.toLowerCase()) {
    console.info("DEBUG: Verification code does not match");
    return null;
  }

  if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
    console.info("DEBUG: Verification code expired");
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
    console.info("DEBUG: User is locked out");
    const { password: _password, ...userWithoutPw } = userWithPassword;
    return userWithoutPw;
  }

  const isValid = await comparePasswords(password, userWithPassword.password.hash);

  if (!isValid) {
    if (userWithPassword.loginAttempts >= 5) {
      console.info("DEBUG: Locking out user");
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
      console.info("DEBUG: Invalid password, incrementing login attempts");
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
  }

  const { password: _password, ...userWithoutPassword } = userWithPassword;

  return userWithoutPassword;
}
