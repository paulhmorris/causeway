import { IconLoader } from "@tabler/icons-react";

import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

export function SubmitButton(props: ButtonProps & { isSubmitting: boolean } = { isSubmitting: false }) {
  const { isSubmitting, ...rest } = props;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const isDisabled = props.disabled || isSubmitting;

  return (
    <Button
      {...rest}
      type="submit"
      disabled={isDisabled}
      className={cn(
        "relative transition-[padding,width,background-color,opacity] duration-150 ease-in-out",
        isSubmitting && "pl-10",
      )}
    >
      {isSubmitting ? (
        <div className="animate-in fade-in-0 absolute left-4">
          <IconLoader className="size-4 animate-spin" />
        </div>
      ) : null}
      {props.children}
    </Button>
  );
}
