import { readFile } from "node:fs/promises"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { createSupabaseClientFromEnv, flag, flagBool, parseArgs, printJson } from "../cli"
import {
  buildExactCatalogBundle,
  preflightExactCatalogBundle,
  type ExactCatalogBundleRead,
} from "@/lib/product-intake/catalog-enrichment/stage5-catalog-bundle"

type Query<T> = Promise<{ data: T | null; error: { message: string } | null }>
const execFileAsync = promisify(execFile)
type Client = {
  from(table: string): {
    select<T>(columns: string): { in(column: string, values: string[]): Query<T[]> }
  }
  rpc(
    name: "apply_personal_plan_exact_catalog_bundle_v1",
    args: { p_bundle_json: string; p_expected_bundle_fingerprint: string; p_reviewed_by: "nick" },
  ): Query<Record<string, unknown>[]>
}

export function createExactCatalogBundleRead(client: Client): ExactCatalogBundleRead {
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
        }>("id,category_key,origin,is_active,lifecycle_status")
        .in("id", ids)
      if (error) throw new Error(`catalog_bundle_product_preflight_failed:${error.message}`)
      return data ?? []
    },
    async listProtocols(ids) {
      const { data, error } = await client
        .from("product_application_protocols")
        .select<{
          product_id: string
          category: string
          role: string
          application_family: string | null
          cadence: unknown
          source_label: string | null
          source_url: string | null
          source_text: string | null
          guidance_payload: unknown
        }>(
          "product_id,category,role,application_family,cadence,source_label,source_url,source_text,guidance_payload",
        )
        .in("product_id", ids)
      if (error) throw new Error(`catalog_bundle_protocol_preflight_failed:${error.message}`)
      return data ?? []
    },
  }
}

export async function runExactCatalogBundleCommand(
  argv = process.argv.slice(2),
  client = createSupabaseClientFromEnv() as unknown as Client,
) {
  const args = parseArgs(argv)
  const file = flag(args, "file")
  if (!file) throw new Error("catalog_bundle_requires_--file")
  const built = buildExactCatalogBundle(JSON.parse(await readFile(file, "utf8")))
  const preflight = await preflightExactCatalogBundle(built, createExactCatalogBundleRead(client))
  const apply = flagBool(args, "apply")
  const confirm = flagBool(args, "confirm")
  const reviewedHead = flag(args, "reviewed-head")
  const expectedFingerprint = flag(args, "expected-fingerprint")
  if (!apply) return { ...preflight, applied: false }
  if (
    !confirm ||
    !reviewedHead ||
    !/^[a-f0-9]{40}$/.test(reviewedHead) ||
    expectedFingerprint !== built.fingerprint
  )
    throw new Error(
      "catalog_bundle_apply_requires_--confirm_--reviewed-head_and_matching_--expected-fingerprint",
    )
  if (!preflight.ok)
    throw new Error(`catalog_bundle_preflight_blocked:${preflight.blockers.join(",")}`)
  const [{ stdout: currentHead }, { stdout: status }] = await Promise.all([
    execFileAsync("git", ["rev-parse", "HEAD"]),
    execFileAsync("git", ["status", "--porcelain"]),
  ])
  if (currentHead.trim() !== reviewedHead)
    throw new Error("catalog_bundle_reviewed_head_is_not_current_head")
  if (status.trim() !== "") throw new Error("catalog_bundle_apply_requires_clean_worktree")
  const { data, error } = await client.rpc("apply_personal_plan_exact_catalog_bundle_v1", {
    p_bundle_json: built.canonicalJson,
    p_expected_bundle_fingerprint: built.fingerprint,
    p_reviewed_by: "nick",
  })
  if (error) throw new Error(`catalog_bundle_apply_failed:${error.message}`)
  return { ...preflight, applied: true, result: data ?? [] }
}

if (require.main === module)
  runExactCatalogBundleCommand()
    .then(printJson)
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exitCode = 1
    })
