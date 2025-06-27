import { screen } from "@testing-library/dom";
import { act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { mockUseUser, renderWithBlankStub } from "test/test-utils";
import { NewContactForm } from "~/components/forms/new-contact-form";

const mockFormProps = {
  contactTypes: [
    { id: 1, name: "Type 1" },
    { id: 2, name: "Type 2" },
  ],
  usersWhoCanBeAssigned: [
    { id: "user1", contact: { firstName: "Alice", lastName: "Smith", email: "alice@smith.com" } },
    { id: "user2", contact: { firstName: "Bob", lastName: "Johnson", email: "bob@johnson.com" } },
  ],
};

vi.mock("~/hooks/useUser");

describe("New Contact Form", () => {
  beforeEach(() => mockUseUser());

  it("renders the form fields correctly", async () => {
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });

    const firstName = await screen.findByLabelText<HTMLInputElement>(/first name/i);
    const lastName = await screen.findByLabelText<HTMLInputElement>(/last name/i);
    const email = await screen.findByLabelText<HTMLInputElement>(/email/i);
    const alternateEmail = await screen.findByLabelText<HTMLInputElement>(/alternate email/i);
    const phone = await screen.findByLabelText<HTMLInputElement>("Phone");
    const alternatePhone = await screen.findByLabelText<HTMLInputElement>(/alternate phone/i);
    const organizationName = await screen.findByLabelText<HTMLInputElement>(/organization name/i);
    const typeId = await screen.findByRole<HTMLInputElement>("combobox", { name: /type/i });
    const aliceSmithOption = await screen.findByLabelText<HTMLInputElement>(/alice smith/i);
    const allCheckboxes = await screen.findAllByRole("checkbox");

    expect(firstName).toBeInTheDocument();
    expect(lastName).toBeInTheDocument();
    expect(email).toBeInTheDocument();
    expect(alternateEmail).toBeInTheDocument();
    expect(phone).toBeInTheDocument();
    expect(alternatePhone).toBeInTheDocument();
    expect(organizationName).toBeInTheDocument();
    expect(typeId).toBeInTheDocument();
    expect(aliceSmithOption).toBeInTheDocument();
    expect(allCheckboxes.length).toBe(2);

    expect(firstName.required).toBe(true);
    expect(lastName.required).toBe(false);
    expect(email.required).toBe(false);
    expect(alternateEmail.required).toBe(false);
    expect(phone.required).toBe(false);
    expect(alternatePhone.required).toBe(false);
    expect(organizationName.required).toBe(false);
    expect(typeId.disabled).toBe(false);
    expect(aliceSmithOption.ariaChecked).toBe("false");
  });

  it("should not render address fields by default", () => {
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });
    expect(screen.queryByRole("group", { name: /address fields/i })).not.toBeInTheDocument();
  });

  it("should render address fields when add address is clicked", async () => {
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });

    const addressCheckbox = await screen.findByRole("button", { name: /add address/i });
    act(() => addressCheckbox.click());

    const addressFields = await screen.findByRole("group", { name: /address fields/i });
    expect(addressFields).toBeInTheDocument();
    expect(await screen.findByLabelText(/street 1/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/street 2/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/city/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/state \/ province/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/postal code/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/country/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /remove address/i })).toBeInTheDocument();
  });

  it("should remove address fields when remove address is clicked", async () => {
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });

    const addAddressButton = await screen.findByRole("button", { name: /add address/i });
    act(() => addAddressButton.click());

    const removeAddressButton = await screen.findByRole("button", { name: /remove address/i });
    act(() => removeAddressButton.click());

    expect(screen.queryByRole("group", { name: /address fields/i })).not.toBeInTheDocument();
  });

  it("should show an error when required fields are not filled", async () => {
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });

    const submitButton = await screen.findByRole("button", { name: /create contact/i });
    act(() => submitButton.click());

    const errors = await screen.findAllByRole("alert");
    expect(errors).toHaveLength(2);
  });

  it("should be valid with minimum required fields", async () => {
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText(/first name/i), "J");
    await user.click(await screen.findByRole("combobox", { name: /type/i }));
    await user.click(await screen.findByRole("option", { name: "Type 1" }));

    const form = await screen.findByRole<HTMLFormElement>("form", { name: /new contact/i });
    expect(form.checkValidity()).toBe(true);
  });

  it("should require address fields when address is added", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps });

    await user.click(await screen.findByRole("button", { name: /add address/i }));
    await user.click(await screen.findByRole("button", { name: /create contact/i }));

    const errors = await screen.findAllByRole("alert");
    // 5 address fields + 2 required fields (first name and type)
    expect(errors).toHaveLength(5 + 2);
  });

  it("should not require address fields when address is added then removed", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps, actionMock: action });

    await user.type(await screen.findByLabelText(/first name/i), "J");
    await user.click(await screen.findByRole("combobox", { name: /type/i }));
    await user.click(await screen.findByRole("option", { name: "Type 1" }));

    await user.click(await screen.findByRole("button", { name: /add address/i }));
    await user.click(await screen.findByRole("button", { name: /remove address/i }));
    await user.click(await screen.findByRole("button", { name: /create contact/i }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should submit the form with valid data", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({ component: NewContactForm, props: mockFormProps, actionMock: action });

    await user.type(await screen.findByLabelText(/first name/i), "J");
    await user.click(await screen.findByRole("combobox", { name: /type/i }));
    await user.click(await screen.findByRole("option", { name: "Type 1" }));
    await user.click(await screen.findByRole("checkbox", { name: /alice smith/i }));
    await user.click(await screen.findByRole("button", { name: /create contact/i }));

    expect(action).toHaveBeenCalledTimes(1);
  });
});
