import { render } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { Mock } from "vitest";

import { useUser } from "~/hooks/useUser";

import { MOCK_DATA } from "./mock-data";

export function renderWithBlankStub<T extends Record<string, unknown>>({
  props = {} as T,
  ...args
}: {
  component: React.ComponentType<T>;
  props?: T;
  loaderMock?: Mock;
  actionMock?: Mock;
}) {
  const Component = args.component;
  const RouteComponent = () => <Component {...props} />;

  const Stub = createRoutesStub([
    {
      path: "/",
      HydrateFallback: () => null,
      Component: RouteComponent,
      loader: args.loaderMock ?? (() => null),
      action: args.actionMock ?? (() => null),
    },
  ]);
  return render(<Stub />);
}

type MockUser = ReturnType<typeof useUser>;
export function mockUseUser(mockData: MockUser = MOCK_DATA.user) {
  const mockedUseUser = useUser as Mock;
  mockedUseUser.mockClear();
  mockedUseUser.mockReturnValue(mockData);
  return mockedUseUser;
}
