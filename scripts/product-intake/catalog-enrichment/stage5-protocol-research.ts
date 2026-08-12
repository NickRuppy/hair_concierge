import { readFile, readdir, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { resolve } from "node:path"

import { z } from "zod"

import {
  applicationGuidanceProtocolSchema,
  personalPlanCategorySchema,
} from "../../../src/lib/routines/personal-plan/application/contracts"
import {
  auditStage5CuratedCohort,
  type Stage5CuratedCohortProduct,
} from "@/lib/product-intake/catalog-enrichment/stage5-protocols"
import { stage5ProtocolClientAdapters } from "./stage5-protocol-client"

const sourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
    text: z.string().trim().min(1),
    source_type: z.enum(["manufacturer", "retailer", "professional_authority"]),
    checked_at: z.string().date(),
  })
  .strict()

export const protocolResearchProductSchema = z
  .object({
    product_id: z.string().uuid().nullable(),
    product_name: z.string().min(1),
    role: z.string().min(1),
    research_status: z.enum([
      "verified",
      "blocked_missing_direction",
      "blocked_identity_or_commercial",
    ]),
    sources: z.array(sourceSchema),
    cadence: z.record(z.string(), z.unknown()).nullable(),
    guidance_payload: z.unknown().nullable(),
    blockers: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.research_status === "verified") {
      if (!value.product_id) {
        context.addIssue({
          code: "custom",
          path: ["product_id"],
          message: "Verified product needs an ID",
        })
      }
      if (value.sources.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["sources"],
          message: "Verified product needs evidence",
        })
      }
      if (value.blockers.length > 0) {
        context.addIssue({
          code: "custom",
          path: ["blockers"],
          message: "Verified product cannot retain blockers",
        })
      }
    } else {
      if (value.guidance_payload !== null) {
        context.addIssue({
          code: "custom",
          path: ["guidance_payload"],
          message: "Blocked products cannot carry executable guidance",
        })
      }
      if (value.blockers.length === 0) {
        context.addIssue({
          code: "custom",
          path: ["blockers"],
          message: "Blocked product needs a reason",
        })
      }
    }
  })

export const protocolResearchManifestSchema = z
  .object({
    schema_version: z.literal("personal-plan-stage5-protocol-research-v1"),
    batch_id: z.string().min(1),
    category_key: personalPlanCategorySchema,
    products: z.array(protocolResearchProductSchema).min(1),
  })
  .strict()

export type ProtocolResearchManifest = z.infer<typeof protocolResearchManifestSchema>

const quantifiedContactTimePattern =
  /\b(?:ca\.?\s*|etwa\s*|mindestens\s*|bis\s+zu\s*)?\d+(?:\s*[–-]\s*\d+)?\s*(?:sekunden?|minuten?)\b/i

export function validateProtocolResearchManifest(input: unknown): ProtocolResearchManifest {
  const manifest = protocolResearchManifestSchema.parse(input)
  const seen = new Set<string>()
  for (const product of manifest.products) {
    const identity = `${product.product_id ?? product.product_name}:${product.role}`
    if (seen.has(identity)) throw new Error(`duplicate_protocol_research_identity:${identity}`)
    seen.add(identity)
    if (product.research_status !== "verified") continue
    const guidance = applicationGuidanceProtocolSchema.parse(product.guidance_payload)
    if (
      guidance.scope.kind !== "product" ||
      guidance.scope.productId !== product.product_id ||
      guidance.scope.category !== manifest.category_key
    ) {
      throw new Error(`protocol_research_scope_mismatch:${identity}`)
    }
    const evidence = new Set(guidance.evidence.map(({ sourceUrl }) => sourceUrl))
    if (product.sources.some(({ url }) => !evidence.has(url))) {
      throw new Error(`protocol_research_evidence_mismatch:${identity}`)
    }
    if (manifest.category_key === "mask") {
      const hasQuantifiedWait = guidance.steps.some(
        ({ action, copyTemplateDe }) =>
          action === "wait" && quantifiedContactTimePattern.test(copyTemplateDe),
      )
      if (guidance.protocolFacts.contactTimeSeconds === null && !hasQuantifiedWait) {
        throw new Error(`mask_protocol_missing_contact_time:${identity}`)
      }
    }
  }
  return manifest
}

export async function loadProtocolResearchManifests(directory: string) {
  const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort()
  const manifests: ProtocolResearchManifest[] = []
  const seen = new Map<string, string>()
  for (const file of files) {
    const parsed = JSON.parse(await readFile(resolve(directory, file), "utf8")) as unknown
    const manifest = validateProtocolResearchManifest(parsed)
    for (const product of manifest.products) {
      const identity = `${product.product_id ?? product.product_name}:${product.role}`
      const prior = seen.get(identity)
      if (prior)
        throw new Error(`duplicate_protocol_research_identity:${identity}:${prior}:${file}`)
      seen.set(identity, file)
    }
    manifests.push(manifest)
  }
  return manifests
}

export async function loadProtocolResearchManifestFile(file: string) {
  return validateProtocolResearchManifest(JSON.parse(await readFile(file, "utf8")) as unknown)
}

export type Stage5CuratedCohortAuditRead = {
  listCuratedProducts: () => Promise<Stage5CuratedCohortProduct[]>
  listProtocols: (productIds: string[]) => Promise<
    Array<{
      product_id: string
      category: string
      role: string
      cadence: unknown
      source_url: string | null
      guidance_payload: unknown
    }>
  >
}

