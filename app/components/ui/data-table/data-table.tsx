import { useLocation, useSearchParams } from "react-router";
import { RankingInfo } from "@tanstack/match-sorter-utils";
import {
  ColumnDef,
  ColumnFiltersState,
  FilterFn,
  PaginationState,
  SortingState,
  Updater,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { ClientOnly } from "remix-utils/client-only";
import { useLocalStorage } from "usehooks-ts";

import { DataTablePagination } from "~/components/ui/data-table/data-table-pagination";
import { DataTableToolbar, Facet } from "~/components/ui/data-table/data-table-toolbar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "~/components/ui/table";
import { fuzzyFilter } from "~/lib/utils";

declare module "@tanstack/table-core" {
  interface FilterFns {
    fuzzy: FilterFn<unknown>;
  }
  interface FilterMeta {
    itemRank: RankingInfo;
  }
}

interface DataTableProps<TData> {
  data: Array<TData>;
  columns: Array<ColumnDef<TData>>;
  facets?: Array<Facet>;
  serverPagination?: boolean;
  rowCount?: number;
}

export const DEFAULT_PAGE_SIZE = 40;

export function DataTable<TData>({ data, columns, facets, serverPagination, rowCount }: DataTableProps<TData>) {
  const location = useLocation();
  const [savedSort, setSavedSort, removeSavedSort] = useLocalStorage<SortingState>(
    `data-table-sort-${location.pathname.slice(1)}`,
    [],
  );

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  const defaultSortState: SortingState = savedSort && savedSort.length > 0 ? savedSort : [];
  const [sorting, setSorting] = useState<SortingState>(defaultSortState);
  const [search, setSearch] = useSearchParams();

  const defaultPaginationState: PaginationState = {
    pageIndex: Number(search.get("page") ?? 0),
    pageSize: Number(search.get("pageSize") ?? DEFAULT_PAGE_SIZE),
  };
  const [pagination, setPagination] = useState<PaginationState>(defaultPaginationState);

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState<string>("");

  function updateSort(updaterOrValue: Updater<SortingState>) {
    if (typeof updaterOrValue === "function") {
      const newValue = updaterOrValue(sorting);
      if (newValue.length === 0) {
        removeSavedSort();
      } else {
        setSavedSort(newValue);
      }
      setSorting(newValue);
      return;
    }
    return updaterOrValue;
  }

  function updatePagination(updaterOrValue: Updater<PaginationState>) {
    if (typeof updaterOrValue === "function") {
      const { pageIndex, pageSize } = updaterOrValue(pagination);
      const params = new URLSearchParams(search);
      params.set("pageSize", String(pageSize));
      params.set("page", String(pageIndex + 1));
      setSearch(params, { replace: true, preventScrollReset: true });
      setPagination({ pageIndex, pageSize });
    }
    return updaterOrValue;
  }

  // function updateGlobalFilter(value: string) {
  //   const params = new URLSearchParams(search);
  //   if (value === "") {
  //     params.delete("s");
  //     setSearch(params, { replace: true, preventScrollReset: true });
  //     setGlobalFilter("");
  //     return;
  //   }
  //   params.set("s", String(value));
  //   setSearch(params, { replace: true, preventScrollReset: true });
  //   setGlobalFilter(value);
  // }

  const table = useReactTable({
    data,
    columns,
    rowCount,
    manualPagination: serverPagination,
    filterFns: { fuzzy: fuzzyFilter },
    globalFilterFn: fuzzyFilter,
    state: {
      sorting,
      pagination,
      globalFilter,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: updateSort,
    onPaginationChange: serverPagination ? updatePagination : setPagination,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  return (
    <ClientOnly>
      {() => (
        <div className="space-y-4">
          <DataTableToolbar table={table} facets={facets} />
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : null}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination table={table} />
        </div>
      )}
    </ClientOnly>
  );
}
