import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { promisify } from "node:util"

import { createSupabaseClientFromEnv, flag, flagBool, parseArgs, printJson } from "../cli"
import {
  buildPersonalPlanProductDispositionManifest,
  preflightPersonalPlanProductDispositionManifest,
  type PersonalPlanProductDispositionRead,
} from "@/lib/product-intake/catalog-enrichment/stage5-product-dispositions"

type Query<T> = Promise<{ data: T | null; error: { message: string } | null }>
const execFileAsync = promisify(execFile)

type Client = {
  from(table: string): {
    select<T>(columns: string): { in(column: string, values: string[]): Query<T[]> }
  }
  rpc(
    name: "apply_personal_plan_product_search_dispositions_v1",
    args: {
      p_manifest_json: string
      p_expected_manifest_fingerprint: string
      p_reviewed_by: "nick"
    },
  ): Query<Record<string, unknown>[]>
}

export function createPersonalPlanProductDispositionRead(
  client: Client,
): PersonalPlanProductDispositionRead {
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
          is_chaarlie_recommended: boolean | null
        }>("id,category_key,origin,is_active,lifecycle_status,is_chaarlie_recommended")
        .in("id", ids)
      if (error) throw new Error(`product_disposition_product_preflight_failed:${error.message}`)
      return data ?? []
    },
    async listDispositions(ids) {
      const { data, error } = await client
        .from("personal_plan_product_search_dispositions")
        .select<{
          product_id: string
          disposition: string
          reason_code: string
          source_batch: string
          source_fingerprint: string
          reason: string
          sources: unknown
        }>("product_id,disposition,reason_code,source_batch,source_fingerprint,reason,sources")
        .in("product_id", ids)
      if (error) throw new Error(`product_disposition_existing_preflight_failed:${error.message}`)
      return data ?? []
    },
  }
}

export async function runPersonalPlanProductDispositionCommand(
  argv = process.argv.slice(2),
  client = createSupabaseClientFromEnv() as unknown as Client,
) {
  const args = parseArgs(argv)
  const file = flag(args, "file")
  if (!file) throw new Error("product_disposition_requires_--file")
  const built = buildPersonalPlanProductDispositionManifest(
    JSON.parse(await readFile(file, "utf8")),
  )
  const preflight = await preflightPersonalPlanProductDispositionManifest(
    built,
    createPersonalPlanProductDispositionRead(client),
  )
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")
  const reviewedHead = flag(args, "reviewed-head")
  const expectedFingerprint = flag(args, "expected-fingerprint")
  if (!apply) return { ...preflight, applied: false }
  if (built.manifest.review.state !== "approved_by_nick") {
    throw new Error("product_disposition_apply_requires_approved_by_nick_manifest")
  }
  if (
    !confirm ||
    !reviewedHead ||
    !/^[a-f0-9]{40}$/.test(reviewedHead) ||
    expectedFingerprint !== built.fingerprint
  ) {
    throw new Error(
      "product_disposition_apply_requires_--confirm_--reviewed-head_and_matching_--expected-fingerprint",
    )
  }
  if (!preflight.ok) {
    throw new Error(`product_disposition_preflight_blocked:${preflight.blockers.join(",")}`)
  }
  const [{ stdout: currentHead }, { stdout: status }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"]),
    execFileAsync("git", ["status", "--porcelain"]),
  ])
  if (currentHead.trim() !== reviewedHead)
    throw new Error("product_disposition_reviewed_head_is_not_current_head")
  if (status.trim() !== "") throw new Error("product_disposition_apply_requires_clean_worktree")
  const { data, error } = await client.rpc("apply_personal_plan_product_search_dispositions_v1", {
    p_manifest_json: built.canonicalJson,
    p_expected_manifest_fingerprint: built.fingerprint,
    p_reviewed_by: "nick",
  })
  if (error) throw new Error(`product_disposition_apply_failed:${error.message}`)
  return { ...preflight, applied: true, result: data ?? [] }
}

if (require.main === module) {
  runPersonalPlanProductDispositionCommand()
    .then(printJson)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
}
