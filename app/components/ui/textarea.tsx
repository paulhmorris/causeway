import * as React from "react";

import { cn } from "~/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "border-input bg-background ring-offset-background placeholder:text-muted-foreground read-only:bg-muted focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base read-only:cursor-not-allowed read-only:opacity-50 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
