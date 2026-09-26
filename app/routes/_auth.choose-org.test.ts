// @vitest-environment node
import { getAuth } from "@clerk/react-router/server";
import { MembershipRole } from "@prisma/client";
import type { LoaderFunctionArgs } from "react-router";

import { db } from "~/integrations/prisma.server";
import { loader } from "~/routes/_auth.choose-org";
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
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn() },
  },
}));

const mockDb = vi.mocked(db, { deep: true });

function membership(orgId: string, isDefault = false) {
  return { org: { id: orgId, name: `Org ${orgId}` }, role: MembershipRole.MEMBER, isDefault };
}

async function args(path = "/choose-org", orgId?: string) {
  const headers = new Headers();
  if (orgId) {
    const session = await sessionStorage.getSession();
    session.set(SessionService.ORGANIZATION_SESSION_KEY, orgId);
    headers.set("Cookie", (await sessionStorage.commitSession(session)).split(";")[0]);
  }
  return { request: new Request(`https://app.example.com${path}`, { headers }), params: {}, context: {} } as never;
}

async function load(loaderArgs: LoaderFunctionArgs) {
  try {
    return await loader(loaderArgs);
  } catch (e) {
    return e as Response;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuth).mockResolvedValue({ isAuthenticated: true, userId: "user_clerk", sessionClaims: {} } as never);
  mockDb.user.findUnique.mockResolvedValue({ id: "user_1" } as never);
});

describe("choose-org loader", () => {
  it("sends users without memberships to the no-access page instead of signing them out", async () => {
    mockDb.membership.findMany.mockResolvedValue([]);

    const res = (await load(await args())) as Response;

    expect(res.headers.get("Location")).toBe("/no-access");
  });

  it("auto-selects the only org on sign-in and returns to the requested page", async () => {
    mockDb.membership.findMany.mockResolvedValue([membership("org_1")] as never);

    const res = (await load(await args("/choose-org?redirectTo=%2Faccounts"))) as Response;

    expect(res.headers.get("Location")).toBe("/accounts");
    expect(res.headers.get("Set-Cookie")).toContain("__causeway_session=");
  });

  it("auto-selects the default org on sign-in", async () => {
    mockDb.membership.findMany.mockResolvedValue([membership("org_1"), membership("org_2", true)] as never);

    const res = (await load(await args())) as Response;
    const cookie = res.headers.get("Set-Cookie")!.split(";")[0];

    await expect(SessionService.getOrgId(argsWithCookie(cookie))).resolves.toBe("org_2");
  });

  it("shows the picker when switching orgs, even with a default", async () => {
    mockDb.membership.findMany.mockResolvedValue([membership("org_1"), membership("org_2", true)] as never);

    const result = await load(await args("/choose-org", "org_1"));

    expect(result).toEqual({
      orgs: [
        { id: "org_1", name: "Org org_1", role: "Member", isDefault: false },
        { id: "org_2", name: "Org org_2", role: "Member", isDefault: true },
      ],
    });
  });

  it("shows the picker when there are several orgs and no default", async () => {
    mockDb.membership.findMany.mockResolvedValue([membership("org_1"), membership("org_2")] as never);

    const result = await load(await args());

    expect(result).toHaveProperty("orgs");
  });
});

function argsWithCookie(cookie: string) {
  return { request: new Request("https://app.example.com/", { headers: { Cookie: cookie } }) } as never;
}
