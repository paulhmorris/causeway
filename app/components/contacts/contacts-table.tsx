import { IconAlertTriangle } from "@tabler/icons-react";
import { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";

import { DataTable } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { ContactType } from "~/lib/constants";
import { formatPhoneNumber } from "~/lib/utils";
import { ContactWithCount } from "~/routes/_app.contacts._index";

type Props = {
  data: Array<ContactWithCount>;
  onWarningClick?: (contact: ContactWithCount) => void;
};

export function ContactsTable({ data, onWarningClick }: Props) {
  const columns = buildColumns(onWarningClick);
  return <DataTable data={data} columns={columns} facets={facets} />;
}

function isIncomplete(contact: ContactWithCount): string | null {
  if (!contact.email && contact.typeId !== ContactType.Staff) {
    return "Missing email";
  }
  if (
    contact._count.accountSubscriptions === 0 &&
    (contact.typeId === ContactType.Missionary || contact.typeId === ContactType.Donor_and_Missionary)
  ) {
    return "No account subscription";
  }
  return null;
}

function buildColumns(onWarningClick?: (contact: ContactWithCount) => void): Array<ColumnDef<ContactWithCount>> {
  return [
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
        const issue = isIncomplete(row.original);
        if (!issue) return null;
        return (
          <button
            type="button"
            onClick={() => onWarningClick?.(row.original)}
            title={issue}
            aria-label={`${issue} — click to fix`}
            className="text-warning hover:text-warning/80 flex items-center gap-1 text-xs transition-colors"
          >
            <IconAlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{issue}</span>
          </button>
        );
      },
      enableColumnFilter: false,
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="First" />,
      cell: ({ row }) => (
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
