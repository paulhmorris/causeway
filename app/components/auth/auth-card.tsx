import { HTMLAttributes } from "react";

import { cn } from "~/lib/utils";

export function AuthCard({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "dark:bg-card sm:bg-background mx-auto w-full max-w-lg px-6 sm:rounded-xl sm:border sm:px-12 sm:py-12 sm:shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
