import { Outlet } from "@remix-run/react";
import { IconPlanet } from "@tabler/icons-react";

export default function AuthLayout() {
  return (
    <div className="flex min-h-full flex-col items-center dark:bg-background sm:bg-secondary">
      <main className="grid w-full grow place-items-center">
        <Outlet />
      </main>
      <footer className="mx-auto mb-8 mt-auto shrink">
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