/**
 * The caller owns its read-only client. This function deliberately has no
 * environment, write, LLM, or network dependency of its own.
 */
export async function auditFrozenStage5CuratedCohort(
  frozen: unknown,
  read: Stage5CuratedCohortAuditRead,
) {
  const products = await read.listCuratedProducts()
  const protocols = await read.listProtocols(products.map(({ product_id }) => product_id))
  return auditStage5CuratedCohort(
    frozen as Parameters<typeof auditStage5CuratedCohort>[0],
    products,
    protocols,
  )
}

export async function auditLiveStage5CuratedCohort(
  frozen: unknown,
  read: Stage5CuratedCohortAuditRead,
) {
  const result = await auditFrozenStage5CuratedCohort(frozen, read)
  const blockers = [...result.blockers]
  if (result.liveProductCount !== result.frozenProductCount) {
    blockers.push(`cohort_count_mismatch:${result.liveProductCount}:${result.frozenProductCount}`)
  }
  return { ...result, ok: blockers.length === 0, blockers: blockers.sort() }
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (!value || typeof value !== "object") return JSON.stringify(value)
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`
}

export async function freezeStage5CuratedCohort(
  outputPath: string,
  read: Pick<Stage5CuratedCohortAuditRead, "listCuratedProducts">,
) {
  const products = await read.listCuratedProducts()
  if (products.length !== 243) throw new Error(`cohort_count_mismatch:${products.length}:243`)
  const cohort = {
    schema_version: "personal-plan-stage5-curated-cohort-v2",
    selection: { origin: "curated", is_active: true, lifecycle_status: "active" },
    products: products
      .map((product) => ({
        product_id: product.product_id,
        brand: product.brand,
        name: product.name,
        expected_current_category: product.category_repair
          ? product.category_repair.expected_current_category
          : product.category_key,
        target_category: product.category_repair?.target_category ?? product.category_key,
        required_roles: [...product.required_roles].sort(),
        authority_fact_blockers: [...product.authority_fact_blockers].sort(),
      }))
      .sort((left, right) => left.product_id.localeCompare(right.product_id)),
  }
  const canonical = stableJson(cohort)
  const artifact = { ...cohort, fingerprint: createHash("sha256").update(canonical).digest("hex") }
  await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8")
  return artifact
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
    if (process.argv.includes("--live-audit")) {
      const snapshotIndex = process.argv.indexOf("--snapshot")
      const snapshotPath =
        snapshotIndex >= 0
          ? process.argv[snapshotIndex + 1]
          : "data/catalog-enrichment/personal-plan-stage5-v1/curated-cohort-2026-08-11.json"
      if (!snapshotPath) throw new Error("--snapshot requires a reviewed frozen cohort file")
      const frozen = JSON.parse(
        await readFile(resolve(process.cwd(), snapshotPath), "utf8"),
      ) as unknown
      const result = await auditLiveStage5CuratedCohort(
        frozen,
        stage5ProtocolClientAdapters().audit,
      ).catch((error: unknown) => ({
        mode: "audit" as const,
        writes: false,
        ok: false,
        blockers: [error instanceof Error ? error.message : "stage5_live_audit_failed"],
        coverage: {},
        worklist: [],
        researchBatches: [],
      }))
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      process.exitCode = result.ok ? 0 : 1
      return
    }
    const freezeOutput = process.argv.indexOf("--freeze-output")
    if (freezeOutput >= 0) {
      const outputPath = process.argv[freezeOutput + 1]
      if (!outputPath) throw new Error("--freeze-output requires a local output path")
      const artifact = await freezeStage5CuratedCohort(
        resolve(process.cwd(), outputPath),
        stage5ProtocolClientAdapters().audit,
      )
      process.stdout.write(
        `${JSON.stringify({ mode: "freeze", writes: [outputPath], fingerprint: artifact.fingerprint, productCount: artifact.products.length }, null, 2)}\n`,
      )
      return
    }
    const auditInput = process.argv.indexOf("--audit-input")
    if (auditInput >= 0) {
      const fixturePath = process.argv[auditInput + 1]
      if (!fixturePath) throw new Error("--audit-input requires a sanitized read-only fixture")
      const fixture = JSON.parse(await readFile(resolve(process.cwd(), fixturePath), "utf8")) as {
        frozen: unknown
        products: Stage5CuratedCohortProduct[]
        protocols: Awaited<ReturnType<Stage5CuratedCohortAuditRead["listProtocols"]>>
      }
      const result = await auditFrozenStage5CuratedCohort(fixture.frozen, {
        listCuratedProducts: async () => fixture.products,
        listProtocols: async () => fixture.protocols,
      })
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
      process.exitCode = result.ok ? 0 : 1
      return
    }
    const directory = resolve(
      process.cwd(),
      process.argv[2] ?? "data/catalog-enrichment/personal-plan-stage5-v1/protocol-research",
    )
    const manifests = await loadProtocolResearchManifests(directory)
    const totals = manifests.reduce(
      (result, manifest) => {
        for (const product of manifest.products) result[product.research_status] += 1
        return result
      },
      {
        verified: 0,
        blocked_missing_direction: 0,
        blocked_identity_or_commercial: 0,
      },
    )
    process.stdout.write(`${JSON.stringify({ manifests: manifests.length, ...totals })}\n`)
  })()
}
