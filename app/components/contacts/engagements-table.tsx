import { Prisma } from "@prisma/client";
import { Link } from "react-router";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";

export function EngagementsTable({ data }: { data: Array<Engagement> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

type Engagement = Prisma.EngagementGetPayload<{
  select: {
    id: true;
    type: {
      select: { name: true };
    };
    date: true;
    contact: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
    user: {
      select: {
        contact: {
          select: {
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;
const columns: Array<ColumnDef<Engagement>> = [
  {
    id: "action",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link to={`/engagements/${row.original.id}`} className="font-medium text-primary">
        View
      </Link>
    ),
    enableColumnFilter: false,
  },
  {
    accessorKey: "contact",
    accessorFn: (row) => `${row.contact.firstName} ${row.contact.lastName}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
    cell: ({ row }) => {
      return (
        <Link className="font-medium text-primary" to={`/contacts/${row.original.contact.id}`}>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("contact")}</span>
        </Link>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "user",
    accessorFn: (row) => `${row.user.contact.firstName} ${row.user.contact.lastName}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Staff" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">{row.getValue("user")}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return value.includes(row.getValue(id));
    },
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
    accessorKey: "date",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">
            {dayjs(row.getValue("date")).utc().format("MM/DD/YYYY")}
          </span>
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
  },
];
