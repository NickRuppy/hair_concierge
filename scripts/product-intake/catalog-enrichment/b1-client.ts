import { createSupabaseClientFromEnv } from "../cli"

type QueryResult = Promise<{
  data: Record<string, unknown>[] | Blob | null
  error: { message: string } | null
}>
type B1Client = {
  from: (table: string) => {
    select: (columns: string) => {
      range: (from: number, to: number) => QueryResult
      limit: (count: number) => QueryResult
    }
  }
  storage: {
    from: (bucket: string) => {
      download: (path: string) => QueryResult
      upload: (
        path: string,
        bytes: Uint8Array,
        options: { upsert: false; contentType: string },
      ) => QueryResult
    }
  }
  rpc: (
    name: "catalog_enrichment_apply_batch",
    args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
  ) => QueryResult
}

/** Narrow read/write bridge; B1 never exposes generic write-table operations. */
export function b1ClientAdapters() {
  const client = createSupabaseClientFromEnv() as unknown as B1Client
  return {
    read: {
      async list(table: string, offset: number, limit: number) {
        const { data, error } = await client
          .from(table)
          .select("*")
          .range(offset, offset + limit - 1)
        if (error) throw new Error(`B1 read ${table}: ${error.message}`)
        return data ?? []
      },
      async object(bucket: string, path: string) {
        const { data, error } = await client.storage.from(bucket).download(path)
        if (error) {
          if (/not found|does not exist/i.test(error.message)) return null
          throw new Error(`B1 Storage read ${path}: ${error.message}`)
        }
        return new Uint8Array(await (data as Blob).arrayBuffer())
      },
      async hasTables(tables: readonly string[]) {
        const missing: string[] = []
        for (const table of tables) {
          const { error } = await client.from(table).select("*").limit(1)
          if (error) missing.push(table)
        }
        return missing
      },
    },
    write: {
      async upload(bucket: string, path: string, bytes: Uint8Array) {
        const { error } = await client.storage
          .from(bucket)
          .upload(path, bytes, { upsert: false, contentType: "image/webp" })
        if (error) throw new Error(`B1 Storage upload ${path}: ${error.message}`)
      },
      async object(bucket: string, path: string) {
        const { data, error } = await client.storage.from(bucket).download(path)
        if (error) {
          if (/not found|does not exist/i.test(error.message)) return null
          throw new Error(`B1 Storage read ${path}: ${error.message}`)
        }
        return new Uint8Array(await (data as Blob).arrayBuffer())
      },
      async rpc(
        name: "catalog_enrichment_apply_batch",
        args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
      ) {
        const { error } = await client.rpc(name, args)
        if (error) throw new Error(error.message)
      },
    },
  }
}
