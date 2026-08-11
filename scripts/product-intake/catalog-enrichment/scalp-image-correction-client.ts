import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import {
  SCALP_IMAGE_CORRECTION_MIGRATION,
  SCALP_IMAGE_CORRECTION_PROJECT_ID,
} from "@/lib/product-intake/catalog-enrichment/scalp-image-correction"
import { createSupabaseClientFromEnv } from "../cli"
import { parseScalpLinkedMigrationState } from "./scalp-client"

type QueryResult = Promise<{
  data: Record<string, unknown>[] | Blob | null
  error: { message: string } | null
}>

type Client = {
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
    name: "apply_catalog_enrichment_scalp_image_correction_v1",
    args: {
      p_expected_correction_fingerprint: string
      p_reviewed_by: "nick"
    },
  ) => QueryResult
}

export async function scalpImageCorrectionGitState() {
  const [head, worktree] = await Promise.all([
    promisify(execFile)("git", ["rev-parse", "HEAD"]),
    promisify(execFile)("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: worktree.stdout.trim().length === 0 }
}

export function createScalpImageCorrectionAdapters(
  client: Client,
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
  const object = async (bucket: string, path: string) => {
    const { data, error } = await client.storage.from(bucket).download(path)
    if (error) {
      if (/not found|does not exist/i.test(error.message)) return null
      throw new Error(`Scalp image correction Storage read ${path}: ${error.message}`)
    }
    return new Uint8Array(await (data as Blob).arrayBuffer())
  }
  return {
    read: {
      async list(table: string, offset: number, limit: number) {
        const { data, error } = await client
          .from(table)
          .select("*")
          .range(offset, offset + limit - 1)
        if (error) throw new Error(`Scalp image correction read ${table}: ${error.message}`)
        return data ?? []
      },
      object,
      async hasTables(tables: readonly string[]) {
        const missing: string[] = []
        for (const table of tables) {
          const { error } = await client.from(table).select("*").limit(1)
          if (error) missing.push(table)
        }
        return missing
      },
      async migrationState(migration: string) {
        const projectRef = (await linkedProjectRef()).trim()
        if (projectRef !== SCALP_IMAGE_CORRECTION_PROJECT_ID)
          throw new Error(`Supabase CLI link does not target ${SCALP_IMAGE_CORRECTION_PROJECT_ID}`)
        return parseScalpLinkedMigrationState(await linkedMigrationList(), migration)
      },
    },
    write: {
      object,
      async upload(bucket: string, path: string, bytes: Uint8Array) {
        const { error } = await client.storage
          .from(bucket)
          .upload(path, bytes, { upsert: false, contentType: "image/webp" })
        if (error)
          throw new Error(`Scalp image correction Storage upload ${path}: ${error.message}`)
      },
      async rpc(
        name: "apply_catalog_enrichment_scalp_image_correction_v1",
        args: {
          p_expected_correction_fingerprint: string
          p_reviewed_by: "nick"
        },
      ) {
        const { error } = await client.rpc(name, args)
        if (error) throw new Error(error.message)
      },
    },
  }
}

export function scalpImageCorrectionAdapters() {
  return createScalpImageCorrectionAdapters(createSupabaseClientFromEnv() as unknown as Client)
}

export { SCALP_IMAGE_CORRECTION_MIGRATION }
