import {
  applicationGuidanceProtocolSchema,
  type ApplicationFamily,
  type ApplicationGuidanceProtocolV1,
} from "./contracts"

export type ReviewedProductApplicationProtocolRow = {
  product_id: string
  category: string
  role: string
  guidance_payload?: unknown
  application_state: string | null
  reapplication: string | null
  source_url: string | null
  source_text: string | null
  updated_at: string
}

export function adaptReviewedProductApplicationProtocols(
  rows: readonly ReviewedProductApplicationProtocolRow[],
): ApplicationGuidanceProtocolV1[] {
  const protocols: ApplicationGuidanceProtocolV1[] = []
  for (const row of rows) {
    const canonical = applicationGuidanceProtocolSchema.safeParse(row.guidance_payload)
    if (canonical.success) {
      const payload = canonical.data
      if (
        payload.scope.kind === "product" &&
        payload.scope.productId === row.product_id &&
        payload.scope.category === row.category
      ) {
        protocols.push(payload)
      }
      continue
    }
    if (
      !["heat_protectant", "leave_in", "oil"].includes(row.category) ||
      row.role !== "pre_heat_protection" ||
      !["damp", "dry", "either"].includes(row.application_state ?? "") ||
      !["required", "optional", "not_stated"].includes(row.reapplication ?? "") ||
      !row.source_url ||
      !row.source_text?.trim()
    ) {
      continue
    }
    try {
      new URL(row.source_url)
    } catch {
      continue
    }
    const checkedAt = row.updated_at.slice(0, 10)
    const variants: Array<{
      family: ApplicationFamily
      anchor: "damp_leave_on" | "dry_pre_heat"
    }> = []
    if (row.application_state === "damp" || row.application_state === "either") {
      variants.push({ family: "damp_hair_protection", anchor: "damp_leave_on" })
    }
    if (row.application_state === "dry" || row.application_state === "either") {
      variants.push({ family: "dry_hair_protection", anchor: "dry_pre_heat" })
    }
    for (const variant of variants) {
      const parsed = applicationGuidanceProtocolSchema.safeParse({
        schemaVersion: 1,
        guidanceKey: `product-heat-${row.product_id}-${variant.family}`,
        protocolVersion: 1,
        locale: "de",
        scope: {
          kind: "product",
          category: row.category,
          productId: row.product_id,
        },
        role: "heat_protection",
        applicationFamily: variant.family,
        compatibleDayTypes: [
          "wash_day",
          "intensive_care_day",
          "bond_repair_day",
          "clarifying_wash_day",
          "refresh_day",
          "between_wash_care_day",
          "styling_day",
        ],
        exactGuidanceRequired: true,
        sequence: { anchor: variant.anchor, before: [], after: [], conflictsWith: [] },
        requirements: {
          requiredCatalogFacts: ["applicationState", "reapplication", "formatResolution"],
          requiredProtocolFacts: [],
          requiredProfileFacts: ["heatEvents"],
        },
        protocolFacts: {
          applicationArea: "all_hair",
          rinse: "leave_in",
          contactTimeSeconds: null,
          conditionerRelationship: "not_applicable",
          reapplication: row.reapplication === "required" ? "each_separate_heat_event" : "none",
          amount: null,
          cautions: [],
        },
        steps: [
          {
            stepKey: `apply-${variant.family}`,
            action: "apply_product",
            copyTemplateDe: row.source_text.trim(),
          },
        ],
        evidence: [{ sourceUrl: row.source_url, sourceType: "manufacturer", checkedAt }],
      })
      if (parsed.success) protocols.push(parsed.data)
    }
  }
  return protocols.sort((left, right) => left.guidanceKey.localeCompare(right.guidanceKey))
}
