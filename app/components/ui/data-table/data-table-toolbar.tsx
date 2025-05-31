import { IconX } from "@tabler/icons-react";
import { Table } from "@tanstack/react-table";

import { Button } from "~/components/ui/button";
import { DataTableFacetedFilter } from "~/components/ui/data-table/data-table-faceted-filter";
import { DataTableViewOptions } from "~/components/ui/data-table/data-table-view-options";
import { Input } from "~/components/ui/input";

export interface Facet {
  columnId: string;
  title: string;
  options?: Array<{ label: string; value: string }>;
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  facets?: Array<Facet>;
}

export function DataTableToolbar<TData>({ table, facets }: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        <Input
          placeholder="Filter..."
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          value={table.getState().globalFilter ?? ""}
          onChange={(e) => table.setGlobalFilter(e.target.value)}
          className="h-8 w-[150px] lg:w-[250px]"
        />
        {facets ? (
          <div className="flex items-center gap-2">
            {facets.map((f) => {
              const column = table.getColumn(f.columnId);
              if (!column) return null;

              const options = f.options ?? [];
              if (!f.options) {
                const valuesMap = column.getFacetedUniqueValues();
                valuesMap.forEach((_value, key) => {
                  options.push({ label: String(key), value: String(key) });
                });
              }
              return <DataTableFacetedFilter key={f.columnId} column={column} title={f.title} options={options} />;
            })}
          </div>
        ) : null}
        {isFiltered ? (
          <Button
            variant="ghost"
            onClick={() => table.resetColumnFilters()}
            className="h-8 px-2 py-1 sm:h-8 sm:py-1 lg:px-3"
          >
            Reset
            <IconX className="ml-2 size-4" />
          </Button>
        ) : null}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
