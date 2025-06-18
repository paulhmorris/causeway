import { getAuth } from "@clerk/react-router/ssr.server";
import { MembershipRole, Organization, UserRole } from "@prisma/client";
import {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  Session as RemixSession,
  SessionData,
  createCookieSessionStorage,
  redirect,
} from "react-router";
import { createThemeSessionResolver } from "remix-themes";

import { AuthService } from "~/integrations/auth.server";
import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { unauthorized } from "~/lib/responses.server";

class Session {
  public USER_SESSION_KEY = "userId";
  public ORGANIZATION_SESSION_KEY = "orgId";

  private logger = createLogger("SessionService");

  async logout(sessionId: string | null) {
    if (sessionId) {
      await AuthService.revokeSession(sessionId);
    }
    return redirect("/login");
  }

  async getSession(args: LoaderFunctionArgs | ActionFunctionArgs) {
    return getAuth(args);
  }

  async getOrgSession(request: Request) {
    const cookie = request.headers.get("Cookie");
    return sessionStorage.getSession(cookie);
  }

  async commitSession(session: RemixSession<SessionData, SessionData>) {
    return sessionStorage.commitSession(session);
  }

  async getAuth(args: LoaderFunctionArgs | ActionFunctionArgs) {
    return getAuth(args);
  }

  async getUserId(args: LoaderFunctionArgs | ActionFunctionArgs): Promise<string | null> {
    const { userId } = await getAuth(args);
    return userId;
  }

  async getOrgId(request: Request): Promise<Organization["id"] | undefined> {
    const session = await this.getOrgSession(request);
    const orgId = session.get(this.ORGANIZATION_SESSION_KEY) as Organization["id"] | undefined;
    return orgId;
  }

  async getOrg(args: Request | LoaderFunctionArgs | ActionFunctionArgs) {
    const request = args instanceof Request ? args : args.request;
    const orgId = await this.getOrgId(request);
    if (!orgId) {
      this.logger.debug(`no orgId found in session`);
      return null;
    }
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, primaryEmail: true },
    });
    this.logger.debug(`orgId for ${org?.name} found in session`);
    return org;
  }

  async requireOrgId(args: Request | LoaderFunctionArgs | ActionFunctionArgs) {
    const request = args instanceof Request ? args : args.request;
    const orgId = await this.getOrgId(request);
    if (!orgId) {
      this.logger.info(`no orgId found in session`);
      const originURL = new URL(request.url);
      if (originURL.pathname === "/") {
        throw redirect("/login");
      }
      const returnUrl = new URL("/choose-org", originURL.origin);
      returnUrl.searchParams.set("redirectTo", originURL.pathname);
      this.logger.info(`redirecting to ${returnUrl.toString()}`);
      throw redirect(returnUrl.toString());
    }
    return orgId;
  }

  async requireUserId(args: LoaderFunctionArgs, redirectTo: string = new URL(args.request.url).pathname) {
    const sessionUserId = await this.getUserId(args);
    if (!sessionUserId) {
      const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
      this.logger.info(`no userId found in session, redirecting to /login?${searchParams.toString()}`);
      throw redirect(`/login?${searchParams.toString()}`);
    }
    const user = await db.user.findUnique({ where: { clerkId: sessionUserId }, select: { id: true } });
    if (!user) {
      this.logger.error(`User with clerkId ${sessionUserId} not found in database`);
      throw Error("User not found");
    }
    return user.id;
  }

  public async requireUser(args: LoaderFunctionArgs, allowedRoles?: Array<MembershipRole>) {
    const defaultAllowedRoles: Array<MembershipRole> = [MembershipRole.MEMBER, MembershipRole.ADMIN];
    const userId = await this.requireUserId(args);
    const orgId = await this.requireOrgId(args.request);

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        contact: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            typeId: true,
            accountSubscriptions: {
              where: {
                account: { orgId },
              },
              select: {
                accountId: true,
              },
            },
          },
        },
        memberships: {
          include: {
            org: true,
          },
        },
      },
    });

    // User does not exist
    if (!user) {
      this.logger.warn(`user with ID ${userId} not found in database - throwing unauthorized`);
      throw unauthorized({ user });
    }

    // User is not a member of the current organization
    const currentMembership = user.memberships.find((m) => m.orgId === orgId);
    if (!currentMembership) {
      this.logger.warn("No membership in the current org - throwing unauthorized");
      throw unauthorized({ user });
    }

    const access = {
      isMember: currentMembership.role === MembershipRole.MEMBER,
      isAdmin: currentMembership.role === MembershipRole.ADMIN,
      isSuperAdmin: user.role === UserRole.SUPERADMIN,
    };

    // Superadmins are admins in all organizations
    if (user.role === UserRole.SUPERADMIN) {
      return {
        ...user,
        ...access,
        role: MembershipRole.ADMIN,
        systemRole: user.role,
        org: currentMembership.org,
      };
    }

    // If allowedRoles are provided, check if the user has one of the allowed roles
    if (allowedRoles && allowedRoles.length > 0) {
      if (allowedRoles.includes(currentMembership.role)) {
        return {
          ...user,
          ...access,
          role: currentMembership.role,
          systemRole: user.role,
          org: currentMembership.org,
        };
      }
      this.logger.warn(
        `user ${user.username} with role ${user.role} did not have required role ${allowedRoles.join(", ")}`,
      );
      throw unauthorized({ user });
    }

    // Otherwise check if user is a member or admin
    if (defaultAllowedRoles.includes(currentMembership.role)) {
      return {
        ...user,
        ...access,
        role: currentMembership.role,
        systemRole: user.role,
        org: currentMembership.org,
      };
    }

    // Some other scenario
    this.logger.error(
      `Unhandled authentication scenario with user ${user.username} with role ${user.role} and allowed roles ${allowedRoles?.join(", ")}`,
    );
    throw unauthorized({ user });
  }

  async requireAdmin(args: LoaderFunctionArgs) {
    return this.requireUser(args, ["ADMIN"]);
  }

  async createOrgSession(args: {
    fnArgs: LoaderFunctionArgs | ActionFunctionArgs;
    orgId: string;
    redirectTo?: string;
  }) {
    const session = await this.getOrgSession(args.fnArgs.request);
    this.logger.info(`Adding orgId ${args.orgId} to session for user`);
    session.set(this.ORGANIZATION_SESSION_KEY, args.orgId);
    return redirect(args.redirectTo ?? "/", {
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session, {
          maxAge: 60 * 60 * 24 * 365, // 1 year
        }),
      },
    });
  }
}

export const SessionService = new Session();

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__causeway_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});
export const themeSessionResolver = createThemeSessionResolver(sessionStorage);
