import { getAuth } from "@clerk/react-router/server";
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
import { safeRedirect } from "~/lib/utils";
import { AuthService } from "~/services.server/auth";

const logger = createLogger("SessionService");

type Args = LoaderFunctionArgs | ActionFunctionArgs;

export const NO_ACCESS_PATH = "/no-access";

export const SessionService = {
  ORGANIZATION_SESSION_KEY: "orgId",

  async getOrgSession(request: Request) {
    const cookie = request.headers.get("Cookie");
    return sessionStorage.getSession(cookie);
  },

  async commitSession(session: RemixSession<SessionData, SessionData>) {
    return sessionStorage.commitSession(session);
  },

  async getOrgId({ request }: Args) {
    const session = await this.getOrgSession(request);
    return session.get(this.ORGANIZATION_SESSION_KEY) as Organization["id"] | undefined;
  },

  async getOrg(args: Args) {
    const orgId = await this.getOrgId(args);
    if (!orgId) {
      return null;
    }
    return db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, primaryEmail: true },
    });
  },

  /**
   * Resolves the signed-in Clerk user to our user id, linking by primary email on first sign-in.
   * Never signs the user out: signed-out users go to sign-in, unknown users go to the no-access page.
   */
  async requireUserId(args: Args) {
    const { isAuthenticated, userId: clerkId, sessionClaims } = await getAuth(args);
    if (!isAuthenticated) {
      throw Responses.redirectToSignIn(args.request.url);
    }

    const user =
      (await db.user.findUnique({ where: { clerkId }, select: { id: true } })) ??
      (await AuthService.linkClerkUser(clerkId, sessionClaims.pem));

    if (!user) {
      logger.warn("Signed-in Clerk user has no matching user", { clerkId });
      throw redirect(NO_ACCESS_PATH);
    }
    return user.id;
  },

  async requireOrgId(args: Args) {
    const orgId = await this.getOrgId(args);
    if (!orgId) {
      throw this.redirectToChooseOrg(args.request);
    }
    return orgId;
  },

  redirectToChooseOrg(request: Request) {
    const { pathname, search } = new URL(request.url);
    const url = new URL("/choose-org", request.url);
    if (pathname !== "/") {
      url.searchParams.set("redirectTo", pathname + search);
    }
    return redirect(url.pathname + url.search);
  },

  async requireUser(args: LoaderFunctionArgs, allowedRoles?: Array<MembershipRole>) {
    const userId = await this.requireUserId(args);
    const orgId = await this.requireOrgId(args);

    const user = await db.user.findUniqueOrThrow({
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
              where: { account: { orgId } },
              select: { accountId: true },
            },
          },
        },
        memberships: { include: { org: true } },
      },
    });

    const membership = user.memberships.find((m) => m.orgId === orgId);
    if (!membership) {
      logger.warn("Org in session is not one of the user's memberships", { userId, orgId });
      throw this.redirectToChooseOrg(args.request);
    }

    const isSuperAdmin = user.role === UserRole.SUPERADMIN;
    if (!isSuperAdmin && allowedRoles?.length && !allowedRoles.includes(membership.role)) {
      logger.warn("User did not have required role", { userId, role: membership.role, allowedRoles });
      throw Responses.forbidden();
    }

    return {
      ...user,
      isMember: membership.role === MembershipRole.MEMBER,
      isAdmin: membership.role === MembershipRole.ADMIN,
      isSuperAdmin,
      role: isSuperAdmin ? MembershipRole.ADMIN : membership.role,
      systemRole: user.role,
      org: membership.org,
    };
  },

  async requireAdmin(args: LoaderFunctionArgs) {
    return this.requireUser(args, [MembershipRole.ADMIN]);
  },

  async createOrgSession(args: { fnArgs: Args; orgId: string; redirectTo?: string | null }) {
    const session = await this.getOrgSession(args.fnArgs.request);
    session.set(this.ORGANIZATION_SESSION_KEY, args.orgId);
    return redirect(safeRedirect(args.redirectTo), {
      headers: { "Set-Cookie": await sessionStorage.commitSession(session) },
    });
  },
};

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__causeway_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});
export const themeSessionResolver = createThemeSessionResolver(sessionStorage);
