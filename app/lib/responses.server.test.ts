// @vitest-environment node
import { Responses } from "~/lib/responses.server";

vi.hoisted(() => {
  process.env.AUTH_DOMAIN = "https://accounts.example.com";
});

vi.mock("~/integrations/sentry", () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock("~/integrations/logger.server", () => ({ createLogger: () => ({ error: vi.fn() }) }));

describe("redirectToSignIn", () => {
  it("does not carry one request's return url into the next redirect", () => {
    Responses.redirectToSignIn("https://app.example.com/private");
    const res = Responses.redirectToSignIn();

    expect(res.headers.get("Location")).toBe("https://accounts.example.com/sign-in");
  });
});
