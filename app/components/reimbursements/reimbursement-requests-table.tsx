import { Prisma, ReimbursementRequestStatus } from "@prisma/client";
import { Link } from "react-router";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);

import { Badge } from "~/components/ui/badge";
import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { capitalize, formatCentsAsDollars } from "~/lib/utils";

type ReimbursementRequest = Prisma.ReimbursementRequestGetPayload<{
  include: {
    account: true;
    method: true;
    user: {
      include: {
        contact: true;
      };
    };
  };
}>;

export function ReimbursementRequestsTable({ data }: { data: Array<ReimbursementRequest> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}
const columns: Array<ColumnDef<ReimbursementRequest>> = [
  {
    id: "action",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link to={`/reimbursements/${row.original.id}`} className="font-medium text-primary">
        View
      </Link>
    ),
    enableColumnFilter: false,
  },
  {
    accessorKey: "user",
    accessorFn: (row) => `${row.user.contact.firstName} ${row.user.contact.lastName}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="User" />,
    cell: ({ row }) => {
      return (
        <div>
          <span className="max-w-[500px] truncate font-medium">{row.getValue("user")}</span>
        </div>
      );
    },
    enableColumnFilter: true,
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
        <div className="max-w-[100px]">
          <span className="max-w-[500px] truncate font-medium">
            {dayjs(row.getValue("date")).utc().format("MM/DD/YYYY")}
          </span>
        </div>
      );
    },
  },
  {
    accessorKey: "account",
    accessorFn: (row) => `${row.account.code} - ${row.account.description}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[220px] truncate font-medium">
          <span>{row.getValue("account")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "amountInCents",
    accessorFn: (row) => formatCentsAsDollars(row.amountInCents, 2),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[100px]">
          <span className="truncate font-medium tabular-nums">{row.getValue("amountInCents")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => {
      const value: ReimbursementRequestStatus = row.getValue("status");
      const variant =
        value === "APPROVED"
          ? "success"
          : value === "REJECTED"
            ? "destructive"
            : value === "VOID"
              ? "outline"
              : "secondary";
      return (
        <div>
          <Badge variant={variant}>{capitalize(row.getValue("status"))}</Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return value.includes(row.getValue(id));
    },
    enableColumnFilter: true,
  },
];

const facets: Array<Facet> = [
  {
    columnId: "status",
    title: "Status",
  },
  {
    columnId: "user",
    title: "User",
  },
];
