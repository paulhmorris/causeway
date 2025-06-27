import { Prisma } from "@prisma/client";
import { ColumnDef } from "@tanstack/react-table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useLoaderData } from "react-router";
dayjs.extend(utc);

import { PageHeader } from "~/components/common/page-header";
import { ErrorComponent } from "~/components/error-component";
import { PageContainer } from "~/components/page-container";
import { TransactionSearch } from "~/components/transactions/transaction-search";
import { DataTable, DEFAULT_PAGE_SIZE } from "~/components/ui/data-table/data-table";
import { DataTableColumnHeader } from "~/components/ui/data-table/data-table-column-header";
import { Facet } from "~/components/ui/data-table/data-table-toolbar";
import { db } from "~/integrations/prisma.server";
import { formatCentsAsDollars } from "~/lib/utils";
import { SessionService } from "~/services.server/session";

export const meta: MetaFunction = () => [{ title: "Transactions" }];

export async function loader(args: LoaderFunctionArgs) {
  const user = await SessionService.requireUser(args);
  const orgId = await SessionService.requireOrgId(args);

  const url = new URL(args.request.url);
  const take = Number(url.searchParams.get("pageSize") ?? DEFAULT_PAGE_SIZE);
  const skip = Number(url.searchParams.get("page") ?? 1) * take - take;

  const search = url.searchParams
    .get("s")
    ?.replaceAll("$", "")
    .replaceAll(".", "")
    .replace(/[^\d-]/g, "");

  const where: Prisma.TransactionFindManyArgs["where"] = {
    AND: [
      {
        orgId,
        account: user.isMember
          ? {
              user: {
                id: user.id,
              },
            }
          : undefined,
      },
      search
        ? {
            amountInCents: {
              equals: Math.abs(Number(search)),
            },
          }
        : {},
    ],
  };

  const [rowCount, transactions] = await db.$transaction([
    db.transaction.count({ where }),
    db.transaction.findMany({
      take,
      skip,
      where,
      select: {
        id: true,
        date: true,
        amountInCents: true,
        description: true,
        category: true,
        contact: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        account: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
      },
      orderBy: [{ date: "desc" }, { account: { code: "asc" } }],
    }),
  ]);
  return { rowCount, transactions };
}

export default function TransactionsIndexPage() {
  const { rowCount, transactions } = useLoaderData<typeof loader>();

  return (
    <>
      <PageHeader title="Transactions" />
      <div className="mt-1 max-w-xs">
        <TransactionSearch />
      </div>
      <PageContainer>
        <DataTable data={transactions} rowCount={rowCount} columns={columns} facets={facets} serverPagination />
      </PageContainer>
    </>
  );
}

type Transaction = Awaited<ReturnType<typeof loader>>["transactions"][number];
const columns = [
  {
    id: "view",
    header: () => <span className="sr-only">Action</span>,
    cell: ({ row }) => (
      <Link to={`/transactions/${row.original.id}`} prefetch="intent" className="text-primary font-medium">
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
          <Link to={`/accounts/${row.original.account.id}`} prefetch="intent" className="text-primary font-medium">
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
            to={`/contacts/${row.original.contact?.id}`}
            prefetch="intent"
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

export function ErrorBoundary() {
  return <ErrorComponent />;
}
