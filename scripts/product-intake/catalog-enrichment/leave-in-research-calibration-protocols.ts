import { buildProductApplicationPointerV2 } from "@/lib/product-intake/catalog-enrichment/stage5-v2-builder"

/**
 * Protocol rows newly authored for this cohort, strictly from
 * docs/product-application-protocol-templates.md (TPL-LEAVEIN-DAMP and
 * TPL-LEAVEIN-HEAT) plus the live leave-in rows used as the style reference
 * (alverde slot-01 post_wash_damp_conditioning, GLISS slot-08 pre_heat).
 *
 * Two products need them because the frozen projection changes what they are:
 *  - Redken slot-09 flips provides_heat_protection false → true, which makes
 *    pre_heat_protection a required role it has no row for.
 *  - Neqi slot-13 has no product_application_protocols rows at all.
 *
 * Family choice follows P9: `pre_heat_damp` unless the source explicitly permits
 * damp *or* dry. Both sources name the towel-dry state only ("Ins
 * handtuchtrockenen Haar geben" / "auf das handtuchtrockene (nicht nasse)
 * Haar"), so both are damp-only. Reapplication is `required` per P7.
 *
 * Both products are sprays in the projection, so both carry the template's spray
 * deviation (`amount.kind = "qualitative"`). Neither copy names a temperature:
 * AD-6 keeps heat protection binary, and the templates allow but do not require
 * appending a sourced degree sentence — left out here, flagged for Nick.
 *
 * These rows are NOT planned_operations. See the module doc in
 * leave-in-research-calibration.ts and the runbook.
 */

const REDKEN_ID = "2b7db7e3-2058-4178-8a03-7d05f4a1d447"
const NEQI_ID = "42a2fe20-bd7e-49a3-a880-8ae89015a5c9"

const REDKEN_SOURCE_URL =
  "https://www.redken.eu/de-de/produkte/haarpflege/extreme/extreme-anti-snap"
const REDKEN_SOURCE_TEXT =
  "Nach dem Extreme Shampoo und Conditioner anwenden. Ins handtuchtrockenen Haar geben. Nicht ausspuelen. Wie gewohnt stylen."
const REDKEN_CHECKED_AT = "2026-09-13"

const NEQI_SOURCE_URL = "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray"
const NEQI_SOURCE_TEXT =
  "Das Haar in Abschnitte unterteilen. Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen. Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen."
const NEQI_CHECKED_AT = "2026-09-03"

const SPRAY_AMOUNT = {
  kind: "qualitative" as const,
  copyDe: "Gleichmäßig sprühen.",
}

function damcProtocol(input: {
  productId: string
  guidanceKey: string
  sourceLabel: string
  sourceUrl: string
  sourceText: string
  checkedAt: string
  applySteps: Array<{ stepKey: string; action: string; copyTemplateDe: string }>
  amount: typeof SPRAY_AMOUNT | null
}) {
  return {
    product_id: input.productId,
    category: "leave_in",
    category_key: "leave_in",
    role: "post_wash_leave_in",
    application_family: "post_wash_damp_conditioning",
    cadence: null,
    application_stage: "damp_leave_on",
    application_state: null,
    placement: "lengths_ends",
    contact_time_seconds: null,
    rinse_action: "leave_in",
    reapplication: "not_stated",
    instruction_modifiers: [],
    source_label: input.sourceLabel,
    source_url: input.sourceUrl,
    source_text: input.sourceText,
    guidance_payload: {
      schemaVersion: 1,
      guidanceKey: input.guidanceKey,
      protocolVersion: 1,
      locale: "de",
      scope: { kind: "product", category: "leave_in", productId: input.productId },
      role: "leave_in",
      applicationFamily: "post_wash_damp_conditioning",
      compatibleDayTypes: ["wash_day", "intensive_care_day", "styling_day"],
      exactGuidanceRequired: true,
      sequence: {
        anchor: "damp_leave_on",
        before: [],
        after: ["post_rinse_towel_dry"],
        conflictsWith: [],
      },
      requirements: {
        requiredCatalogFacts: [],
        requiredProtocolFacts: [],
        requiredProfileFacts: [],
      },
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "leave_in",
        contactTimeSeconds: null,
        conditionerRelationship: "not_applicable",
        reapplication: "none",
        amount: input.amount,
        cautions: [],
      },
      steps: input.applySteps,
      evidence: [
        { sourceUrl: input.sourceUrl, sourceType: "manufacturer", checkedAt: input.checkedAt },
      ],
    },
  }
}

