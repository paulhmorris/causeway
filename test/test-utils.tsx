import { render } from "@testing-library/react";
import { createRoutesStub } from "react-router";

export function renderWithBlankStub<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  props: T = {} as T,
) {
  const RouteComponent = () => <Component {...props} />;

  const Stub = createRoutesStub([
    {
      path: "/",
      HydrateFallback: () => null,
      Component: RouteComponent,
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
