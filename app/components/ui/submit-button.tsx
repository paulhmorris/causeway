import { useIsSubmitting } from "@rvf/react-router";
import { IconLoader } from "@tabler/icons-react";
import { useNavigation } from "react-router";

import type { ButtonProps } from "~/components/ui/button";
import { Button } from "~/components/ui/button";

export function SubmitButton(props: ButtonProps & { formId?: string }) {
  const { formId, ...rest } = props;
  const navigation = useNavigation();
  const isSubmitting = useIsSubmitting(formId);
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  const isDisabled = props.disabled || isSubmitting || navigation.state === "submitting";

  return (
    <Button {...rest} type="submit" disabled={isDisabled}>
      {isSubmitting ? <IconLoader className="h-4 w-4 animate-spin" /> : null}
      {props.children}
    </Button>
  );
}
