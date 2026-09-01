import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { promisify } from "node:util"

import { embedProductSpec } from "@/lib/catalog-authority/product-spec-relationships"
import {
  buildStage5ProtocolAmendmentManifest,
  isStage5DispositionResolutionProductionWriteAuthorized,
  parseStage5DispositionResolutionApplyArgs,
  preflightStage5DispositionResolution,
  type Stage5DispositionResolutionRead,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocol-amendments"
import { createSupabaseClientFromEnv, loadLocalEnv } from "../cli"

const AMENDMENT_ROOT = "data/catalog-enrichment/personal-plan-stage5-v2/protocol-amendments"
const BASELINE_PATH =
  "data/catalog-enrichment/personal-plan-stage5-v2/application-pointer-baseline-2026-08-12.json"

type QueryResult<T> = Promise<{ data: T | null; error: { message: string } | null }>
type SelectBuilder<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }> & {
  in(column: string, values: string[]): SelectBuilder<T>
  eq(column: string, value: string | boolean): SelectBuilder<T>
}
type Client = {
  from(table: string): {
    select<T>(columns: string): SelectBuilder<T>
  }
  rpc(
    name: "apply_personal_plan_product_disposition_resolutions_v1",
    args: {
      p_batch_json: string
      p_expected_batch_fingerprint: string
      p_reviewed_by: "nick"
    },
  ): QueryResult<Array<{ product_id: string; resolution: string }>>
}

export function createStage5DispositionResolutionRead(
  client: Client,
): Stage5DispositionResolutionRead {
  return {
    async listProducts(ids) {
      const { data, error } = await client
        .from("products")
        .select<{
          id: string
          category_key: string | null
          origin: string | null
          is_active: boolean
          lifecycle_status: string
          product_shampoo_specs: Array<{ shampoo_bucket: string }>
        }>(
          `id,category_key,origin,is_active,lifecycle_status,${embedProductSpec(
            "product_shampoo_specs",
            "shampoo_bucket",
          )}`,
        )
        .in("id", ids)
      if (error) throw new Error(`disposition_resolution_product_read_failed:${error.message}`)
      return (data ?? []).map(({ product_shampoo_specs, ...product }) => ({
        ...product,
        shampoo_buckets: (product_shampoo_specs ?? []).map(({ shampoo_bucket }) => shampoo_bucket),
      }))
    },
    async listProtocols(ids) {
      const { data, error } = await client
        .from("product_application_protocols")
        .select<{
          product_id: string
          category: string
          role: string
          application_family: string
          source_url: string | null
          guidance_payload: unknown
          guidance_payload_v2: unknown
        }>(
          "product_id,category,role,application_family,source_url,guidance_payload,guidance_payload_v2",
        )
        .in("product_id", ids)
      if (error) throw new Error(`disposition_resolution_protocol_read_failed:${error.message}`)
      return data ?? []
    },
    async listDispositions(ids) {
      const { data, error } = await client
        .from("personal_plan_product_search_dispositions")
        .select<
          Record<string, unknown>
        >("product_id,disposition,reason_code,reason,sources,source_batch,source_fingerprint,reviewed_by")
        .in("product_id", ids)
      if (error) throw new Error(`disposition_resolution_disposition_read_failed:${error.message}`)
      return data ?? []
    },
    async listAppliedItems(batchId, ids) {
      const { data, error } = await client
        .from("catalog_enrichment_applied_items")
        .select<
          Record<string, unknown>
        >("batch_id,product_key,batch_fingerprint,content_fingerprint,product_id,reviewed_by")
        .eq("batch_id", batchId)
        .in("product_id", ids)
      if (error) throw new Error(`disposition_resolution_ledger_read_failed:${error.message}`)
      return data ?? []
    },
  }
}

async function gitState() {
  const execute = promisify(execFile)
  const [head, status] = await Promise.all([
    execute("git", ["rev-parse", "HEAD"]),
    execute("git", ["status", "--porcelain", "--untracked-files=all"]),
  ])
  return { head: head.stdout.trim(), clean: status.stdout.trim().length === 0 }
}

async function loadAmendment(batchId: string) {
  const [input, baseline] = await Promise.all([
    readFile(resolve(AMENDMENT_ROOT, `${batchId}.json`), "utf8"),
    readFile(BASELINE_PATH, "utf8"),
  ])
  return buildStage5ProtocolAmendmentManifest(JSON.parse(input), baseline)
}

export async function runStage5DispositionResolutionCommand(
  argv = process.argv.slice(2),
  client = createSupabaseClientFromEnv() as unknown as Client,
) {
  const args = parseStage5DispositionResolutionApplyArgs(argv)
  const built = await loadAmendment(args.batchId)
  if (built.manifest.batch_id !== args.batchId) {
    throw new Error("disposition_resolution_batch_filename_mismatch")
  }
  const preflight = await preflightStage5DispositionResolution(
    built,
    createStage5DispositionResolutionRead(client),
  )
  if (!args.apply) return { mode: "dry-run" as const, ...preflight }
  if (!preflight.ok) {
    throw new Error(`disposition_resolution_preflight_blocked:${preflight.blockers.join(",")}`)
  }
  if (!isStage5DispositionResolutionProductionWriteAuthorized(process.env)) {
    throw new Error(
      "disposition resolution production write requires the explicit environment gate and production project",
    )
  }
  if (args.expectedFingerprint !== built.resolutionBatch.fingerprint) {
    throw new Error("disposition_resolution_fingerprint_does_not_match_reviewed_batch")
  }
  const state = await gitState()
  if (!state.clean || state.head !== args.reviewedHead) {
    throw new Error("disposition_resolution_apply_requires_exact_clean_reviewed_head")
  }
  const { data, error } = await client.rpc(
    "apply_personal_plan_product_disposition_resolutions_v1",
    {
      p_batch_json: built.resolutionBatch.canonicalJson,
      p_expected_batch_fingerprint: built.resolutionBatch.fingerprint,
      p_reviewed_by: "nick",
    },
  )
  if (error) throw new Error(`disposition_resolution_apply_failed:${error.message}`)
  return {
    mode: "applied" as const,
    batchId: built.manifest.batch_id,
    fingerprint: built.resolutionBatch.fingerprint,
    rows: data ?? [],
  }
}

if (require.main === module) {
  loadLocalEnv()
  runStage5DispositionResolutionCommand()
    .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    })
}
