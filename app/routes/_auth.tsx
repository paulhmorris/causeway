import { IconPlanet } from "@tabler/icons-react";
import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="dark:bg-background sm:bg-secondary flex min-h-full flex-col items-center">
      <main className="grid w-full grow place-items-center">
        <Outlet />
      </main>
      <footer className="mx-auto mt-auto mb-8 shrink">
        <p className="text-xs">
          {new Date().getFullYear()} •{" "}
          <span>
            Cosmic Development <IconPlanet className="mb-0.5 inline size-3.5" />
          </span>
        </p>
      </footer>
    </div>
  );
}
