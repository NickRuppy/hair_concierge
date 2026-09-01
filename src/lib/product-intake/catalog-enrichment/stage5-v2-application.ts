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
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}

export function stage5V2SourceFingerprint(role: string, payload: unknown): string {
  return createHash("sha256").update(canonicalJson({ role, payload })).digest("hex")
}

export function stage5V2ArtifactFingerprint(artifactText: string): string {
  return createHash("sha256").update(artifactText, "utf8").digest("hex")
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/
const GIT_SHA_PATTERN = /^[a-f0-9]{40}$/
const EXPECTED_PROJECT_ID = "pqdkhefxsxkyeqelqegq"

export type Stage5V2ApplicationApplyArgs =
  | { apply: false }
  | { apply: true; reviewedHead: string; expectedFingerprint: string }

export function parseStage5V2ApplicationApplyArgs(
  args: readonly string[],
): Stage5V2ApplicationApplyArgs {
  const supported = new Set(["--apply", `--confirm-project=${EXPECTED_PROJECT_ID}`])
  const valued = ["--reviewed-head=", "--expected-fingerprint="]
  for (const argument of args) {
    if (!supported.has(argument) && !valued.some((prefix) => argument.startsWith(prefix))) {
      throw new Error(`unknown_argument:${argument}`)
    }
  }
  if (!args.includes("--apply")) return { apply: false }
  if (!args.includes(`--confirm-project=${EXPECTED_PROJECT_ID}`)) {
    throw new Error(`confirm-project=${EXPECTED_PROJECT_ID} is required`)
  }
  const reviewedHead = args
    .find((argument) => argument.startsWith("--reviewed-head="))
    ?.slice("--reviewed-head=".length)
  const expectedFingerprint = args
    .find((argument) => argument.startsWith("--expected-fingerprint="))
    ?.slice("--expected-fingerprint=".length)
  if (!reviewedHead || !GIT_SHA_PATTERN.test(reviewedHead)) {
    throw new Error("valid_reviewed_head_is_required")
  }
  if (!expectedFingerprint || !SHA256_PATTERN.test(expectedFingerprint)) {
    throw new Error("valid_expected_fingerprint_is_required")
  }
  return { apply: true, reviewedHead, expectedFingerprint }
}

export function isStage5V2ProductionWriteAuthorized(
  environment: Record<string, string | undefined>,
) {
  let projectId: string | null = null
  try {
    projectId = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? null
  } catch {
    projectId = null
  }
  return (
    environment.ALLOW_PERSONAL_PLAN_STAGE5_V2_PRODUCTION_WRITE === "1" &&
    projectId === EXPECTED_PROJECT_ID
  )
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
    source_kind: z.enum([
      "reviewed_stage5_v1_artifacts",
      "reviewed_stage5_v1_and_use_case_artifacts",
      "reviewed_stage5_v1_use_case_and_amendment_artifacts",
    ]),
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
      application_family?: string
      guidance_payload: unknown
    }>
  >
  listActiveCuratedProtocols?(): Promise<
    Array<{
      product_id: string
      category: string
      role: string
      application_family?: string
      guidance_payload: unknown
    }>
  >
}

