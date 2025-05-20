import { Link, LinkProps } from "react-router";
import { IconArrowLeft } from "@tabler/icons-react";

export function BackButton({ to }: { to: LinkProps["to"] }) {
  return (
    <Link
      to={to}
      className="mt-2 inline-flex grow-0 items-center gap-1.5 rounded-lg px-2 py-0.5 text-sm underline-offset-2 hover:underline"
    >
      <IconArrowLeft className="size-4" />
      <span>Back</span>
    </Link>
  );
}
