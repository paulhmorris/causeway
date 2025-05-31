import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  [
    "relative isolate inline-flex gap-x-2 items-center select-none justify-center touch-manipulation whitespace-nowrap rounded-lg text-base/6 sm:text-sm font-semibold ring-offset-background transition-colors transition-[box-shadow]",
    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-60 cursor-pointer",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white dark:text-black hover:bg-primary/95 border border-transparent shadow-[inset_0_1px_#FFFFFF44]",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/95 border border-transparent shadow-[inset_0_1px_#FFFFFF44]",
        outline: "text-primary border border-primary/50 bg-transparent hover:bg-primary/10",
        ghost: "text-primary hover:bg-primary/10",
        link: "text-accent underline-offset-4 decoration-2 hover:underline",
      },
      size: {
        default: "h-11 sm:h-9 px-4 py-2.5 sm:py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "size-10 aspect-square",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
