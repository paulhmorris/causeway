import { Prisma } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { formatPhoneNumber } from "~/lib/utils";

export function ContactsTable({ data }: { data: Array<Contact> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

type Contact = Prisma.ContactGetPayload<{ include: { type: true } }>;
const columns: Array<ColumnDef<Contact>> = [
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
    accessorKey: "firstName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="First" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("firstName")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "lastName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Last" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("lastName")}</span>
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
    accessorKey: "email",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("email")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "phone",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{formatPhoneNumber(row.getValue("phone"))}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
];

const facets: Array<Facet> = [
  {
    columnId: "type",
    title: "Type",
    // options: [
    //   { label: "Donor", value: "Donor" },
    //   { label: "Staff", value: "Staff" },
    //   { label: "Admin", value: "Admin" },
    // ],
  },
];
