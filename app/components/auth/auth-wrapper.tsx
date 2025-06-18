import { IconCopyright } from "@tabler/icons-react";

export function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="dark:bg-background sm:bg-secondary flex min-h-full flex-col items-center">
      <main className="grid w-full grow place-items-center">{children}</main>
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
