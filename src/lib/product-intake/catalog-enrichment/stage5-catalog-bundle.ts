import { createHash } from "node:crypto"

import { z } from "zod"

import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"

const sourceSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
    text: z.string().min(1),
    sourceType: z.enum(["manufacturer", "retailer", "professional_authority"]),
    checkedAt: z.string().date(),
  })
  .strict()

const maskFactsSchema = z
  .object({
    repair_support_level: z.enum(["low", "medium", "high"]),
    functional_benefits: z
      .array(z.enum(["smoothing_frizz_control", "detangling_slip", "shine"]))
      .min(1),
  })
  .strict()
const leaveInFactsSchema = z
  .object({
    care_direction: z.enum(["moisture", "balanced", "protein"]),
    repair_support_level: z.enum(["low", "medium", "high"]),
    plan_roles: z.array(z.enum(["post_wash_leave_in", "pre_heat_application"])).min(1),
    functional_benefits: z
      .array(
        z.enum([
          "detangle",
          "moisture_softness",
          "smooth_anti_frizz",
          "heat_protect",
          "repair_support",
          "curl_shape_support",
          "shine_support",
        ]),
      )
      .min(1),
  })
  .strict()
const oilFactsSchema = z
  .object({
    weight: z.enum(["light", "medium", "rich"]),
    role_support: z
      .array(
        z.enum([
          "pre_wash_fibre_treatment",
          "leave_on_fibre_conditioning",
          "dry_finish",
          "pre_heat_protection",
        ]),
      )
      .min(1),
  })
  .strict()

const protocolSchema = z
  .object({
    role: z.string().min(1),
    cadence: z.record(z.string(), z.unknown()).nullable(),
    guidance_payload: applicationGuidanceProtocolSchema,
    source: sourceSchema,
  })
  .strict()

export const exactCatalogBundleSchema = z
  .object({
    schema_version: z.literal("personal-plan-exact-catalog-bundle-v1"),
    batch_id: z.string().regex(/^S5-[0-9]{2}-[a-z0-9-]+$/),
    items: z
      .array(
        z
          .object({
            product_id: z.string().uuid(),
            product_name: z.string().min(1),
            expected_current_category: z.string().nullable(),
            target_category: z.enum(["mask", "leave_in", "oil", "deep_cleansing_shampoo"]),
            facts: z.discriminatedUnion("category", [
              z
                .object({
                  category: z.literal("mask"),
                  values: maskFactsSchema,
                  sources: z.array(sourceSchema).min(1),
                })
                .strict(),
              z
                .object({
                  category: z.literal("leave_in"),
                  values: leaveInFactsSchema,
                  sources: z.array(sourceSchema).min(1),
                })
                .strict(),
              z
                .object({
                  category: z.literal("oil"),
                  values: oilFactsSchema,
                  sources: z.array(sourceSchema).min(1),
                })
                .strict(),
              z
                .object({
                  category: z.literal("deep_cleansing_shampoo"),
                  values: z.object({}).strict(),
                  sources: z.array(sourceSchema).min(1),
                })
                .strict(),
            ]),
            protocols: z.array(protocolSchema).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((bundle, context) => {
    const ids = new Set<string>()
    for (const [index, item] of bundle.items.entries()) {
      if (ids.has(item.product_id))
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "product_id"],
          message: "A product may occur only once",
        })
      ids.add(item.product_id)
      if (item.facts.category !== item.target_category)
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index, "facts", "category"],
          message: "Facts must match target category",
        })
      if (
        item.expected_current_category === null &&
        item.target_category !== "deep_cleansing_shampoo"
      )
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", index],
          message: "Only the approved Deep Cleansing repair may start with a NULL category",
        })
      const roles = new Set<string>()
      for (const protocol of item.protocols) {
        if (roles.has(protocol.role))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items", index, "protocols"],
            message: "Duplicate product role",
          })
        roles.add(protocol.role)
        const guidance = protocol.guidance_payload
        if (
          guidance.scope.kind !== "product" ||
          guidance.scope.productId !== item.product_id ||
          guidance.scope.category !== item.target_category
        )
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items", index, "protocols"],
            message: "Protocol must be canonical and scoped to this exact product/category",
          })
        if (!guidance.evidence.some(({ sourceUrl }) => sourceUrl === protocol.source.url))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items", index, "protocols"],
            message: "Protocol source must occur in canonical evidence",
          })
      }
      const required =
        item.facts.category === "mask"
          ? ["intensive_conditioning_mask"]
          : item.facts.category === "leave_in"
            ? item.facts.values.plan_roles.map((role) =>
                role === "post_wash_leave_in" ? "post_wash_leave_in" : "pre_heat_protection",
              )
            : item.facts.category === "oil"
              ? item.facts.values.role_support
              : []
      for (const role of required)
        if (!roles.has(role))
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["items", index, "protocols"],
            message: `Bundle is missing required exact protocol: ${role}`,
          })
    }
  })

export type ExactCatalogBundle = z.infer<typeof exactCatalogBundleSchema>
export type BuiltExactCatalogBundle = {
  bundle: ExactCatalogBundle
  canonicalJson: string
  fingerprint: string
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, stable(entry)]),
  )
}
function sortStrings(values: string[]) {
  return [...new Set(values)].sort()
}

