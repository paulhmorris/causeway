import { Prisma } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Link } from "react-router";
dayjs.extend(utc);

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { formatCentsAsDollars } from "~/lib/utils";

type Transaction = Prisma.TransactionGetPayload<{
  select: {
    id: true;
    date: true;
    amountInCents: true;
    description: true;
    category: true;
    contact: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
    account: {
      select: {
        id: true;
        code: true;
        description: true;
      };
    };
  };
}>;

export function TransactionsTable({ data }: { data: Array<Transaction> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

const columns = [
  {
    id: "view",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link prefetch="intent" to={`/transactions/${row.original.id}`} className="text-primary font-medium">
        View
      </Link>
    ),
    enableColumnFilter: false,
  },
  {
    accessorKey: "account",
    accessorFn: (row) => `${row.account.code} - ${row.account.description}`,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Account" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[320px] truncate">
          <Link prefetch="intent" to={`/accounts/${row.original.account.id}`} className="text-primary font-medium">
            {row.getValue("account")}
          </Link>
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
          <span className="max-w-[120px] truncate font-medium">
            {dayjs(row.getValue("date")).utc().format("MM/DD/YYYY")}
          </span>
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
          <span className="sentry-mask truncate font-medium tabular-nums">{row.getValue("amountInCents")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "category",
    accessorFn: (row) => row.category?.name,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
    cell: ({ row }) => {
      return (
        <div className="max-w-[180px] truncate">
          <span className="font-medium">{row.getValue("category")}</span>
        </div>
      );
    },
    enableColumnFilter: false,
  },
  {
    accessorKey: "contact",
    accessorFn: (row) => (row.contact ? `${row.contact.firstName} ${row.contact.lastName}` : ""),
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
    cell: ({ row }) => {
      return (
        <div>
          <Link
            prefetch="intent"
            to={`/contacts/${row.original.contact?.id}`}
            className="text-primary max-w-[500px] truncate font-medium"
          >
            {row.getValue("contact")}
          </Link>
        </div>
      );
    },
    filterFn: (row, id, value) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return value.includes(row.getValue(id));
    },
  },
] satisfies Array<ColumnDef<Transaction>>;

const facets: Array<Facet> = [
  {
    columnId: "contact",
    title: "Contact",
  },
  {
    columnId: "account",
    title: "Account",
  },
];
