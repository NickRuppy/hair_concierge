import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { sep } from "node:path"
import { promisify } from "node:util"

import {
  applyPersonalPlanProductDispositionReversal,
  buildPersonalPlanProductDispositionReversalManifest,
  preflightPersonalPlanProductDispositionReversalManifest,
  PRODUCT_DISPOSITION_REVERSAL_MIGRATIONS,
  type PersonalPlanProductDispositionReversalRead,
} from "@/lib/product-intake/catalog-enrichment/stage5-product-disposition-reversals"
import { createSupabaseClientFromEnv, flag, flagBool, parseArgs, printJson } from "../cli"

type Query<T> = Promise<{ data: T | null; error: { message: string } | null }>
type Client = {
  from(table: string): {
    select<T>(columns: string): {
      in(column: string, values: string[]): Query<T[]>
      eq(column: string, value: string): Query<T[]>
    }
  }
  rpc(
    name: "apply_personal_plan_product_search_disposition_reversal_v1",
    args: {
      p_manifest_json: string
      p_expected_manifest_fingerprint: string
      p_reviewed_head: string
      p_reviewed_by: "nick"
      p_execution_enabled: true
    },
  ): Query<Array<{ product_id: string; removed: boolean; replay: boolean }>>
}

const execFileAsync = promisify(execFile)

function supabaseWorkdir(cwd = process.cwd()) {
  const marker = `${sep}.worktrees${sep}`
  const markerIndex = cwd.indexOf(marker)
  return markerIndex === -1 ? cwd : cwd.slice(0, markerIndex)
}

function linkedMigrationState(output: string, migration: string): "absent" | "applied" {
  let remoteMatches = 0
  for (const line of output.split("\n")) {
    const row = line.match(/^\s*(\d{14})?\s*(?:│|\|)\s*(\d{14})?\s*(?:│|\|)/)
    if (row?.[2] === migration) remoteMatches += 1
  }
  if (remoteMatches > 1) {
    throw new Error(`linked migration list has duplicate reversal migration ${migration}`)
  }
  return remoteMatches === 1 ? "applied" : "absent"
}

export function personalPlanProductDispositionReversalProjectIdFromUrl(value: string | undefined) {
  if (!value) return ""
  try {
    return new URL(value).hostname.split(".")[0] ?? ""
  } catch {
    return ""
  }
}

