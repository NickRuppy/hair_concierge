import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "@/lib/routines/personal-plan/application/contracts-v2"
import { applicationGuidanceProtocolSchema } from "@/lib/routines/personal-plan/application/contracts"

type ReviewedUseCases = {
  products: Array<{
    product_id: string
    product_name: string
    uses: Array<{
      source_role: "post_wash_leave_in" | "pre_heat_protection"
      application_family: ProductApplicationPointerV2["applicationFamily"]
      source_url: string
      source_type: "manufacturer" | "retailer" | "professional_authority"
      checked_at: string
      maximum_claimed_temperature_c?: number | null
    }>
  }>
}

type BackfillArtifact = {
  items: Array<{
    product_id: string
    source_role: string
    guidance_payload_v2: ProductApplicationPointerV2
  }>
}

function identity(sourceRole: string, family: string) {
  return `${sourceRole}:${family}`
}

function pointerFor(productId: string, use: ReviewedUseCases["products"][number]["uses"][number]) {
  const isHeat = use.source_role === "pre_heat_protection"
  const states =
    use.application_family === "pre_heat_damp"
      ? (["damp_hair"] as const)
      : use.application_family === "pre_heat_dry"
        ? (["dry_hair"] as const)
        : (["damp_hair", "dry_hair"] as const)
  const applicationState = isHeat
    ? states.length === 2
      ? "damp_or_dry_hair"
      : states[0]
    : use.application_family === "post_wash_damp_conditioning" ||
        use.application_family === "between_wash_damp_refresh"
      ? "damp_hair"
      : "dry_hair"

  return productApplicationPointerV2Schema.parse({
    schemaVersion: 2,
    contractKind: "product_pointer",
    scope: { kind: "product", category: "leave_in", productId },
    sourceRole: use.source_role,
    role: isHeat ? "heat_protection" : "leave_in",
    applicationFamily: use.application_family,
    facts: {
      applicationState,
      applicationArea: isHeat ? "root_to_tip_hair" : "hair_lengths_ends",
      rinse: "leave_in",
      contactTime: null,
      amount: null,
      heat: isHeat
        ? {
            supportedStates: [...states],
            activationRequired: false,
            maximumClaimedTemperatureC: use.maximum_claimed_temperature_c ?? null,
            reapplication: "none",
          }
        : null,
      conditionerPolicy: "not_applicable",
    },
    workflowId: null,
    requiredCompanionProductId: null,
    runtimeBlockerCode: null,
    exactSteps: [],
    cautionCodes: [],
    evidence: [
      {
        sourceUrl: use.source_url,
        sourceType: use.source_type,
        checkedAt: use.checked_at,
      },
    ],
  })
}

