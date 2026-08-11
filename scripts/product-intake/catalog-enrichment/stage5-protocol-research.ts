import { readFile, readdir } from "node:fs/promises"
import { resolve } from "node:path"

import { z } from "zod"

import {
  applicationGuidanceProtocolSchema,
  personalPlanCategorySchema,
} from "../../../src/lib/routines/personal-plan/application/contracts"

const sourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
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
  for (const file of files) {
    const parsed = JSON.parse(await readFile(resolve(directory, file), "utf8")) as unknown
    manifests.push(validateProtocolResearchManifest(parsed))
  }
  return manifests
}

export async function loadProtocolResearchManifestFile(file: string) {
  return validateProtocolResearchManifest(JSON.parse(await readFile(file, "utf8")) as unknown)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void (async () => {
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