function preHeatDampProtocol(input: {
  productId: string
  guidanceKey: string
  sourceLabel: string
  sourceUrl: string
  sourceText: string
  checkedAt: string
  toolCopyDe: string
}) {
  return {
    product_id: input.productId,
    category: "leave_in",
    category_key: "leave_in",
    role: "pre_heat_protection",
    application_family: "pre_heat_damp",
    cadence: null,
    application_stage: "damp_leave_on",
    application_state: "damp",
    placement: "lengths_ends",
    contact_time_seconds: null,
    rinse_action: "leave_in",
    reapplication: "required",
    instruction_modifiers: [],
    source_label: input.sourceLabel,
    source_url: input.sourceUrl,
    source_text: input.sourceText,
    guidance_payload: {
      schemaVersion: 1,
      guidanceKey: input.guidanceKey,
      protocolVersion: 1,
      locale: "de",
      scope: { kind: "product", category: "leave_in", productId: input.productId },
      role: "heat_protection",
      applicationFamily: "pre_heat_damp",
      compatibleDayTypes: ["styling_day"],
      exactGuidanceRequired: true,
      sequence: {
        anchor: "damp_leave_on",
        before: ["heat_tool"],
        after: [],
        conflictsWith: [],
      },
      requirements: {
        requiredCatalogFacts: [],
        requiredProtocolFacts: [],
        requiredProfileFacts: [],
      },
      protocolFacts: {
        applicationArea: "lengths_ends",
        rinse: "leave_in",
        contactTimeSeconds: null,
        conditionerRelationship: "not_applicable",
        reapplication: "each_separate_heat_event",
        amount: SPRAY_AMOUNT,
        cautions: [],
      },
      steps: [
        {
          stepKey: "apply-pre-heat",
          action: "apply_product",
          copyTemplateDe:
            "Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar sprühen, in Längen und Spitzen verteilen und durchkämmen – nur Strähnen mit Produkt sind geschützt.",
        },
        { stepKey: "tool-pre-heat", action: "tool", copyTemplateDe: input.toolCopyDe },
      ],
      evidence: [
        { sourceUrl: input.sourceUrl, sourceType: "manufacturer", checkedAt: input.checkedAt },
      ],
    },
  }
}

const rows = [
  // Neqi — TPL-LEAVEIN-DAMP, spray deviation, section step from the source's own step 1.
  damcProtocol({
    productId: NEQI_ID,
    guidanceKey: `product-leave-in-${NEQI_ID}-post-wash`,
    sourceLabel: "Neqi Produktseite",
    sourceUrl: NEQI_SOURCE_URL,
    sourceText: NEQI_SOURCE_TEXT,
    checkedAt: NEQI_CHECKED_AT,
    amount: { kind: "qualitative", copyDe: "Großzügig und gleichmäßig sprühen." },
    applySteps: [
      {
        stepKey: "towel-dry",
        action: "section",
        copyTemplateDe:
          "Das Haar nach dem Waschen mit dem Handtuch sanft ausdrücken, nicht rubbeln – nasses Haar bricht leichter. Danach in Abschnitte unterteilen.",
      },
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Großzügig und gleichmäßig ins handtuchtrockene – nicht nasse – Haar sprühen, Längen und Spitzen abdecken und den Ansatz aussparen. Zum Verteilen mit einem grobzinkigen Kamm durchkämmen. Nicht ausspülen.",
      },
    ],
  }),
  // Neqi — TPL-LEAVEIN-HEAT, damp family; tool copy follows the source's blow-dry-under-tension instruction.
  preHeatDampProtocol({
    productId: NEQI_ID,
    guidanceKey: `product-leave-in-${NEQI_ID}-pre-heat`,
    sourceLabel: "Neqi Produktseite",
    sourceUrl: NEQI_SOURCE_URL,
    sourceText: NEQI_SOURCE_TEXT,
    checkedAt: NEQI_CHECKED_AT,
    toolCopyDe:
      "Danach die einzelnen Partien mit Wärme und auf Spannung föhnen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen.",
  }),
  // Redken — TPL-LEAVEIN-HEAT, damp family; the C2 page names the towel-dry state only.
  preHeatDampProtocol({
    productId: REDKEN_ID,
    guidanceKey: `product-leave-in-${REDKEN_ID}-pre-heat`,
    sourceLabel: "Redken Produktseite (DE)",
    sourceUrl: REDKEN_SOURCE_URL,
    sourceText: REDKEN_SOURCE_TEXT,
    checkedAt: REDKEN_CHECKED_AT,
    toolCopyDe:
      "Danach wie gewohnt mit Wärme stylen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen.",
  }),
]

export const LEAVE_IN_CALIBRATION_AUTHORED_PROTOCOLS = rows.map((row) => ({
  product_id: row.product_id,
  row: {
    ...row,
    guidance_payload_v2: buildProductApplicationPointerV2({
      sourceRole: row.role,
      guidancePayload: row.guidance_payload,
      applicationState: row.application_state,
    }) as unknown as Record<string, unknown>,
  },
}))