function guidancePayloadV1For(
  productId: string,
  use: ReviewedUseCases["products"][number]["uses"][number],
) {
  const isHeat = use.source_role === "pre_heat_protection"
  const isDry = ["between_wash_dry_care", "post_style_finish", "pre_heat_dry"].includes(
    use.application_family,
  )
  const compatibleDayTypes =
    use.application_family === "post_wash_damp_conditioning"
      ? ["wash_day", "intensive_care_day", "bond_repair_day", "clarifying_wash_day"]
      : use.application_family === "between_wash_dry_care"
        ? ["refresh_day", "between_wash_care_day"]
        : use.application_family === "post_style_finish"
          ? ["styling_day"]
          : [
              "wash_day",
              "intensive_care_day",
              "bond_repair_day",
              "clarifying_wash_day",
              "refresh_day",
              "between_wash_care_day",
              "styling_day",
            ]
  const steps =
    use.application_family === "post_wash_damp_conditioning"
      ? [
          {
            stepKey: "towel-dry",
            action: "section",
            copyTemplateDe: "Das Haar nach dem Waschen sanft handtuchtrocknen.",
          },
          {
            stepKey: "apply",
            action: "apply_product",
            copyTemplateDe: "Eine kleine Menge in Längen und Spitzen verteilen. Nicht ausspülen.",
          },
        ]
      : use.application_family === "between_wash_dry_care"
        ? [
            {
              stepKey: "dry-care",
              action: "apply_product",
              copyTemplateDe:
                "Mit einer sehr kleinen Menge in trockenen Längen und Spitzen beginnen und nur bei Bedarf ergänzen.",
            },
          ]
        : use.application_family === "post_style_finish"
          ? [
              {
                stepKey: "post-style-finish",
                action: "apply_product",
                copyTemplateDe:
                  "Mit einer sehr kleinen Menge beginnen und nach dem Styling sparsam über Längen und Spitzen geben.",
              },
            ]
          : [
              {
                stepKey: "apply",
                action: "apply_product",
                copyTemplateDe:
                  "Gleichmäßig auf dem vom Hersteller genannten Haarzustand verteilen. Erst danach föhnen oder stylen.",
              },
            ]

  return applicationGuidanceProtocolSchema.parse({
    schemaVersion: 1,
    guidanceKey: `leave-in-use-case-2026-08-14-${productId}-${use.application_family}`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "product", category: "leave_in", productId },
    role: isHeat ? "heat_protection" : "leave_in",
    applicationFamily: use.application_family,
    compatibleDayTypes,
    exactGuidanceRequired: true,
    sequence: {
      anchor:
        use.application_family === "pre_heat_dry"
          ? "dry_pre_heat"
          : isDry
            ? "dry_finish"
            : "damp_leave_on",
      before: [],
      after: [],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: isHeat ? ["heatEvents"] : [],
    },
    protocolFacts: {
      applicationArea: isHeat ? "all_hair" : "lengths_ends",
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps,
    evidence: [
      {
        sourceUrl: use.source_url,
        sourceType: use.source_type,
        checkedAt: use.checked_at,
      },
    ],
  })
}

export function buildLeaveInUseCasePointerDelta(
  reviewed: ReviewedUseCases,
  artifact: BackfillArtifact,
) {
  const currentByProduct = new Map<string, Map<string, ProductApplicationPointerV2>>()
  for (const item of artifact.items) {
    if (item.guidance_payload_v2.scope.category !== "leave_in") continue
    const rows = currentByProduct.get(item.product_id) ?? new Map()
    rows.set(
      identity(item.source_role, item.guidance_payload_v2.applicationFamily),
      productApplicationPointerV2Schema.parse(item.guidance_payload_v2),
    )
    currentByProduct.set(item.product_id, rows)
  }

  const inserts: Array<{
    product_id: string
    product_name: string
    source_role: string
    application_family: ProductApplicationPointerV2["applicationFamily"]
    guidance_payload: ReturnType<typeof guidancePayloadV1For>
    guidance_payload_v2: ProductApplicationPointerV2
  }> = []
  const deletes: Array<{
    product_id: string
    source_role: string
    application_family: ProductApplicationPointerV2["applicationFamily"]
  }> = []

  for (const product of reviewed.products) {
    const current = currentByProduct.get(product.product_id) ?? new Map()
    const desired = new Set(
      product.uses.map((use) => identity(use.source_role, use.application_family)),
    )
    for (const use of product.uses) {
      const key = identity(use.source_role, use.application_family)
      if (current.has(key)) continue
      inserts.push({
        product_id: product.product_id,
        product_name: product.product_name,
        source_role: use.source_role,
        application_family: use.application_family,
        guidance_payload: guidancePayloadV1For(product.product_id, use),
        guidance_payload_v2: pointerFor(product.product_id, use),
      })
    }
    for (const [key, pointer] of current) {
      if (desired.has(key)) continue
      deletes.push({
        product_id: product.product_id,
        source_role: pointer.sourceRole,
        application_family: pointer.applicationFamily,
      })
    }
  }

  return {
    inserts: inserts.sort(
      (left, right) =>
        left.product_id.localeCompare(right.product_id) ||
        left.source_role.localeCompare(right.source_role) ||
        left.application_family.localeCompare(right.application_family),
    ),
    deletes: deletes.sort(
      (left, right) =>
        left.product_id.localeCompare(right.product_id) ||
        left.source_role.localeCompare(right.source_role) ||
        left.application_family.localeCompare(right.application_family),
    ),
  }
}
