import * as React from "react";

import { cn } from "~/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => {
  return (
    <input
      className={cn(
        "border-input bg-background ring-offset-background placeholder:text-muted-foreground/60 flex h-10 w-full rounded-md border px-3 py-2 sm:text-sm",
        "focus-visible:ring-ring not-[input[type='file']]:read-only:cursor-not-allowed focus-visible:border-transparent focus-visible:ring-2 focus-visible:outline-hidden",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        "read-only:opacity-50 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
