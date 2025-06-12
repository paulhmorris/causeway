import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithBlankStub } from "test/test-utils";
import { LoginForm } from "~/components/forms/login-form";

describe("Login Form", () => {
  it("renders the form fields correctly", async () => {
    renderWithBlankStub(LoginForm);

    expect(await screen.findByLabelText(/email/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows an error message for missing email", async () => {
    renderWithBlankStub(LoginForm);
    const email = await screen.findByLabelText(/email/i);

    await userEvent.type(email, "a@b.com");
    await userEvent.clear(email);
    await userEvent.click(await screen.findByRole("button", { name: /login/i }));

    const errorMessage = await screen.findByText(/required/i);
    expect(email).toBeInvalid();
    expect(errorMessage).toBeInTheDocument();
  });

  it("shows an error message for invalid email", async () => {
    renderWithBlankStub(LoginForm);
    const email = await screen.findByLabelText(/email/i);

    await userEvent.type(email, "a@b");
    await userEvent.click(await screen.findByRole("button", { name: /login/i }));

    const errorMessage = await screen.findByText(/invalid email/i);
    expect(email).toBeInvalid();
    expect(errorMessage).toBeInTheDocument();
  });

  it("shows an error message for missing password", async () => {
    renderWithBlankStub(LoginForm);
    const email = await screen.findByLabelText(/email/i);
    const password = await screen.findByLabelText(/password/i);

    await userEvent.type(email, "a@b.com");
    await userEvent.type(password, "abc");
    await userEvent.clear(password);
    await userEvent.click(await screen.findByRole("button", { name: /login/i }));

    const errorMessage = await screen.findByText(/or more characters/i);
    expect(email).toBeValid();
    expect(password).toBeInvalid();
    expect(errorMessage).toBeInTheDocument();
  });

  it("shows an error message for too short password", async () => {
    renderWithBlankStub(LoginForm);
    const email = await screen.findByLabelText(/email/i);
    const password = await screen.findByLabelText(/password/i);

    await userEvent.type(email, "a@b.com");
    await userEvent.type(password, "abc");
    await userEvent.click(await screen.findByRole("button", { name: /login/i }));

    const errorMessage = await screen.findByText(/or more characters/i);
    expect(email).toBeValid();
    expect(password).toBeInvalid();
    expect(errorMessage).toBeInTheDocument();
  });
});
