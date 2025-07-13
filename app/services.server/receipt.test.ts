import { vi } from "vitest";

import { Bucket } from "~/integrations/bucket.server";
import { db } from "~/integrations/prisma.server";
import { generateS3Urls } from "~/services.server/receipt";

// Mock dependencies
vi.mock("~/integrations/bucket.server", () => ({ Bucket: { getGETPresignedUrl: vi.fn() } }));

vi.mock("~/integrations/prisma.server", () => ({ db: { receipt: { update: vi.fn() } } }));

vi.mock("~/integrations/logger.server", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  }),
}));
// Helper to create a date in the future or past
const createDate = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const MOCK_RECEIPTS = {
  valid: {
    id: "valid_receipt",
    s3Key: "valid.jpg",
    title: "Valid Receipt",
    s3Url: "https://s3.com/valid",
    s3UrlExpiry: createDate(5),
  },
  expired: {
    id: "expired_receipt",
    s3Key: "expired.jpg",
    title: "Expired Receipt",
    s3Url: "https://s3.com/expired",
    s3UrlExpiry: createDate(-1),
  },
  noUrl: {
    id: "no_url_receipt",
    s3Key: "no_url.jpg",
    title: "No URL Receipt",
    s3Url: null,
    s3UrlExpiry: null,
  },
};

describe("ReceiptService: generateS3Urls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should return an empty array if no receipts are provided", async () => {
    const result = await generateS3Urls([]);
    expect(result).toEqual([]);
    expect(Bucket.getGETPresignedUrl).not.toHaveBeenCalled();
    expect(db.receipt.update).not.toHaveBeenCalled();
  });

  it("should not update a receipt with a valid, non-expired URL", async () => {
    const receipts = [MOCK_RECEIPTS.valid];
    const result = await generateS3Urls(receipts);

    expect(result[0].s3Url).toBe(MOCK_RECEIPTS.valid.s3Url);
    expect(Bucket.getGETPresignedUrl).not.toHaveBeenCalled();
    expect(db.receipt.update).not.toHaveBeenCalled();
  });

  it("should generate a new URL for a receipt with an expired URL", async () => {
    const newUrl = "https://new-presigned-url.com/expired";
    vi.mocked(Bucket.getGETPresignedUrl).mockResolvedValue(newUrl);
    const receipts = [MOCK_RECEIPTS.expired];

    const result = await generateS3Urls(receipts);

    expect(Bucket.getGETPresignedUrl).toHaveBeenCalledWith(MOCK_RECEIPTS.expired.s3Key);
    expect(db.receipt.update).toHaveBeenCalledWith({
      where: { id: MOCK_RECEIPTS.expired.id },
      data: { s3Url: newUrl, s3UrlExpiry: expect.any(Date) },
    });
    expect(result[0].s3Url).toBe(newUrl);
    expect(result[0].s3UrlExpiry!.getTime()).toBeGreaterThan(Date.now());
  });

  it("should generate a new URL for a receipt with no URL", async () => {
    const newUrl = "https://new-presigned-url.com/no_url";
    vi.mocked(Bucket.getGETPresignedUrl).mockResolvedValue(newUrl);
    const receipts = [MOCK_RECEIPTS.noUrl];

    const result = await generateS3Urls(receipts);

    expect(Bucket.getGETPresignedUrl).toHaveBeenCalledWith(MOCK_RECEIPTS.noUrl.s3Key);
    expect(db.receipt.update).toHaveBeenCalledWith({
      where: { id: MOCK_RECEIPTS.noUrl.id },
      data: { s3Url: newUrl, s3UrlExpiry: expect.any(Date) },
    });
    expect(result[0].s3Url).toBe(newUrl);
  });

  it("should correctly handle a mix of valid and expired receipts", async () => {
    const newUrl = "https://new-presigned-url.com/expired_mix";
    vi.mocked(Bucket.getGETPresignedUrl).mockResolvedValue(newUrl);
    const receipts = [MOCK_RECEIPTS.valid, MOCK_RECEIPTS.expired];

    const result = await generateS3Urls(receipts);

    // Should only be called for the expired receipt
    expect(Bucket.getGETPresignedUrl).toHaveBeenCalledTimes(1);
    expect(Bucket.getGETPresignedUrl).toHaveBeenCalledWith(MOCK_RECEIPTS.expired.s3Key);
    expect(db.receipt.update).toHaveBeenCalledTimes(1);
    expect(db.receipt.update).toHaveBeenCalledWith({
      where: { id: MOCK_RECEIPTS.expired.id },
      data: { s3Url: newUrl, s3UrlExpiry: expect.any(Date) },
    });

    // Check the final array
    expect(result).toHaveLength(2);
    expect(result[0].s3Url).toBe(MOCK_RECEIPTS.valid.s3Url); // The valid one is unchanged
    expect(result[1].s3Url).toBe(newUrl); // The expired one is updated
  });
});
