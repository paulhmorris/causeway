// @vitest-environment node
import { getAuth } from "@clerk/react-router/server";
import { MembershipRole, UserRole } from "@prisma/client";
import type { LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/prisma.server";
import { SessionService, sessionStorage } from "~/services.server/session";

vi.hoisted(() => {
  process.env.AUTH_DOMAIN = "https://accounts.example.com";
  process.env.SESSION_SECRET = "test-session-secret-at-least-32-chars";
});

vi.mock("@clerk/react-router/server", () => ({ getAuth: vi.fn() }));
vi.mock("~/integrations/clerk.server", () => ({ clerkClient: {} }));
vi.mock("~/integrations/sentry", () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("~/integrations/prisma.server", () => ({
  db: {
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  },
}));

const mockGetAuth = vi.mocked(getAuth);
const mockDb = vi.mocked(db, { deep: true });

function signedIn(clerkId = "user_clerk", pem?: string) {
  mockGetAuth.mockResolvedValue({ isAuthenticated: true, userId: clerkId, sessionClaims: { pem } } as never);
}

function signedOut() {
  mockGetAuth.mockResolvedValue({ isAuthenticated: false, userId: null, sessionClaims: null } as never);
}

async function orgCookie(orgId: string) {
  const session = await sessionStorage.getSession();
  session.set(SessionService.ORGANIZATION_SESSION_KEY, orgId);
  return (await sessionStorage.commitSession(session)).split(";")[0];
}

function args(path = "/", cookie?: string) {
  const request = new Request(`https://app.example.com${path}`, { headers: cookie ? { Cookie: cookie } : {} });
  return { request, params: {}, context: {} } as unknown as LoaderFunctionArgs;
}

async function thrown(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    return e as Response;
  }
  throw new Error("Expected promise to throw");
}

function membership(orgId: string, role: MembershipRole) {
  return { orgId, role, isDefault: false, org: { id: orgId, name: `Org ${orgId}`, primaryEmail: null } };
}

function dbUser(overrides: { role?: UserRole; memberships?: Array<ReturnType<typeof membership>> } = {}) {
  return {
    id: "user_1",
    username: "someone@example.com",
    role: UserRole.USER,
    accountId: null,
    contact: { id: "contact_1", email: "someone@example.com", firstName: "Some", lastName: "One", typeId: 1 },
    memberships: [membership("org_1", MembershipRole.ADMIN)],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireUserId", () => {
  it("redirects signed-out users to sign-in with a return url", async () => {
    signedOut();

    const res = await thrown(SessionService.requireUserId(args("/accounts?page=2")));

    expect(res.status).toBe(302);
    const location = new URL(res.headers.get("Location")!);
    expect(location.origin + location.pathname).toBe("https://accounts.example.com/sign-in");
    expect(location.searchParams.get("redirect_url")).toBe("https://app.example.com/accounts?page=2");
  });

  it("returns the linked user's id", async () => {
    signedIn("user_clerk");
    mockDb.user.findUnique.mockResolvedValueOnce({ id: "user_1" } as never);

    await expect(SessionService.requireUserId(args())).resolves.toBe("user_1");
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it("links an invited user by primary email on first sign-in", async () => {
    signedIn("user_clerk", "invited@example.com");
    mockDb.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "user_1", clerkId: null } as never);
    mockDb.user.update.mockResolvedValueOnce({ id: "user_1" } as never);

    await expect(SessionService.requireUserId(args())).resolves.toBe("user_1");
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { clerkId: "user_clerk" },
      select: { id: true },
    });
  });

  it("sends users with no matching account to the no-access page", async () => {
    signedIn("user_clerk", "stranger@example.com");
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await thrown(SessionService.requireUserId(args()));

    expect(res.headers.get("Location")).toBe("/no-access");
  });

  it("sends users without a primary email claim to the no-access page", async () => {
    signedIn("user_clerk", undefined);
    mockDb.user.findUnique.mockResolvedValue(null);

    const res = await thrown(SessionService.requireUserId(args()));

    expect(res.headers.get("Location")).toBe("/no-access");
    expect(mockDb.user.findUnique).toHaveBeenCalledTimes(1);
  });
});