export function createPersonalPlanProductDispositionReversalRead(
  client: Client,
): PersonalPlanProductDispositionReversalRead {
  let migrationOutput: Promise<string> | undefined
  async function linkedMigrations() {
    migrationOutput ??= execFileAsync("npm", [
      "exec",
      "--",
      "supabase",
      "migration",
      "list",
      "--linked",
      "--workdir",
      supabaseWorkdir(),
    ]).then(({ stdout }) => stdout)
    return migrationOutput
  }
  return {
    async migrationState(version) {
      if (!Object.hasOwn(PRODUCT_DISPOSITION_REVERSAL_MIGRATIONS, version)) {
        throw new Error(`unknown disposition reversal migration: ${version}`)
      }
      return linkedMigrationState(await linkedMigrations(), version)
    },
    async listProducts(ids) {
      const { data, error } = await client
        .from("products")
        .select<{
          id: string
          name: string
          category_key: string | null
          origin: string | null
          is_active: boolean
          lifecycle_status: string
          suitable_thicknesses: string[] | null
        }>("id,name,category_key,origin,is_active,lifecycle_status,suitable_thicknesses")
        .in("id", ids)
      if (error)
        throw new Error(`product_disposition_reversal_product_read_failed:${error.message}`)
      return data ?? []
    },
    async listDispositions(ids) {
      const { data, error } = await client
        .from("personal_plan_product_search_dispositions")
        .select<{
          product_id: string
          disposition: string
          reason_code: string
          reason: string
          sources: unknown
          source_batch: string
          source_fingerprint: string
          reviewed_by: string
        }>(
          "product_id,disposition,reason_code,reason,sources,source_batch,source_fingerprint,reviewed_by",
        )
        .in("product_id", ids)
      if (error)
        throw new Error(`product_disposition_reversal_disposition_read_failed:${error.message}`)
      return data ?? []
    },
    async listBatchReceipts(batchId) {
      const { data, error } = await client
        .from("personal_plan_product_search_disposition_reversal_batches")
        .select<{
          batch_id: string
          manifest_fingerprint: string
          reviewed_head: string
          reviewed_by: string
          item_count: number
        }>("batch_id,manifest_fingerprint,reviewed_head,reviewed_by,item_count")
        .eq("batch_id", batchId)
      if (error) throw new Error(`product_disposition_reversal_batch_read_failed:${error.message}`)
      return data ?? []
    },
    async listItemReceipts(batchId) {
      const { data, error } = await client
        .from("personal_plan_product_search_disposition_reversal_items")
        .select<{
          batch_id: string
          product_id: string
          prior_disposition: string
          prior_reason_code: string
          prior_reason: string
          prior_sources: unknown
          prior_source_batch: string
          prior_source_fingerprint: string
          reversal_reason: string
          reversal_sources: unknown
        }>(
          "batch_id,product_id,prior_disposition,prior_reason_code,prior_reason,prior_sources,prior_source_batch,prior_source_fingerprint,reversal_reason,reversal_sources",
        )
        .eq("batch_id", batchId)
      if (error) throw new Error(`product_disposition_reversal_item_read_failed:${error.message}`)
      return data ?? []
    },
    async listOilEligibility(ids) {
      const { data, error } = await client
        .from("product_oil_eligibility")
        .select<{
          product_id: string
          thickness: string | null
          oil_subtype: string | null
        }>("product_id,thickness,oil_subtype")
        .in("product_id", ids)
      if (error)
        throw new Error(`product_disposition_reversal_oil_eligibility_read_failed:${error.message}`)
      return data ?? []
    },
    async listOilSpecs(ids) {
      const { data, error } = await client
        .from("product_oil_specs")
        .select<{
          product_id: string
          weight: string | null
          role_support: string[] | null
        }>("product_id,weight,role_support")
        .in("product_id", ids)
      if (error)
        throw new Error(`product_disposition_reversal_oil_specs_read_failed:${error.message}`)
      return data ?? []
    },
    async listProtocols(ids) {
      const { data, error } = await client
        .from("product_application_protocols")
        .select<{
          product_id: string
          category: string
          role: string
          source_url: string | null
          source_text: string | null
          guidance_payload: unknown
          guidance_payload_v2: unknown
        }>("product_id,category,role,source_url,source_text,guidance_payload,guidance_payload_v2")
        .in("product_id", ids)
      if (error)
        throw new Error(`product_disposition_reversal_protocol_read_failed:${error.message}`)
      return data ?? []
    },
  }
}

async function gitState() {
  const [head, status] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"]),
    execFileAsync("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

export async function runPersonalPlanProductDispositionReversalCommand(
  argv = process.argv.slice(2),
  client = createSupabaseClientFromEnv() as unknown as Client,
) {
  const parsed = parseArgs(argv)
  const file = flag(parsed, "file")
  if (!file) throw new Error("product_disposition_reversal_requires_--file")
  const built = buildPersonalPlanProductDispositionReversalManifest(
    JSON.parse(await readFile(file, "utf8")),
  )
  const preflight = await preflightPersonalPlanProductDispositionReversalManifest(
    built,
    createPersonalPlanProductDispositionReversalRead(client),
  )
  const args = {
    apply: flagBool(parsed, "apply"),
    confirm: flagBool(parsed, "confirm"),
    confirmProject: flag(parsed, "confirm-project"),
    expectedFingerprint: flag(parsed, "expected-fingerprint"),
    reviewedHead: flag(parsed, "reviewed-head"),
    reviewer: flag(parsed, "reviewer"),
  }
  const result = await applyPersonalPlanProductDispositionReversal({
    built,
    args,
    preflight,
    gitState: await gitState(),
    actualProjectId: personalPlanProductDispositionReversalProjectIdFromUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    executionEnabled: process.env.PERSONAL_PLAN_PRODUCT_DISPOSITION_REVERSAL_ENABLED,
    write: {
      async apply(input) {
        const { data, error } = await client.rpc(
          "apply_personal_plan_product_search_disposition_reversal_v1",
          input,
        )
        if (error) throw new Error(`product_disposition_reversal_apply_failed:${error.message}`)
        return data ?? []
      },
    },
  })
  return { ...preflight, ...result }
}

if (require.main === module) {
  runPersonalPlanProductDispositionReversalCommand()
    .then(printJson)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
