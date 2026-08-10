import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { mockUseUser, renderWithBlankStub } from "test/test-utils";

import { ReceiptSelector, type SelectableReceipt } from "~/components/common/receipt-selector";

vi.mock("~/hooks/useUser");

function buildReceipt(overrides: Partial<SelectableReceipt> & { id: string; title: string }): SelectableReceipt {
  return {
    s3Key: `key-${overrides.id}`,
    s3Url: null,
    s3UrlExpiry: null,
    userId: "user1",
    orgId: "org1",
    createdAt: dayjs().subtract(2, "day").toDate(),
    updatedAt: new Date(),
    user: { contact: { email: "alice@smith.com" } },
    reimbursementRequests: [],
    transactions: [],
    ...overrides,
  };
}

/** Hidden inputs are what actually submit, since the gallery renders in a portal. */
function attachedIds(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLInputElement>('input[type="hidden"][name="receiptIds"]')).map(
    (i) => i.value,
  );
}

async function openGallery(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /attach files/i }));
  return screen.findByRole("dialog");
}

describe("Receipt Selector", () => {
  beforeEach(() => {
    mockUseUser();
    // DrawerDialog branches on a media query; JSDOM has no matchMedia, so pin it to the desktop dialog.
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  });

  it("prompts for an upload when there are no receipts", async () => {
    renderWithBlankStub({ component: ReceiptSelector, props: { receipts: [] } });

    expect(await screen.findByText(/upload receipts to get started/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /attach files/i })).not.toBeInTheDocument();
  });

  it("preselects receipts uploaded today and exposes them as hidden inputs", async () => {
    const { container } = renderWithBlankStub({
      component: ReceiptSelector,
      props: {
        receipts: [
          buildReceipt({ id: "today", title: "Today Receipt", createdAt: new Date() }),
          buildReceipt({ id: "old", title: "Old Receipt" }),
        ],
      },
    });

    await screen.findByRole("button", { name: /attach files/i });
    expect(attachedIds(container)).toEqual(["today"]);
    expect(screen.getByText("1 file attached")).toBeInTheDocument();
  });

  it("does not preselect a receipt that is already used", async () => {
    const { container } = renderWithBlankStub({
      component: ReceiptSelector,
      props: {
        receipts: [
          buildReceipt({
            id: "used",
            title: "Used Receipt",
            createdAt: new Date(),
            transactions: [{ id: "trx1" }],
          }),
        ],
      },
    });

    await screen.findByRole("button", { name: /attach files/i });
    expect(attachedIds(container)).toEqual([]);
  });

  it("disables receipts already attached to a transaction or a reimbursement request", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({
      component: ReceiptSelector,
      props: {
        receipts: [
          buildReceipt({ id: "free", title: "Free Receipt" }),
          buildReceipt({ id: "on-trx", title: "Trx Receipt", transactions: [{ id: "trx1" }] }),
          buildReceipt({ id: "on-rr", title: "RR Receipt", reimbursementRequests: [{ id: "rr1" }] }),
        ],
      },
    });

    const dialog = await openGallery(user);

    expect(within(dialog).getByRole("checkbox", { name: "Free Receipt" })).toBeEnabled();
    expect(within(dialog).getByRole("checkbox", { name: "Trx Receipt" })).toBeDisabled();
    expect(within(dialog).getByRole("checkbox", { name: "RR Receipt" })).toBeDisabled();
    expect(within(dialog).getAllByText("Used")).toHaveLength(2);
  });

  it("keeps selections when the search filters them out of view", async () => {
    const user = userEvent.setup();
    const { container } = renderWithBlankStub({
      component: ReceiptSelector,
      props: {
        receipts: [
          buildReceipt({ id: "alpha", title: "Alpha Invoice" }),
          buildReceipt({ id: "beta", title: "Beta Invoice" }),
        ],
      },
    });

    const dialog = await openGallery(user);
    await user.click(within(dialog).getByRole("checkbox", { name: "Alpha Invoice" }));
    expect(attachedIds(container)).toEqual(["alpha"]);

    // Filtering Alpha out of the list must not drop it from the form.
    await user.type(within(dialog).getByPlaceholderText(/search files/i), "Beta");
    expect(within(dialog).queryByRole("checkbox", { name: "Alpha Invoice" })).not.toBeInTheDocument();
    expect(attachedIds(container)).toEqual(["alpha"]);

    await user.clear(within(dialog).getByPlaceholderText(/search files/i));
    expect(within(dialog).getByRole("checkbox", { name: "Alpha Invoice" })).toBeChecked();
    expect(attachedIds(container)).toEqual(["alpha"]);
  });

  it("removes an attachment from the summary list", async () => {
    const user = userEvent.setup();
    const { container } = renderWithBlankStub({
      component: ReceiptSelector,
      props: { receipts: [buildReceipt({ id: "today", title: "Today Receipt", createdAt: new Date() })] },
    });

    await user.click(await screen.findByRole("button", { name: /remove today receipt/i }));

    expect(attachedIds(container)).toEqual([]);
    expect(screen.getByText("No files attached")).toBeInTheDocument();
  });

  it("hides receipts older than 90 days until they are requested", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({
      component: ReceiptSelector,
      props: {
        receipts: [
          buildReceipt({ id: "recent", title: "Recent Receipt" }),
          buildReceipt({ id: "ancient", title: "Ancient Receipt", createdAt: dayjs().subtract(1, "year").toDate() }),
        ],
      },
    });

    const dialog = await openGallery(user);
    expect(within(dialog).queryByRole("checkbox", { name: "Ancient Receipt" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /show files older than 90 days/i }));
    expect(within(dialog).getByRole("checkbox", { name: "Ancient Receipt" })).toBeInTheDocument();
  });
});
