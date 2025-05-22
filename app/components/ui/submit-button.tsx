import { IconLoader } from "@tabler/icons-react";

import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";

export function SubmitButton(props: ButtonProps & { isSubmitting: boolean } = { isSubmitting: false }) {
  const { isSubmitting, ...rest } = props;
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const isDisabled = props.disabled || isSubmitting;

  return (
    <Button {...rest} type="submit" disabled={isDisabled}>
      {isSubmitting ? <IconLoader className="h-4 w-4 animate-spin" /> : null}
      {props.children}
    </Button>
  );
}
