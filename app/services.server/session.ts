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

import { createLogger } from "~/integrations/logger.server";
import { db } from "~/integrations/prisma.server";
import { Responses } from "~/lib/responses.server";
import { AuthService } from "~/services.server/auth";

class Session {
  public USER_SESSION_KEY = "userId";
  public ORGANIZATION_SESSION_KEY = "orgId";

  private logger = createLogger("SessionService");

  async logout(sessionId: string | null) {
    if (sessionId) {
      this.logger.info("Logging out user", { sessionId });
      await AuthService.revokeSession(sessionId);
    }
    this.logger.info("No sessionId provided, skipping logout and redirecting to sign in");
    throw Responses.redirectToSignIn();
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

  async getUserId(args: LoaderFunctionArgs | ActionFunctionArgs): Promise<string | null> {
    const { userId } = await getAuth(args);
    return userId;
  }

  async getOrgId({ request }: LoaderFunctionArgs | ActionFunctionArgs): Promise<Organization["id"] | undefined> {
    const session = await this.getOrgSession(request);
    const orgId = session.get(this.ORGANIZATION_SESSION_KEY) as Organization["id"] | undefined;
    return orgId;
  }

  async getOrg(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const orgId = await this.getOrgId(args);
    if (!orgId) {
      this.logger.debug("no orgId found in session");
      return null;
    }
    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, primaryEmail: true },
    });
    this.logger.debug(`orgId for ${org?.name} found in session`);
    return org;
  }

  async requireOrgId(args: LoaderFunctionArgs | ActionFunctionArgs) {
    const { sessionId } = await this.getSession(args);
    const orgId = await this.getOrgId(args);
    if (!orgId) {
      this.logger.info("no orgId found in session");
      const originURL = new URL(args.request.url);
      if (originURL.pathname === "/") {
        await this.logout(sessionId);
        throw redirect("/logout");
      }
      const returnUrl = new URL("/choose-org", originURL.origin);
      returnUrl.searchParams.set("redirectTo", originURL.pathname);
      this.logger.info("Redirecting to choose-org", { returnUrl: returnUrl.toString() });
      throw redirect(returnUrl.toString());
    }
    return orgId;
  }

  async requireUserId(args: LoaderFunctionArgs) {
    const { userId, sessionId, sessionClaims } = await this.getSession(args);

    if (!userId) {
      this.logger.info("No userId found in session, logging out", { sessionClaims });
      await this.logout(sessionId);
      throw Responses.redirectToSignIn();
    }

    let user = await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } });
    if (!user) {
      this.logger.error(`User with clerkId ${userId} authenticated but not found in database, attempting to link...`);
      if (sessionClaims.pem) {
        try {
          user = await AuthService.linkOAuthUserToExistingUser(sessionClaims.pem, userId);
          this.logger.info("Successfully linked user", { userId: user.id });
        } catch (error) {
          this.logger.error("Failed to link user", { error });
          await this.logout(sessionId);
          throw Responses.redirectToSignIn();
        }
      } else {
        this.logger.error("No pem claim found in session claims, cannot link user. Logging out.", { sessionClaims });
        await this.logout(sessionId);
        throw Responses.redirectToSignIn();
      }
    }

    return user.id;
  }

  public async requireUser(args: LoaderFunctionArgs, allowedRoles?: Array<MembershipRole>) {
    const defaultAllowedRoles: Array<MembershipRole> = [MembershipRole.MEMBER, MembershipRole.ADMIN];
    const userId = await this.requireUserId(args);
    const orgId = await this.requireOrgId(args);

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
      this.logger.warn("User not found in database", { userId });
      throw Responses.unauthorized();
    }

    // User is not a member of the current organization
    const currentMembership = user.memberships.find((m) => m.orgId === orgId);
    if (!currentMembership) {
      this.logger.warn("User is not a member of the current organization", { userId, orgId });
      throw Responses.unauthorized();
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
      this.logger.warn("User did not have required role", { username: user.username, role: user.role, allowedRoles });
      throw Responses.unauthorized();
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
    this.logger.error("Unhandled authentication scenario", { user, allowedRoles });
    throw Responses.unauthorized();
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
    this.logger.info("Adding orgId to session for user", { orgId: args.orgId, redirectTo: args.redirectTo });
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