function protocolFamily(protocol: {
  application_family?: string | null
  guidance_payload?: unknown
  guidance_payload_v2?: unknown
}): string | null {
  if (protocol.application_family) return protocol.application_family
  const v2 = protocol.guidance_payload_v2 as { applicationFamily?: unknown } | null
  if (typeof v2?.applicationFamily === "string") return v2.applicationFamily
  const v1 = protocol.guidance_payload as { applicationFamily?: unknown } | null
  return typeof v1?.applicationFamily === "string" ? v1.applicationFamily : null
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
  const protocolByKey = new Map<string, (typeof protocols)[number]>(
    protocols.flatMap((protocol) => {
      const family = protocolFamily(protocol)
      return family
        ? [
            [
              `${protocol.product_id}:${protocol.category}:${protocol.role}:${family}`,
              protocol,
            ] as const,
          ]
        : []
    }),
  )
  const itemKeys = artifact.items.map((item) => item.key)
  if (new Set(itemKeys).size !== itemKeys.length) blockers.push("duplicate_artifact_key")
  if (artifact.observed_counts.rows !== artifact.items.length)
    blockers.push("observed_row_count_mismatch")
  if (artifact.observed_counts.products !== productIds.length)
    blockers.push("observed_product_count_mismatch")
  if (artifact.observed_counts.family_templates !== artifact.family_templates.length)
    blockers.push("observed_template_count_mismatch")
  if (
    artifact.observed_counts.exact_workflows !==
    artifact.items.filter((item) => item.exact_workflow_id !== null).length
  )
    blockers.push("observed_exact_workflow_count_mismatch")
  if (
    artifact.observed_counts.composable_rows !==
    artifact.items.filter((item) => item.guidance_payload_v2.runtimeBlockerCode === null).length
  )
    blockers.push("observed_composable_count_mismatch")
  if (
    artifact.observed_counts.blocked_rows !==
    artifact.items.filter((item) => item.guidance_payload_v2.runtimeBlockerCode !== null).length
  )
    blockers.push("observed_blocked_count_mismatch")
  const byCategory = Object.fromEntries(
    [...new Set(artifact.items.map((item) => item.guidance_payload_v2.scope.category))]
      .sort()
      .map((category) => [
        category,
        artifact.items.filter((item) => item.guidance_payload_v2.scope.category === category)
          .length,
      ]),
  )
  if (canonicalJson(artifact.observed_counts.by_category) !== canonicalJson(byCategory))
    blockers.push("observed_category_counts_mismatch")

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
    const roleKey = `${item.product_id}:${pointer.scope.category}:${item.source_role}`
    const protocol = protocolByKey.get(`${roleKey}:${pointer.applicationFamily}`)
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

  if (read.listActiveCuratedProtocols) {
    const artifactProtocolKeys = new Set(
      artifact.items.map(
        (item) =>
          `${item.product_id}:${item.guidance_payload_v2.scope.category}:${item.source_role}:${item.guidance_payload_v2.applicationFamily}`,
      ),
    )
    const activeProtocols = await read.listActiveCuratedProtocols()
    for (const protocol of activeProtocols) {
      if (
        protocol.guidance_payload !== null &&
        !artifactProtocolKeys.has(
          `${protocol.product_id}:${protocol.category}:${protocol.role}:${protocolFamily(protocol) ?? "unknown"}`,
        )
      ) {
        blockers.push(
          `active_protocol_missing_from_artifact:${protocol.product_id}:${protocol.role}:${protocolFamily(protocol) ?? "unknown"}`,
        )
      }
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

export type Stage5V2ApplicationAppliedRead = {
  listV2Families(
    guidanceKeys: string[],
  ): Promise<
    Array<{ guidance_key: string; contract_version: number; payload: unknown; status: string }>
  >
  listV2Protocols(productIds: string[]): Promise<
    Array<{
      product_id: string
      category: string
      role: string
      application_family?: string | null
      guidance_payload_v2: unknown
    }>
  >
}

export async function verifyStage5V2AppliedArtifact(
  input: unknown,
  read: Stage5V2ApplicationAppliedRead,
) {
  const artifact = stage5V2ApplicationArtifactSchema.parse(input)
  const guidanceKeys = artifact.family_templates.map((template) => template.guidanceKey).sort()
  const productIds = [...new Set(artifact.items.map((item) => item.product_id))].sort()
  const [families, protocols] = await Promise.all([
    read.listV2Families(guidanceKeys),
    read.listV2Protocols(productIds),
  ])
  const familyByKey = new Map(families.map((family) => [family.guidance_key, family]))
  const protocolByKey = new Map<string, (typeof protocols)[number]>(
    protocols.flatMap((protocol) => {
      const family = protocolFamily(protocol)
      return family
        ? [
            [
              `${protocol.product_id}:${protocol.category}:${protocol.role}:${family}`,
              protocol,
            ] as const,
          ]
        : []
    }),
  )
  const blockers: string[] = []
  for (const template of artifact.family_templates) {
    const family = familyByKey.get(template.guidanceKey)
    if (
      !family ||
      family.contract_version !== 2 ||
      family.status !== "active" ||
      canonicalJson(family.payload) !== canonicalJson(template)
    )
      blockers.push(`v2_family_mismatch:${template.guidanceKey}`)
  }
  for (const item of artifact.items) {
    const pointer = item.guidance_payload_v2
    const protocol = protocolByKey.get(
      `${item.product_id}:${pointer.scope.category}:${item.source_role}:${pointer.applicationFamily}`,
    )
    if (!protocol || canonicalJson(protocol.guidance_payload_v2) !== canonicalJson(pointer)) {
      blockers.push(`v2_product_pointer_mismatch:${item.key}`)
    }
  }
  return {
    ok: blockers.length === 0,
    blockers,
    observed: {
      familyRows: families.length,
      productRows: protocols.filter((row) => row.guidance_payload_v2 !== null).length,
    },
  }
}
