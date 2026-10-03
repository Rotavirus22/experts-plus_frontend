"use client";

import {
  columnFilteringFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/** Features every app table uses: sorting + search (global filter). */
export const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  filterFns: { includesString: filterFn_includesString },
});
export type DataTableFeatures = typeof dataTableFeatures;
export type DataTableColumn<T extends RowData> = ColumnDef<DataTableFeatures, T> & { meta?: { align?: "right" } };

/**
 * Card table with a tinted header. Pass `search` to drive filtering from a search box elsewhere
 * (e.g. the page header); otherwise a search box is shown above the table.
 */
export function DataTable<T extends RowData>({
  data,
  columns,
  search,
  searchPlaceholder = "Search…",
  rowClassName,
  empty = "Nothing here yet.",
  toolbar,
  title,
}: {
  data: T[];
  columns: DataTableColumn<T>[];
  search?: string;
  searchPlaceholder?: string;
  rowClassName?: (row: T) => string | undefined;
  empty?: React.ReactNode;
  toolbar?: React.ReactNode;
  title?: React.ReactNode;
}) {
  const table = useTable(
    { features: dataTableFeatures, columns, data, globalFilterFn: "includesString" },
    (state) => ({ sorting: state.sorting, globalFilter: state.globalFilter }),
  );
  const controlled = search !== undefined;
  useEffect(() => {
    if (controlled) table.setGlobalFilter(search);
  }, [controlled, search, table]);
  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-3">
      {!controlled && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={searchPlaceholder}
              value={(table.state.globalFilter as string | undefined) ?? ""}
              onChange={(e) => table.setGlobalFilter(e.target.value)}
            />
          </div>
          {toolbar}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {title && <div className="flex items-center justify-between gap-2 border-b px-5 py-4">{title}</div>}
        <Table>
          <TableHeader className="bg-muted/60">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const right = (header.column.columnDef as DataTableColumn<T>).meta?.align === "right";
                  return (
                    <TableHead key={header.id} className={cn("h-11 text-xs font-semibold text-muted-foreground", right && "text-right")}>
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          className={cn("inline-flex items-center gap-1 hover:text-foreground", sorted && "text-foreground")}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUp className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDown className="size-3.5" />
                          ) : (
                            <ArrowUpDown className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className={cn(rowClassName?.(row.original))}>
                  {row.getAllCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
