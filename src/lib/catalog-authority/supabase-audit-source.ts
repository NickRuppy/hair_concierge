import type { CatalogAuditDataSource, CatalogAuditReadRequest } from "./audit-reader"

type QueryResult = {
  data: unknown[] | null
  count: number | null
  error: { message?: string } | null
}

type AuditQuery = {
  select(columns: string, options: { count: "exact" }): AuditQuery
  order(column: string, options?: { ascending?: boolean }): AuditQuery
  range(from: number, to: number): PromiseLike<QueryResult>
}

export type CatalogAuditSupabaseClient = {
  from(table: string): AuditQuery
}

export function createSupabaseCatalogAuditSource(
  client: CatalogAuditSupabaseClient,
  options: { pageSize?: number } = {},
): CatalogAuditDataSource {
  const pageSize = options.pageSize ?? 500
  if (!Number.isInteger(pageSize) || pageSize < 1)
    throw new Error("catalog_audit_page_size_invalid")
  return {
    async readAll(request: CatalogAuditReadRequest) {
      const all: Record<string, unknown>[] = []
      let exactCount: number | null = null
      for (let from = 0; ; from += pageSize) {
        let query = client.from(request.table).select("*", { count: "exact" })
        for (const column of request.orderBy) query = query.order(column, { ascending: true })
        const result = await query.range(from, from + pageSize - 1)
        if (result.error) {
          throw new Error(
            `catalog_audit_read_failed:${request.table}:${result.error.message ?? "unknown"}`,
          )
        }
        if (result.count === null) {
          throw new Error(`catalog_audit_exact_count_missing:${request.table}`)
        }
        if (exactCount !== null && result.count !== exactCount) {
          throw new Error(`catalog_audit_inconsistent_snapshot:${request.table}`)
        }
        exactCount = result.count
        const page = (result.data ?? []) as Record<string, unknown>[]
        all.push(...page)
        if (all.length === exactCount) return { rows: all, exactCount }
        if (all.length > exactCount || page.length === 0) {
          throw new Error(`catalog_audit_count_mismatch:${request.table}`)
        }
      }
    },
  }
}
