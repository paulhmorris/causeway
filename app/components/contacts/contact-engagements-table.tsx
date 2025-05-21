import { Prisma } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Link } from "react-router";
dayjs.extend(utc);

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";

export function ContactEngagementsTable({ data }: { data: Array<Engagement> }) {
  return <DataTable data={data} columns={columns} facets={facets} />;
}

type Engagement = Prisma.EngagementGetPayload<{ include: { type: true } }>;
const columns: Array<ColumnDef<Engagement>> = [
  {
    id: "action",
    cell: ({ row }) => (
      <Link to={`/engagements/${row.original.id}`} className="text-primary font-medium">
        View
      </Link>
    ),
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
