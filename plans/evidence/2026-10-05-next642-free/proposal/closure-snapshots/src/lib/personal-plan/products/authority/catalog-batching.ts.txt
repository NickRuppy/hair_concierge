import type { SupabaseClient } from "@supabase/supabase-js"

export type CatalogRow = Record<string, unknown>

type QueryResult = {
  data: unknown
  error: unknown
  count?: number | null
}

export type AwaitableCatalogQuery = PromiseLike<QueryResult> & {
  range?: (from: number, to: number) => PromiseLike<QueryResult>
}

export type CatalogBatchSource = {
  table: string
  key: "product_id" | "source_product_id"
  select: string
  cardinality: "one" | "many"
  filters?: readonly { column: string; value: unknown }[]
  orderBy: readonly string[]
}

export type CatalogBatchSnapshot = Map<string, Map<string, CatalogRow[]>>

export async function loadCatalogBatchSnapshot(
  client: SupabaseClient,
  sources: readonly CatalogBatchSource[],
  productIds: string[],
  options: { chunkSize: number; pageSize: number },
): Promise<CatalogBatchSnapshot | null> {
  if (productIds.length === 0) return new Map()
  const probe = client.from(sources[0]!.table).select("*") as unknown as { in?: unknown }
  // Legacy focused doubles exercise the per-product semantic selectors. Production Supabase and
  // the completeness harness both support set filters and take the bounded batch path.
  if (typeof probe.in !== "function") return null

  const snapshot: CatalogBatchSnapshot = new Map()
  await Promise.all(
    sources.map(async (source) => {
      const allRows: CatalogRow[] = []
      for (const ids of chunkValues(productIds, options.chunkSize)) {
        const rows = await pagedCatalogRows(
          () => {
            let query = client
              .from(source.table)
              .select(source.select, { count: "exact" }) as unknown as {
              in(column: string, values: string[]): unknown
              eq(column: string, value: unknown): unknown
              order(column: string, options: { ascending: boolean }): unknown
            }
            query = query.in(source.key, ids) as typeof query
            for (const filter of source.filters ?? []) {
              query = query.eq(filter.column, filter.value) as typeof query
            }
            for (const column of source.orderBy) {
              query = query.order(column, { ascending: true }) as typeof query
            }
            return query as unknown as AwaitableCatalogQuery
          },
          options.pageSize,
          source.table.includes("protocol")
            ? "stage3_authority_protocol_unavailable"
            : "stage3_authority_spec_unavailable",
        )
        allRows.push(...rows)
      }
      const grouped = groupCatalogRows(allRows, source.key)
      if (source.cardinality === "one") {
        for (const rows of grouped.values()) {
          if (rows.length > 1) throw new Error("stage3_authority_spec_unavailable")
        }
      }
      snapshot.set(source.table, grouped)
    }),
  )
  return snapshot
}

export async function pagedCatalogRows(
  makeQuery: () => AwaitableCatalogQuery,
  pageSize: number,
  errorCode: string,
): Promise<CatalogRow[]> {
  const rows: CatalogRow[] = []
  let expectedCount: number | null = null
  let from = 0
  while (true) {
    const query = makeQuery()
    const supportsRange = typeof query.range === "function"
    const result = await (supportsRange ? query.range!(from, from + pageSize - 1) : query)
    if (result.error) throw new Error(errorCode)
    if (typeof result.count === "number") {
      if (expectedCount !== null && expectedCount !== result.count) throw new Error(errorCode)
      expectedCount = result.count
    }
    const page = Array.isArray(result.data) ? (result.data as CatalogRow[]) : []
    rows.push(...page)
    if (!supportsRange) break
    if (expectedCount !== null && rows.length >= expectedCount) break
    if (page.length < pageSize) break
    from += pageSize
  }
  if (expectedCount !== null && rows.length !== expectedCount) throw new Error(errorCode)
  return rows
}

export function chunkValues<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function groupCatalogRows(rows: CatalogRow[], key: string): Map<string, CatalogRow[]> {
  const grouped = new Map<string, CatalogRow[]>()
  for (const row of rows) {
    const value = typeof row[key] === "string" && row[key].trim() ? row[key] : null
    if (!value) continue
    const current = grouped.get(value) ?? []
    current.push(row)
    grouped.set(value, current)
  }
  return grouped
}
