import { IconCopyright } from "@tabler/icons-react";
import { Outlet } from "react-router";

export default function AuthLayout() {
  return (
    <div className="dark:bg-background sm:bg-secondary flex min-h-full flex-col items-center">
      <main className="grid w-full grow place-items-center">
        <Outlet />
      </main>
      <footer className="mx-auto mt-auto mb-8 shrink">
        <p className="text-muted-foreground flex items-center gap-x-1 text-xs">
          <IconCopyright className="size-4" />
          {new Date().getFullYear()}
          <span>•</span>
          <span>Cosmic Development</span>
        </p>
      </footer>
    </div>
  );
}