describe("requireOrgId", () => {
  it("returns the org from the session cookie", async () => {
    await expect(SessionService.requireOrgId(args("/", await orgCookie("org_1")))).resolves.toBe("org_1");
  });

  it("redirects to choose-org without a return path from the index", async () => {
    const res = await thrown(SessionService.requireOrgId(args("/")));

    expect(res.headers.get("Location")).toBe("/choose-org");
  });

  it("redirects to choose-org with the full return path", async () => {
    const res = await thrown(SessionService.requireOrgId(args("/accounts?page=2")));

    expect(res.headers.get("Location")).toBe("/choose-org?redirectTo=%2Faccounts%3Fpage%3D2");
  });
});

describe("requireUser", () => {
  beforeEach(() => {
    signedIn();
    mockDb.user.findUnique.mockResolvedValue({ id: "user_1" } as never);
  });

  it("returns the user with their role in the current org", async () => {
    mockDb.user.findUniqueOrThrow.mockResolvedValue(dbUser() as never);

    const user = await SessionService.requireUser(args("/", await orgCookie("org_1")));

    expect(user).toMatchObject({
      id: "user_1",
      role: MembershipRole.ADMIN,
      systemRole: UserRole.USER,
      isAdmin: true,
      isMember: false,
      isSuperAdmin: false,
      org: { id: "org_1" },
    });
  });

  it("sends users back to choose-org when the session org isn't one of theirs", async () => {
    mockDb.user.findUniqueOrThrow.mockResolvedValue(dbUser() as never);

    const res = await thrown(SessionService.requireUser(args("/accounts", await orgCookie("org_other"))));

    expect(res.headers.get("Location")).toBe("/choose-org?redirectTo=%2Faccounts");
  });

  it("forbids members from admin-only routes", async () => {
    mockDb.user.findUniqueOrThrow.mockResolvedValue(
      dbUser({ memberships: [membership("org_1", MembershipRole.MEMBER)] }) as never,
    );

    const res = await thrown(SessionService.requireAdmin(args("/", await orgCookie("org_1"))));

    expect((res as unknown as { init: ResponseInit }).init.status).toBe(403);
  });

  it("treats superadmins as admins in every org", async () => {
    mockDb.user.findUniqueOrThrow.mockResolvedValue(
      dbUser({ role: UserRole.SUPERADMIN, memberships: [membership("org_1", MembershipRole.MEMBER)] }) as never,
    );

    const user = await SessionService.requireAdmin(args("/", await orgCookie("org_1")));

    expect(user).toMatchObject({ role: MembershipRole.ADMIN, systemRole: UserRole.SUPERADMIN, isSuperAdmin: true });
  });
});

describe("org session cookie", () => {
  it("persists for a year on every commit, not just org selection", async () => {
    const session = await sessionStorage.getSession();
    session.set("theme", "dark");

    expect(await SessionService.commitSession(session)).toMatch(/Max-Age=31536000/);
  });

  it("stores the org and redirects to a safe path", async () => {
    const res = await SessionService.createOrgSession({ fnArgs: args(), orgId: "org_1", redirectTo: "/accounts" });

    expect(res.headers.get("Location")).toBe("/accounts");
    const cookie = res.headers.get("Set-Cookie")!.split(";")[0];
    await expect(SessionService.getOrgId(args("/", cookie))).resolves.toBe("org_1");
  });

  it.each(["https://evil.example.com", "//evil.example.com", "/\\evil.example.com"])(
    "ignores off-site redirect %s",
    async (redirectTo) => {
      const res = await SessionService.createOrgSession({ fnArgs: args(), orgId: "org_1", redirectTo });

      expect(res.headers.get("Location")).toBe("/");
    },
  );
});
