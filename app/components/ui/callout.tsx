import { IconAlertTriangleFilled, IconExclamationCircle, IconInfoCircleFilled, IconNotes } from "@tabler/icons-react";
import { VariantProps, cva } from "class-variance-authority";

import { cn } from "~/lib/utils";

interface Props extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof calloutVariants> {
  children: React.ReactNode;
}

const calloutVariants = cva("rounded-md border p-3 text-sm flex items-start gap-3 whitespace-pre-wrap", {
  variants: {
    variant: {
      info: "bg-primary/5 border-primary",
      warning: "bg-warning/5 border-warning text-foreground",
      destructive: "bg-destructive/5 border-destructive text-foreground",
      outline: "border border-input bg-card text-card-foreground",
    },
  },
  defaultVariants: {
    variant: "info",
  },
});

export function Callout({ children, className, variant = "info", ...props }: Props) {
  const iconMap = {
    info: <IconInfoCircleFilled className="text-primary size-4" />,
    warning: <IconAlertTriangleFilled className="text-warning size-4" />,
    destructive: <IconExclamationCircle className="text-destructive size-4" />,
    outline: <IconNotes className="text-muted-foreground size-4" />,
  };

  return (
    <div className={cn(calloutVariants({ variant, className }))} {...props}>
      <div className="pt-px">{iconMap[variant ?? "info"]}</div>
      <div>{children}</div>
    </div>
  );
}
