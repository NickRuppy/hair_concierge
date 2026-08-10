import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import { HEAT_SUPABASE_PROJECT_ID } from "@/lib/product-intake/catalog-enrichment/heat"
import { createSupabaseClientFromEnv } from "../cli"

export function assertHeatLinkedProjectRef(projectRef: string): void {
  if (projectRef.trim() !== HEAT_SUPABASE_PROJECT_ID)
    throw new Error(`Supabase CLI link does not target ${HEAT_SUPABASE_PROJECT_ID}`)
}

export async function heatGitState(): Promise<{ head: string; clean: boolean }> {
  const [head, worktree] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: worktree.stdout.trim().length === 0 }
}

export function parseHeatLinkedMigrationState(
  output: string,
  migration = "20260810090000",
): "absent" | "applied" {
  const version = migration.match(/^\d{14}/)?.[0]
  if (!version) throw new Error(`Heat migration has no timestamp version: ${migration}`)
  for (const line of output.split("\n")) {
    const row = line.match(/^\s*(\d{14})?\s*(?:│|\|)\s*(\d{14})?\s*(?:│|\|)/)
    if (!row || row[1] !== version) continue
    if (!row[2]) return "absent"
    if (row[2] === version) return "applied"
    throw new Error(`linked migration list has conflicting remote version for ${version}`)
  }
  throw new Error(`linked migration list omitted local Heat migration ${version}`)
}

type QueryResult = Promise<{
  data: Record<string, unknown>[] | Blob | null
  error: { message: string } | null
}>
type HEATClient = {
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
    name: "apply_catalog_enrichment_personal_plan_heat_v1",
    args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
  ) => QueryResult
}

/** Narrow read/write bridge; Heat never exposes generic write-table operations. */
export function createHeatClientAdapters(
  client: HEATClient,
  releaseChecks: {
    linkedProjectRef?: () => Promise<string>
    linkedMigrationList?: () => Promise<string>
  } = {},
) {
  const linkedProjectRef =
    releaseChecks.linkedProjectRef ?? (async () => readFile("supabase/.temp/project-ref", "utf8"))
  const linkedMigrationList =
    releaseChecks.linkedMigrationList ??
    (async () => {
      const { stdout } = await promisify(execFile)("npm", [
        "exec",
        "--",
        "supabase",
        "migration",
        "list",
        "--linked",
      ])
      return stdout
    })
  return {
    read: {
      async list(table: string, offset: number, limit: number) {
        const { data, error } = await client
          .from(table)
          .select("*")
          .range(offset, offset + limit - 1)
        if (error) throw new Error(`Heat read ${table}: ${error.message}`)
        return data ?? []
      },
      async object(bucket: string, path: string) {
        const { data, error } = await client.storage.from(bucket).download(path)
        if (error) {
          if (/not found|does not exist/i.test(error.message)) return null
          throw new Error(`Heat Storage read ${path}: ${error.message}`)
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
      async migrationState(migration: string) {
        assertHeatLinkedProjectRef(await linkedProjectRef())
        return parseHeatLinkedMigrationState(await linkedMigrationList(), migration)
      },
    },
    write: {
      async upload(bucket: string, path: string, bytes: Uint8Array) {
        const { error } = await client.storage
          .from(bucket)
          .upload(path, bytes, { upsert: false, contentType: "image/webp" })
        if (error) throw new Error(`Heat Storage upload ${path}: ${error.message}`)
      },
      async object(bucket: string, path: string) {
        const { data, error } = await client.storage.from(bucket).download(path)
        if (error) {
          if (/not found|does not exist/i.test(error.message)) return null
          throw new Error(`Heat Storage read ${path}: ${error.message}`)
        }
        return new Uint8Array(await (data as Blob).arrayBuffer())
      },
      async rpc(
        name: "apply_catalog_enrichment_personal_plan_heat_v1",
        args: { p_batch_json: string; p_expected_batch_fingerprint: string; p_reviewed_by: "nick" },
      ) {
        const { error } = await client.rpc(name, args)
        if (error) throw new Error(error.message)
      },
    },
  }
}

export function heatClientAdapters() {
  return createHeatClientAdapters(createSupabaseClientFromEnv() as unknown as HEATClient)
}
