import { screen, waitFor, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import dayjs from "dayjs";
import { useState } from "react";
import { mockUseUser, renderWithBlankStub } from "test/test-utils";
import { Mock } from "vitest";

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

/** `receiptCount` defaults to "the loader returned everything there is". */
function renderSelector(
  receipts: Array<SelectableReceipt>,
  options: { receiptCount?: number; loaderMock?: Mock } = {},
) {
  return renderWithBlankStub({
    component: ReceiptSelector,
    props: { receipts, receiptCount: options.receiptCount ?? receipts.length },
    loaderMock: options.loaderMock,
  });
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

  it("still offers the gallery when there is nothing to attach yet", async () => {
    const user = userEvent.setup();
    renderSelector([]);

    expect(await screen.findByText("No files attached")).toBeInTheDocument();

    const dialog = await openGallery(user);
    expect(within(dialog).getByText(/no files uploaded in the last 90 days/i)).toBeInTheDocument();
  });

  it("preselects receipts uploaded today and exposes them as hidden inputs", async () => {
    const { container } = renderSelector([
      buildReceipt({ id: "today", title: "Today Receipt", createdAt: new Date() }),
      buildReceipt({ id: "old", title: "Old Receipt" }),
    ]);

    await screen.findByRole("button", { name: /attach files/i });
    expect(attachedIds(container)).toEqual(["today"]);
    expect(screen.getByText("1 file attached")).toBeInTheDocument();
  });

  it("does not preselect a receipt that is already used", async () => {
    const { container } = renderSelector([
      buildReceipt({ id: "used", title: "Used Receipt", createdAt: new Date(), transactions: [{ id: "trx1" }] }),
    ]);

    await screen.findByRole("button", { name: /attach files/i });
    expect(attachedIds(container)).toEqual([]);
  });

  it("disables receipts already attached to a transaction or a reimbursement request", async () => {
    const user = userEvent.setup();
    renderSelector([
      buildReceipt({ id: "free", title: "Free Receipt" }),
      buildReceipt({ id: "on-trx", title: "Trx Receipt", transactions: [{ id: "trx1" }] }),
      buildReceipt({ id: "on-rr", title: "RR Receipt", reimbursementRequests: [{ id: "rr1" }] }),
    ]);

    const dialog = await openGallery(user);

    expect(within(dialog).getByRole("checkbox", { name: "Free Receipt" })).toBeEnabled();
    expect(within(dialog).getByRole("checkbox", { name: "Trx Receipt" })).toBeDisabled();
    expect(within(dialog).getByRole("checkbox", { name: "RR Receipt" })).toBeDisabled();
    expect(within(dialog).getAllByText("Used")).toHaveLength(2);
  });

  it("keeps a selection after the loader stops returning that receipt", async () => {
    const user = userEvent.setup();
    const alpha = buildReceipt({ id: "alpha", title: "Alpha Invoice" });
    const beta = buildReceipt({ id: "beta", title: "Beta Invoice" });

    // Searching and widening the window both re-run the loader, which can return a set that no
    // longer contains an already-selected receipt. It still has to submit.
    function Harness({ initial, next }: { initial: Array<SelectableReceipt>; next: Array<SelectableReceipt> }) {
      const [receipts, setReceipts] = useState(initial);
      return (
        <>
          <button type="button" onClick={() => setReceipts(next)}>
            revalidate
          </button>
          <ReceiptSelector receipts={receipts} receiptCount={receipts.length} />
        </>
      );
    }

    const { container } = renderWithBlankStub({
      component: Harness,
      props: { initial: [alpha, beta], next: [beta] },
    });

    const dialog = await openGallery(user);
    await user.click(within(dialog).getByRole("checkbox", { name: "Alpha Invoice" }));
    expect(attachedIds(container)).toEqual(["alpha"]);
    await user.click(within(dialog).getByRole("button", { name: "Done" }));

    await user.click(await screen.findByRole("button", { name: "revalidate" }));

    expect(attachedIds(container)).toEqual(["alpha"]);
    expect(screen.getByText("1 file attached")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove alpha invoice/i })).toBeInTheDocument();

    const reopened = await openGallery(user);
    expect(within(reopened).queryByRole("checkbox", { name: "Alpha Invoice" })).not.toBeInTheDocument();
    expect(within(reopened).getByRole("checkbox", { name: "Beta Invoice" })).toBeInTheDocument();
  });

  it("removes an attachment from the summary list", async () => {
    const user = userEvent.setup();
    const { container } = renderSelector([
      buildReceipt({ id: "today", title: "Today Receipt", createdAt: new Date() }),
    ]);

    await user.click(await screen.findByRole("button", { name: /remove today receipt/i }));

    expect(attachedIds(container)).toEqual([]);
    expect(screen.getByText("No files attached")).toBeInTheDocument();
  });

  it("renders whatever the loader returned without applying its own date cutoff", async () => {
    const user = userEvent.setup();
    renderSelector([
      buildReceipt({ id: "recent", title: "Recent Receipt" }),
      buildReceipt({ id: "ancient", title: "Ancient Receipt", createdAt: dayjs().subtract(1, "year").toDate() }),
    ]);

    const dialog = await openGallery(user);
    expect(within(dialog).getByRole("checkbox", { name: "Recent Receipt" })).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Ancient Receipt" })).toBeInTheDocument();
  });

  it("sends the search term to the loader, so receipts outside the window stay reachable", async () => {
    const user = userEvent.setup();
    const loaderMock = vi.fn((_args: { request: Request }) => null);
    renderSelector([buildReceipt({ id: "recent", title: "Recent Receipt" })], { loaderMock });

    const dialog = await openGallery(user);
    await user.type(within(dialog).getByPlaceholderText(/search files/i), "invoice");

    await waitFor(
      () => {
        const searched = loaderMock.mock.calls.some(
          ([args]) =>
            new URL((args as { request: Request }).request.url).searchParams.get("receiptSearch") === "invoice",
        );
        expect(searched).toBe(true);
      },
      { timeout: 3000 },
    );
  });

  it("requests older receipts from the loader rather than filtering locally", async () => {
    const user = userEvent.setup();
    const loaderMock = vi.fn((_args: { request: Request }) => null);
    renderSelector([buildReceipt({ id: "recent", title: "Recent Receipt" })], { loaderMock });

    const dialog = await openGallery(user);
    await user.click(within(dialog).getByRole("button", { name: /show files older than 90 days/i }));

    await waitFor(() => {
      const requested = loaderMock.mock.calls.some(([args]) =>
        new URL((args as { request: Request }).request.url).searchParams.has("olderReceipts", "true"),
      );
      expect(requested).toBe(true);
    });

    // Once the wider window is loaded there is nothing left to ask for.
    expect(within(dialog).queryByRole("button", { name: /show files older than/i })).not.toBeInTheDocument();
  });

  it("separates attachable receipts from ones already in use", async () => {
    const user = userEvent.setup();
    renderSelector([
      buildReceipt({ id: "free", title: "Free Receipt" }),
      buildReceipt({ id: "used-1", title: "Used One", transactions: [{ id: "trx1" }] }),
      buildReceipt({ id: "used-2", title: "Used Two", reimbursementRequests: [{ id: "rr1" }] }),
    ]);

    const dialog = await openGallery(user);

    // Everything stays visible, but the one that can be picked isn't buried among the rest.
    expect(within(dialog).getByText("Already Attached (2)")).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Used One" })).toBeInTheDocument();
    expect(within(dialog).getByText("1 available · showing 3 of 3 files")).toBeInTheDocument();

    const week = within(dialog).getByText("This Week");
    const attached = within(dialog).getByText("Already Attached (2)");
    expect(week.compareDocumentPosition(attached) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("says so when nothing in the list can be attached", async () => {
    const user = userEvent.setup();
    renderSelector([buildReceipt({ id: "used", title: "Used Receipt", transactions: [{ id: "trx1" }] })]);

    const dialog = await openGallery(user);
    expect(within(dialog).getByText(/every file here is already attached/i)).toBeInTheDocument();
  });

  it("reports how much of the total it is showing and offers to page further", async () => {
    const user = userEvent.setup();
    renderSelector([buildReceipt({ id: "one", title: "One" }), buildReceipt({ id: "two", title: "Two" })], {
      receiptCount: 700,
    });

    const dialog = await openGallery(user);
    expect(within(dialog).getByText("2 available · showing 2 of 700 files")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Load more" })).toBeInTheDocument();
  });

  it("does not offer to page when everything is already loaded", async () => {
    const user = userEvent.setup();
    renderSelector([buildReceipt({ id: "one", title: "One" })]);

    const dialog = await openGallery(user);
    expect(within(dialog).getByText("1 available · showing 1 of 1 files")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
