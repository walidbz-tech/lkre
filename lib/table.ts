import {
  columnFilteringFeature,
  constructFilterFn,
  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table"

/** Normalise pour une recherche insensible à la casse et aux accents. */
export function normalizeSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

const includesIgnoringAccents = constructFilterFn({
  ...filterFn_includesString,
  resolveFilterValue: normalizeSearch,
  resolveDataValue: normalizeSearch,
})

export interface AppColumnMeta {
  align?: "left" | "right"
  className?: string
}

/** Fonctionnalités TanStack Table (v9) partagées par tous les tableaux. */
export const appTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: { includesString: includesIgnoringAccents },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text },
  columnMeta: metaHelper<AppColumnMeta>(),
})

export type AppTableFeatures = typeof appTableFeatures

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonnes hétérogènes (TValue varie par colonne)
export type AppColumns<T extends RowData> = ColumnDef<AppTableFeatures, T, any>[]

export function columnHelper<T extends RowData>() {
  return createColumnHelper<AppTableFeatures, T>()
}
