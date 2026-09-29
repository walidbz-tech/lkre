"use client"

import { useTable, type RowData, type SortingState } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { appTableFeatures, type AppColumns } from "@/lib/table"
import { cn } from "@/lib/utils"

interface DataTableProps<T extends RowData> {
  columns: AppColumns<T>
  data: T[]
  /** Rendu « carte » utilisé sous 768 px. */
  renderCard: (row: T) => ReactNode
  search?: string
  initialSorting?: SortingState
  pageSize?: number
  onRowClick?: (row: T) => void
  empty?: ReactNode
  caption?: string
  getRowId?: (row: T) => string
}

/** Tableau triable, filtrable et paginé ; liste de cartes sur mobile. */
export function DataTable<T extends RowData>({
  columns,
  data,
  renderCard,
  search = "",
  initialSorting = [],
  pageSize = 10,
  onRowClick,
  empty,
  caption,
  getRowId,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize })
  const [previousSearch, setPreviousSearch] = useState(search)
  if (previousSearch !== search) {
    // Revenir en page 1 quand la recherche change.
    setPreviousSearch(search)
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  const table = useTable({
    features: appTableFeatures,
    data,
    columns,
    state: { sorting, globalFilter: search, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: "includesString",
    getRowId,
    autoResetPageIndex: false,
  })

  const rows = table.getRowModel().rows
  const total = table.getFilteredRowModel().rows.length

  if (total === 0 && empty) return <>{empty}</>

  return (
    <div className="space-y-3">
      {/* Mobile : cartes */}
      <ul className="grid gap-2 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id}>{renderCard(row.original)}</li>
        ))}
      </ul>

      {/* Desktop : tableau */}
      <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="bg-muted/40 hover:bg-muted/40">
                {group.headers.map((header) => {
                  const meta = header.column.columnDef.meta
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "h-10 text-xs font-medium text-muted-foreground",
                        meta?.align === "right" && "text-right",
                        meta?.className
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            "-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-1 hover:text-foreground",
                            meta?.align === "right" && "flex-row-reverse"
                          )}
                        >
                          <table.FlexRender header={header} />
                          {sorted === "asc" ? (
                            <ArrowUpIcon aria-hidden className="size-3.5" />
                          ) : sorted === "desc" ? (
                            <ArrowDownIcon aria-hidden className="size-3.5" />
                          ) : (
                            <ArrowUpDownIcon aria-hidden className="size-3.5 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getAllCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn("py-2.5", meta?.align === "right" && "tabular text-right", meta?.className)}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {table.getPageCount() > 1 ? (
        <nav className="flex items-center justify-between gap-2 text-sm" aria-label="Pagination">
          <p className="tabular text-muted-foreground">
            {pagination.pageIndex * pagination.pageSize + 1}–
            {Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize)} sur {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon /> Précédent
            </Button>
            <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
              Suivant <ChevronRightIcon />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  )
}

/** Carte mobile cliquable standard. */
export function MobileCard({
  children,
  onClick,
  className,
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
}) {
  const Comp = onClick ? "button" : "div"
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "w-full rounded-xl border bg-card p-3.5 text-left",
        onClick && "transition-colors hover:bg-accent/60 active:bg-accent",
        className
      )}
    >
      {children}
    </Comp>
  )
}
