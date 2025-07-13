import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";

import { renderWithBlankStub } from "test/test-utils";
import { OrgSettingsForm } from "~/components/forms/org-settings-form";

const MOCK_PROPS = {
  org: {
    name: "Test Organization",
    primaryEmail: "admin@test.com",
  },
};

describe("Org Settings Form", () => {
  it("renders the form fields correctly", async () => {
    renderWithBlankStub({ component: OrgSettingsForm, props: MOCK_PROPS });

    const nameInput = await screen.findByLabelText<HTMLInputElement>(/organization name/i);
    const emailInput = await screen.findByLabelText<HTMLInputElement>(/administrator email/i);

    expect(nameInput).toBeInTheDocument();
    expect(emailInput).toBeInTheDocument();
    expect(nameInput.value).toBe(MOCK_PROPS.org.name);
    expect(emailInput.value).toBe(MOCK_PROPS.org.primaryEmail);
  });

  it("should show an error when the organization name is cleared", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({ component: OrgSettingsForm, props: MOCK_PROPS });

    const nameInput = await screen.findByLabelText<HTMLInputElement>(/organization name/i);
    await user.clear(nameInput);
    await user.click(await screen.findByRole("button", { name: /save/i }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Required");
  });

  it("should submit the form with valid data", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    renderWithBlankStub({ component: OrgSettingsForm, props: MOCK_PROPS, actionMock: action });

    const nameInput = await screen.findByLabelText<HTMLInputElement>(/organization name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "N");
    await user.click(await screen.findByRole("button", { name: /save/i }));

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("should reset the form when the reset button is clicked", async () => {
    const user = userEvent.setup();
    renderWithBlankStub({ component: OrgSettingsForm, props: MOCK_PROPS });

    const nameInput = await screen.findByLabelText<HTMLInputElement>(/organization name/i);

    await user.clear(nameInput);
    await user.type(nameInput, "A different name");
    expect(nameInput.value).toBe("A different name");

    await user.click(await screen.findByRole("button", { name: /reset/i }));

    expect(nameInput.value).toBe(MOCK_PROPS.org.name);
  });
});