/** Canonical serialization makes an approved retry byte-for-byte identical. */
export function buildExactCatalogBundle(input: unknown): BuiltExactCatalogBundle {
  const parsed = exactCatalogBundleSchema.parse(input)
  const normalized = {
    ...parsed,
    items: [...parsed.items]
      .sort((a, b) => a.product_id.localeCompare(b.product_id))
      .map((item) => ({
        ...item,
        facts:
          item.facts.category === "mask"
            ? {
                ...item.facts,
                values: {
                  ...item.facts.values,
                  functional_benefits: sortStrings(item.facts.values.functional_benefits),
                },
              }
            : item.facts.category === "leave_in"
              ? {
                  ...item.facts,
                  values: {
                    ...item.facts.values,
                    plan_roles: sortStrings(item.facts.values.plan_roles),
                    functional_benefits: sortStrings(item.facts.values.functional_benefits),
                  },
                }
              : item.facts.category === "oil"
                ? {
                    ...item.facts,
                    values: {
                      ...item.facts.values,
                      role_support: sortStrings(item.facts.values.role_support),
                    },
                  }
                : item.facts,
        protocols: [...item.protocols].sort((a, b) => a.role.localeCompare(b.role)),
      })),
  }
  const bundle = exactCatalogBundleSchema.parse(normalized)
  const canonicalJson = JSON.stringify(stable(bundle))
  return {
    bundle,
    canonicalJson,
    fingerprint: createHash("sha256").update(canonicalJson).digest("hex"),
  }
}

export type ExactCatalogBundleRead = {
  listProducts(ids: string[]): Promise<
    Array<{
      id: string
      category_key: string | null
      origin: string | null
      is_active: boolean
      lifecycle_status: string
    }>
  >
  listProtocols(ids: string[]): Promise<
    Array<{
      product_id: string
      category: string
      role: string
      cadence: unknown
      source_label: string | null
      source_url: string | null
      source_text: string | null
      guidance_payload: unknown
    }>
  >
}

function stableJson(value: unknown) {
  return JSON.stringify(stable(value))
}

type ExactCatalogProtocol = ExactCatalogBundle["items"][number]["protocols"][number]
type PersistedProtocol = Awaited<ReturnType<ExactCatalogBundleRead["listProtocols"]>>[number]

function isLegacyMaskSourceTextUpgrade(
  productId: string,
  targetCategory: ExactCatalogBundle["items"][number]["target_category"],
  existing: PersistedProtocol,
  incoming: ExactCatalogProtocol,
) {
  const immutableFieldsMatch =
    existing.product_id === productId &&
    existing.category === targetCategory &&
    existing.role === incoming.role &&
    stableJson(existing.cadence) === stableJson(incoming.cadence) &&
    existing.source_label === incoming.source.label &&
    existing.source_url === incoming.source.url &&
    stableJson(existing.guidance_payload) === stableJson(incoming.guidance_payload)
  const legacySourceText = incoming.guidance_payload.steps
    .map(({ copyTemplateDe }) => copyTemplateDe)
    .join(" ")
  const incomingSourceIsEvidence = incoming.guidance_payload.evidence.some(
    ({ sourceUrl }) => sourceUrl === incoming.source.url,
  )

  return (
    targetCategory === "mask" &&
    immutableFieldsMatch &&
    existing.source_text === legacySourceText &&
    incoming.source.text.trim().length > 0 &&
    incomingSourceIsEvidence
  )
}

export async function preflightExactCatalogBundle(
  built: BuiltExactCatalogBundle,
  read: ExactCatalogBundleRead,
) {
  const ids = built.bundle.items.map(({ product_id }) => product_id)
  const [products, protocols] = await Promise.all([read.listProducts(ids), read.listProtocols(ids)])
  const byId = new Map(products.map((product) => [product.id, product]))
  const blockers: string[] = []
  for (const item of built.bundle.items) {
    const product = byId.get(item.product_id)
    if (!product) {
      blockers.push(`product_missing:${item.product_id}`)
      continue
    }
    if (product.origin !== "curated") blockers.push(`origin_not_curated:${item.product_id}`)
    if (!product.is_active || product.lifecycle_status !== "active")
      blockers.push(`product_not_active:${item.product_id}`)
    if (product.category_key !== item.expected_current_category)
      blockers.push(`current_category_conflict:${item.product_id}`)
    for (const protocol of item.protocols) {
      const existing = protocols.find(
        (row) =>
          row.product_id === item.product_id &&
          row.category === item.target_category &&
          row.role === protocol.role,
      )
      if (
        existing &&
        (stableJson(existing.cadence) !== stableJson(protocol.cadence) ||
          existing.source_label !== protocol.source.label ||
          existing.source_url !== protocol.source.url ||
          existing.source_text !== protocol.source.text ||
          stableJson(existing.guidance_payload) !== stableJson(protocol.guidance_payload)) &&
        !isLegacyMaskSourceTextUpgrade(item.product_id, item.target_category, existing, protocol)
      )
        blockers.push(`protocol_conflict:${item.product_id}:${protocol.role}`)
    }
  }
  return {
    ok: blockers.length === 0,
    writes: false as const,
    batchId: built.bundle.batch_id,
    fingerprint: built.fingerprint,
    blockers: [...new Set(blockers)].sort(),
  }
}
