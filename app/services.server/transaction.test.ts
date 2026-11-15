import { describe, expect, it, vi } from "vitest";

import { TransactionService } from "~/services.server/transaction";

vi.mock("~/integrations/prisma.server", () => ({ db: {} }));

describe("hideAnonymousDonor", () => {
  const gift = { id: "t1", isAnonymous: true, contactId: "c1", contact: { id: "c1" } };

  it("strips the donor from anonymous gifts for members", () => {
    expect(TransactionService.hideAnonymousDonor(gift, { isMember: true })).toEqual({
      id: "t1",
      isAnonymous: true,
      contactId: null,
      contact: null,
    });
  });

  it("keeps the donor for admins", () => {
    expect(TransactionService.hideAnonymousDonor(gift, { isMember: false })).toBe(gift);
  });

  it("keeps the donor on normal gifts", () => {
    const normal = { ...gift, isAnonymous: false };
    expect(TransactionService.hideAnonymousDonor(normal, { isMember: true })).toBe(normal);
  });
});
