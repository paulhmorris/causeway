import { MembershipRole, Organization, User, UserRole } from "@prisma/client";
import { Session as RemixSession, SessionData, createCookieSessionStorage, redirect } from "react-router";
import { createThemeSessionResolver } from "remix-themes";

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { unauthorized } from "~/lib/responses.server";

class Session {
  public USER_SESSION_KEY = "userId";
  public ORGANIZATION_SESSION_KEY = "orgId";

  private logger = createLogger("SessionService");

  async logout(request: Request) {
    const session = await this.getSession(request);
    this.logger.info("Logging out session");
    return redirect("/login", {
      headers: {
        "Set-Cookie": await sessionStorage.destroySession(session),
      },
    });
  }

  async getSession(request: Request) {
    const cookie = request.headers.get("Cookie");
    return sessionStorage.getSession(cookie);
  }

  async commitSession(session: RemixSession<SessionData, SessionData>) {
    return sessionStorage.commitSession(session);
  }

  async getUserId(request: Request): Promise<User["id"] | undefined> {
    const session = await this.getSession(request);
    const userId = session.get(this.USER_SESSION_KEY) as User["id"] | undefined;
    return userId;
  }

  async getOrgId(request: Request): Promise<Organization["id"] | undefined> {
    const session = await this.getSession(request);
    const orgId = session.get(this.ORGANIZATION_SESSION_KEY) as Organization["id"] | undefined;
    return orgId;
  }

  async getOrg(request: Request) {
    const orgId = await this.getOrgId(request);
    if (!orgId) {
      this.logger.debug(`no orgId found in session`);
      return null;
    }
    this.logger.debug(`orgId in session found, fetching organization`);
    return db.organization.findUnique({ where: { id: orgId } });
  }

  async requireOrgId(request: Request) {
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
    this.logger.debug(`orgId in session found`);
    return orgId;
  }

  async requireUserId(request: Request, redirectTo: string = new URL(request.url).pathname) {
    const userId = await this.getUserId(request);
    if (!userId) {
      const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
      this.logger.info(`no userId found in session, redirecting to /login?${searchParams.toString()}`);
      throw redirect(`/login?${searchParams.toString()}`);
    }
    this.logger.debug(`userId found in session`);
    return userId;
  }

  public async requireUser(request: Request, allowedRoles?: Array<MembershipRole>) {
    const defaultAllowedRoles: Array<MembershipRole> = [MembershipRole.MEMBER, MembershipRole.ADMIN];
    const userId = await this.requireUserId(request);
    const orgId = await this.requireOrgId(request);

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

  async requireAdmin(request: Request) {
    return this.requireUser(request, ["ADMIN"]);
  }

  async createUserSession({
    request,
    userId,
    remember,
    redirectTo,
    orgId,
  }: {
    request: Request;
    userId: string;
    remember: boolean;
    redirectTo: string;
    orgId?: string;
  }) {
    const session = await this.getSession(request);
    session.set(this.USER_SESSION_KEY, userId);
    this.logger.info(`Creating session for userId ${userId}`);
    if (orgId) {
      this.logger.info(`Adding orgId ${orgId} to session for userId ${userId}`);
      session.set(this.ORGANIZATION_SESSION_KEY, orgId);
    }
    return redirect(redirectTo, {
      status: 201,
      headers: {
        "Set-Cookie": await sessionStorage.commitSession(session, {
          maxAge: remember
            ? 60 * 60 * 24 * 7 // 7 days
            : undefined,
        }),
      },
    });
  }
}

export const SessionService = new Session();

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});
export const themeSessionResolver = createThemeSessionResolver(sessionStorage);
