import { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { Checkbox } from "~/components/ui/checkbox";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { loader } from "~/routes/_app.attachments._index";

export function ReceiptsTable({ data }: { data: Array<Attachment> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

type Attachment = Awaited<ReturnType<typeof loader>>["receipts"][number];
const columns: Array<ColumnDef<Attachment>> = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: "action",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link prefetch="intent" to={`/attachments/${row.original.id}`} className="text-primary font-medium">
        View
      </Link>
    ),
    enableColumnFilter: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("title")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "user",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Creator" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.original.user.username}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
    cell: ({ row }) => {
      return (
        <span className="max-w-[500px] truncate font-medium">
          {new Date(row.getValue("createdAt")).toLocaleString()}
        </span>
      );
    },
    filterFn: (row, id, value) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return value.includes(row.getValue(id));
    },
  },
  {
    accessorKey: "_count",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Is Attached" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[200px] truncate font-medium">
            {row.original._count.reimbursementRequests > 0 ? "Yes" : "No"}
          </span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
];

const facets: Array<Facet> = [];
