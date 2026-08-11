import { IconAlertTriangle } from "@tabler/icons-react";
import { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { contactWarning, type ListContact } from "~/lib/contact-health";
import { formatPhoneNumber } from "~/lib/utils";
import { ContactWithCount } from "~/routes/_app.contacts._index";

export function ContactsTable({ data }: { data: Array<ListContact> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

const columns: Array<ColumnDef<ListContact>> = [
  {
    id: "action",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link prefetch="intent" to={`/contacts/${row.original.id}`} className="text-primary font-medium">
        View
      </Link>
    ),
    enableColumnFilter: false,
  },
  {
    id: "warning",
    header: () => <span className="sr-only">Status</span>,
    cell: ({ row }) => {
      const warning = contactWarning(row.original);
      if (!warning) return null;
      return (
        <Link
          prefetch="intent"
          to={warning.to}
          aria-label={warning.label}
          className="text-destructive flex items-center gap-1 text-xs transition-colors"
        >
          <IconAlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{warning.label}</span>
        </Link>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "firstName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="First" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("firstName")}</span>
        </div>
      ),
      enableColumnFilter: false,
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Last" />,
      cell: ({ row }) => (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("lastName")}</span>
        </div>
      ),
      enableColumnFilter: false,
    },
    {
      accessorKey: "type",
      accessorFn: (row) => `${row.type.name}`,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Type" />,
      cell: ({ row }) => (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("type")}</span>
        </div>
      ),
      filterFn: (row, id, value) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return value.includes(row.getValue(id));
      },
    },
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("email")}</span>
        </div>
      ),
      enableColumnFilter: false,
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => (
        <div>
          <span className="max-w-[500px] truncate font-medium">{formatPhoneNumber(row.getValue("phone"))}</span>
        </div>
      ),
      enableColumnFilter: false,
    },
  ];
}

const facets: Array<Facet> = [
  {
    columnId: "type",
    title: "Type",
  },
];
