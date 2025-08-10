import { Prisma } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";
import { Link, useFetcher } from "react-router";

import { Button } from "~/components/ui/button";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { cn, formatCentsAsDollars } from "~/lib/utils";
import { accountsIndexSelect } from "~/routes/_app.accounts._index";

type Account = Prisma.AccountGetPayload<{ select: typeof accountsIndexSelect }> & { balance: number };

export function AccountsTable({ data }: { data: Array<Account> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

const columns = [
  {
    id: "view",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link
        prefetch="intent"
        to={`/accounts/${row.original.id}`}
        className="text-primary font-medium decoration-2 underline-offset-2 hover:underline"
      >
        View
      </Link>
    ),
    enableColumnFilter: false,
  },
  {
    accessorKey: "code",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Code" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("code")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "balance",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Balance" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="sentry-mask truncate font-medium tabular-nums">
            {formatCentsAsDollars(row.getValue("balance"))}
          </span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "type",
    accessorFn: (row) => `${row.type.name}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("type")}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "description",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("description")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    id: "view",
    header: () => <span className="sr-only">Secondary Action</span>,
    cell: ({ row }) => {
      const fetcher = useFetcher();
      return (
        <fetcher.Form method="PUT" action="/accounts">
          <input type="hidden" name="accountId" value={row.original.id} />
          <input type="hidden" name="action" value={row.original.isHidden ? "unhide" : "hide"} />
          <Button
            type="submit"
            variant="link"
            disabled={fetcher.state !== "idle"}
            className={cn(
              "-my-2 h-auto font-medium text-transparent decoration-2 underline-offset-2 duration-75 hover:underline sm:h-auto",
              row.original.isHidden && "hover:text-success focus-visible:text-success",
              !row.original.isHidden && "hover:text-destructive focus-visible:text-destructive",
            )}
          >
            {row.original.isHidden ? "Unhide" : "Hide"}
          </Button>
        </fetcher.Form>
      );
    },
    enableColumnFilter: false,
  },
] satisfies Array<ColumnDef<Account & { balance: number }>>;

const facets: Array<Facet> = [
  {
    columnId: "type",
    title: "Type",
    options: [
      { label: "Operating", value: "Operating" },
      { label: "Benevolence", value: "Benevolence" },
      { label: "Ministry", value: "Ministry" },
    ],
  },
];
