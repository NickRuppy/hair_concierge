import { createHash } from "node:crypto"
import { z } from "zod"

import {
  applicationFamilyTemplateV2Schema,
  productApplicationPointerV2Schema,
} from "@/lib/routines/personal-plan/application/contracts-v2"

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function stage5V2SourceFingerprint(role: string, payload: unknown): string {
  return createHash("sha256").update(canonicalJson({ role, payload })).digest("hex")
}

const artifactItemSchema = z
  .object({
    key: z.string().min(1),
    product_id: z.string().uuid(),
    product_name: z.string().min(1),
    source_role: z.string().min(1),
    source_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    template_keys: z.array(z.string().min(1)),
    exact_workflow_id: z.string().nullable(),
    before_visible_step_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    after_visible_step_fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    guidance_payload_v2: productApplicationPointerV2Schema,
  })
  .strict()

export const stage5V2ApplicationArtifactSchema = z
  .object({
    schema_version: z.literal("personal-plan-stage5-application-pointer-backfill-v2"),
    snapshot_date: z.string().date(),
    source_kind: z.literal("reviewed_stage5_v1_artifacts"),
    source_files: z.array(
      z.object({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
    ),
    observed_counts: z
      .object({
        rows: z.number().int().positive(),
        products: z.number().int().positive(),
        exact_workflows: z.number().int().nonnegative(),
        family_templates: z.number().int().positive(),
        composable_rows: z.number().int().nonnegative(),
        blocked_rows: z.number().int().nonnegative(),
        by_category: z.record(z.string(), z.number().int().nonnegative()),
      })
      .strict(),
    family_templates: z.array(applicationFamilyTemplateV2Schema),
    items: z.array(artifactItemSchema),
  })
  .strict()

export type Stage5V2ApplicationArtifact = z.infer<typeof stage5V2ApplicationArtifactSchema>

export type Stage5V2ApplicationPreflightRead = {
  listProducts(productIds: string[]): Promise<
    Array<{
      id: string
      category_key: string | null
      origin?: string | null
      is_active: boolean
      lifecycle_status: string
    }>
  >
  listProtocols(productIds: string[]): Promise<
    Array<{
      product_id: string
      category: string
      role: string
      guidance_payload: unknown
    }>
  >
}

export async function preflightStage5V2ApplicationArtifact(
  input: unknown,
  read: Stage5V2ApplicationPreflightRead,
) {
  const artifact = stage5V2ApplicationArtifactSchema.parse(input)
  const blockers: string[] = []
  const productIds = [...new Set(artifact.items.map((item) => item.product_id))].sort()
  const [products, protocols] = await Promise.all([
    read.listProducts(productIds),
    read.listProtocols(productIds),
  ])
  const productById = new Map(products.map((product) => [product.id, product]))
  const protocolByKey = new Map(
    protocols.map((protocol) => [
      `${protocol.product_id}:${protocol.category}:${protocol.role}`,
      protocol,
    ]),
  )
  const itemKeys = artifact.items.map((item) => item.key)
  if (new Set(itemKeys).size !== itemKeys.length) blockers.push("duplicate_artifact_key")
  if (artifact.observed_counts.rows !== artifact.items.length)
    blockers.push("observed_row_count_mismatch")
  if (artifact.observed_counts.products !== productIds.length)
    blockers.push("observed_product_count_mismatch")
  if (artifact.observed_counts.family_templates !== artifact.family_templates.length)
    blockers.push("observed_template_count_mismatch")

  for (const item of artifact.items) {
    const pointer = item.guidance_payload_v2
    const product = productById.get(item.product_id)
    if (
      !product ||
      product.category_key !== pointer.scope.category ||
      product.origin !== "curated" ||
      !product.is_active ||
      product.lifecycle_status !== "active"
    ) {
      blockers.push(`product_state_diverged:${item.key}`)
      continue
    }
    const protocol = protocolByKey.get(
      `${item.product_id}:${pointer.scope.category}:${item.source_role}`,
    )
    if (!protocol) {
      blockers.push(`source_protocol_missing:${item.key}`)
      continue
    }
    if (
      stage5V2SourceFingerprint(item.source_role, protocol.guidance_payload) !==
      item.source_fingerprint
    ) {
      blockers.push(`source_protocol_diverged:${item.key}`)
    }
  }

  return {
    ok: blockers.length === 0,
    blockers,
    observed: {
      rows: artifact.items.length,
      products: productIds.length,
      familyTemplates: artifact.family_templates.length,
      exactWorkflows: artifact.items.filter((item) => item.exact_workflow_id !== null).length,
      explicitRuntimeBlockers: artifact.items.filter(
        (item) => item.guidance_payload_v2.runtimeBlockerCode !== null,
      ).length,
    },
  }
}
