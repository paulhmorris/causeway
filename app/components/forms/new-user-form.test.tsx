import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { MOCK_DATA } from "test/mock-data";
import { mockUseUser, renderWithBlankStub } from "test/test-utils";
import { NewUserForm } from "~/components/forms/new-user-form";

const mockFormProps = {
  contactTypes: [
    { id: 1, name: "Type 1" },
    { id: 2, name: "Type 2" },
  ],
  accounts: [
    { id: "account1", code: "ACC1", description: "Account 1" },
    { id: "account2", code: "ACC2", description: "Account 2" },
  ],
};

vi.mock("~/hooks/useUser");

describe("New User Form", () => {
  beforeEach(() => mockUseUser());

  it("renders the form fields correctly", async () => {
    renderWithBlankStub({ component: NewUserForm, props: mockFormProps });

    const firstName = await screen.findByLabelText<HTMLInputElement>(/first name/i);
    const lastName = await screen.findByLabelText<HTMLInputElement>(/last name/i);
    const username = await screen.findByLabelText<HTMLInputElement>(/username/i);
    const typeId = await screen.findByRole<HTMLInputElement>("combobox", { name: /select a type/i });
    const accountId = await screen.findByRole<HTMLInputElement>("combobox", { name: /select an account/i });
    const role = await screen.findByRole<HTMLInputElement>("combobox", { name: /select an org role/i });
    const systemRole = await screen.findByRole<HTMLInputElement>("combobox", { name: /select a system role/i });

    expect(firstName).toBeInTheDocument();
    expect(lastName).toBeInTheDocument();
    expect(username).toBeInTheDocument();
    expect(typeId).toBeInTheDocument();
    expect(accountId).toBeInTheDocument();
    expect(role).toBeInTheDocument();
    expect(systemRole).toBeInTheDocument();

    expect(firstName.required).toBe(true);
    expect(lastName.required).toBe(false);
    expect(username.required).toBe(true);
    expect(typeId.disabled).toBe(false);
    expect(accountId.disabled).toBe(false);
    expect(role.disabled).toBe(false);
    expect(systemRole.disabled).toBe(false);
  });

  it("should not show the system role field for non-super-admin users", () => {
    mockUseUser({
      ...MOCK_DATA.user,
      isSuperAdmin: false,
    });

    renderWithBlankStub({ component: NewUserForm, props: mockFormProps });

    const systemRole = screen.queryByRole("combobox", { name: /select a system role/i });
    expect(systemRole).not.toBeInTheDocument();
  });

  it("should show the system role field for super-admin users", async () => {
    mockUseUser({
      ...MOCK_DATA.user,
      isSuperAdmin: true,
    });

    renderWithBlankStub({ component: NewUserForm, props: mockFormProps });

    const systemRole = await screen.findByRole("combobox", { name: /select a system role/i });
    expect(systemRole).toBeInTheDocument();
  });

  it("should show errors when required fields are not filled", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({ component: NewUserForm, props: mockFormProps });

    await user.click(await screen.findByRole("button", { name: /invite/i }));

    const errors = await screen.findAllByRole("alert");
    expect(errors).toHaveLength(3);
    errors.forEach((e) => expect(e).toHaveTextContent("Required"));
  });

  it("should submit the form with valid data", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({ component: NewUserForm, props: mockFormProps, actionMock: action });

    await user.type(await screen.findByLabelText(/first name/i), "J");
    await user.type(await screen.findByLabelText(/last name/i), "D");
    await user.type(await screen.findByLabelText(/username/i), "a@b.com");
    await user.click(await screen.findByRole("combobox", { name: /select a type/i }));
    await user.click(await screen.findByRole("option", { name: /Type 1/i }));
    await user.click(await screen.findByRole("combobox", { name: /select an account/i }));
    await user.click(await screen.findByRole("option", { name: /Account 1/i }));
    await user.click(await screen.findByRole("button", { name: /invite/i }));

    expect(action).toHaveBeenCalled();
  });
});
