import {
  IconAlertCircleFilled,
  IconAlertTriangleFilled,
  IconCircleCheckFilled,
  IconInfoCircleFilled,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { useRouteLoaderData } from "react-router";
import { useTheme } from "remix-themes";
import { Toaster, toast } from "sonner";

import { loader } from "~/root";

export function Notifications() {
  const [theme] = useTheme();
  const data = useRouteLoaderData<typeof loader>("root");
  useEffect(() => {
    if (!data?.toast) return;
    const { message, type, ...rest } = data.toast;
    switch (type) {
      case "success": {
        toast.success(message, {
          ...rest,
          icon: <IconCircleCheckFilled className="h-5 w-5" />,
        });
        break;
      }
      case "error": {
        toast.error(message, {
          ...rest,
          icon: <IconAlertCircleFilled className="h-5 w-5" />,
          duration: Infinity,
        });
        break;
      }
      case "warning": {
        toast.warning(message, {
          ...rest,
          icon: <IconAlertTriangleFilled className="h-5 w-5" />,
        });
        break;
      }
      case "info": {
        toast.info(message, {
          ...rest,
          icon: <IconInfoCircleFilled className="h-5 w-5" />,
        });
        break;
      }
      default: {
        toast(message, rest);
        break;
      }
    }
  }, [data]);

  return (
    <Toaster
      expand
      richColors
      closeButton
      duration={5000}
      theme={theme ?? undefined}
      toastOptions={{
        classNames: {
          closeButton: "bg-background! text-foreground! border-border!",
        },
      }}
    />
  );
}
