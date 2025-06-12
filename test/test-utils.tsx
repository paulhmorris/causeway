import { render } from "@testing-library/react";
import { createRoutesStub } from "react-router";

export function renderWithBlankStub(Component: Parameters<typeof createRoutesStub>[0][number]["Component"]) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component,
      loader() {
        return null;
      },
      action() {
        return null;
      },
    },
  ]);
  return render(<Stub />);
}
