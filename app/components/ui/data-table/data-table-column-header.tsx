import { IconArrowNarrowDown, IconArrowNarrowUp, IconSelector } from "@tabler/icons-react";
import { Column } from "@tanstack/react-table";

import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "data-[state=open]:bg-secondary -ml-3 h-8",
        column.getIsSorted() && "bg-primary hover:bg-primary/90 text-white hover:text-white",
      )}
      onClick={() => column.toggleSorting()}
    >
      <span>{title}</span>
      {column.getIsSorted() === "desc" ? (
        <IconArrowNarrowDown className="ml-2 h-4 w-4" />
      ) : column.getIsSorted() === "asc" ? (
        <IconArrowNarrowUp className="ml-2 h-4 w-4" />
      ) : (
        <IconSelector className="ml-2 h-4 w-4" />
      )}
    </Button>
  );
}
