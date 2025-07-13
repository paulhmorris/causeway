import { ReimbursementRequestStatus } from "@prisma/client";
import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { renderWithBlankStub } from "test/test-utils";
import { ReimbursementRequestApprovalForm } from "~/components/forms/reimbursement-request-approval-form";

const MOCK_PENDING_PROPS = {
  rr: {
    id: "cmd11dfxt000007l5d3ophumv",
    status: ReimbursementRequestStatus.PENDING,
    amountInCents: 5000,
    description: "Test requester notes",
    approverNote: null,
    accountId: null,
    user: {
      username: "testuser",
      contact: {
        email: "testuser@example.com",
      },
    },
    date: new Date("2023-10-01"),
    account: {
      id: "acc_1",
      description: "Checking",
      code: "1000",
    },
    vendor: "Test Vendor",
    receipts: [],
    method: {
      name: "Bank Transfer",
    },
  },
  transactionCategories: [
    { id: 1, name: "Category A" },
    { id: 2, name: "Category B" },
  ],
  accounts: [
    { id: "acc_1", code: "1000", description: "Checking" },
    { id: "acc_2", code: "2000", description: "Savings" },
  ],
  relatedTrx: null,
};

const MOCK_APPROVED_PROPS = {
  ...MOCK_PENDING_PROPS,
  rr: {
    ...MOCK_PENDING_PROPS.rr,
    status: ReimbursementRequestStatus.APPROVED,
    accountId: "acc_1",
    approverNote: "Looks good",
  },
  relatedTrx: {
    transaction: {
      category: {
        id: 1,
      },
    },
  },
};

describe("Reimbursement Request Approval Form", () => {
  it("renders the approval fields correctly when status is PENDING", async () => {
    renderWithBlankStub({ component: ReimbursementRequestApprovalForm, props: MOCK_PENDING_PROPS });

    expect(await screen.findByLabelText(/requester notes/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/amount/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/transaction category/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/account to deduct from/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/approver notes/i)).toBeInTheDocument();

    // Check that the main action buttons are present
    expect(await screen.findByRole("button", { name: /approve/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /void/i })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /reject/i })).toBeInTheDocument();

    // Check that the "Reopen" button is NOT present
    expect(screen.queryByRole("button", { name: /reopen/i })).not.toBeInTheDocument();
  });

  it("renders only the reopen button when status is not PENDING", async () => {
    renderWithBlankStub({ component: ReimbursementRequestApprovalForm, props: MOCK_APPROVED_PROPS });

    // Check that approval fields are NOT visible
    expect(screen.queryByLabelText(/amount/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/transaction category/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/account to deduct from/i)).not.toBeInTheDocument();

    // Check that the "Reopen" button IS present
    expect(await screen.findByRole("button", { name: /reopen/i })).toBeInTheDocument();
  });

  it("should show errors when required fields are not filled for approval", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({ component: ReimbursementRequestApprovalForm, props: MOCK_PENDING_PROPS });

    // Clear the default amount
    await user.clear(await screen.findByLabelText(/amount/i));
    await user.click(await screen.findByRole("button", { name: /approve/i }));

    // Expect error for amount
    const errors = await screen.findAllByRole("alert");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toHaveTextContent("Required");
  });

  it("should submit with the APPROVE action", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({ component: ReimbursementRequestApprovalForm, props: MOCK_PENDING_PROPS, actionMock: action });

    await user.click(await screen.findByLabelText(/transaction category/i));
    await user.click(await screen.findByRole("option", { name: /category a/i }));
    await user.click(await screen.findByLabelText(/account to deduct from/i));
    await user.click(await screen.findByRole("option", { name: /1000 - checking/i }));
    await user.click(await screen.findByRole("button", { name: /approve/i }));

    expect(action).toHaveBeenCalled();
  });

  it("should submit with the REJECTED action", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({ component: ReimbursementRequestApprovalForm, props: MOCK_PENDING_PROPS, actionMock: action });

    await user.click(await screen.findByRole("button", { name: /reject/i }));

    expect(action).toHaveBeenCalled();
  });

  it("should submit with the PENDING action when reopening", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({
      component: ReimbursementRequestApprovalForm,
      props: MOCK_APPROVED_PROPS,
      actionMock: action,
    });

    await user.click(await screen.findByRole("button", { name: /reopen/i }));

    expect(action).toHaveBeenCalled();
  });
});
