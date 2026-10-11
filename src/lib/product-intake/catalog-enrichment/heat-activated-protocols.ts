import {
  applicationGuidanceProtocolSchema,
  HEAT_ACTIVATED_WORKFLOW_RUNTIME,
  type ApplicationGuidanceProtocolV1,
} from "@/lib/routines/personal-plan/application/contracts"
import {
  productApplicationPointerV2Schema,
  type ProductApplicationPointerV2,
} from "@/lib/routines/personal-plan/application/contracts-v2"

import { buildProductApplicationPointerV2 } from "./stage5-v2-builder"

/**
 * Reviewed `heat_activated_verified_product` protocol rows (S3 §5.2–5.4, rulings A1, D-c, D-d,
 * D-e; Nick 2026-10-09). Pure: the S3 data-migration generator imports the row inputs and the
 * builder; nothing here reads or writes the database.
 *
 * Copy discipline: every visible step rests on manufacturer text only (D-d). Each step names
 * the verbatim quotes it is built from (`sourceSentences`): at least one quote is contained in
 * the row's stored `source_text` (the directions), any further quote in the manufacturer's
 * activation statement (HA-2a). The builder refuses anything else.
 */

export const HEAT_ACTIVATED_WORKFLOW_ID = "heat_activated_verified_product" as const

export type HeatActivatedStepInput = {
  stepKey: string
  action: "section" | "apply_product" | "tool"
  copyDe: string
  /** Verbatim manufacturer quotes the copy rests on (review table + test; not stored). */
  sourceSentences: string[]
}

export type HeatActivatedProtocolRowInput = {
  productId: string
  productName: string
  category: "leave_in"
  applicationFamily: "pre_heat_damp" | "pre_heat_dry"
  /** V1 `applicationArea`, also stored as the row's `placement`. */
  placement: "lengths_ends" | "all_hair"
  amount: ApplicationGuidanceProtocolV1["protocolFacts"]["amount"]
  sourceLabel: string
  /** The C1/C2 manufacturer source; must be the first (manufacturer) evidence URL. */
  sourceUrl: string
  /** The manufacturer's directions, verbatim. */
  sourceText: string
  /** The manufacturer's activation statement (HA-2a), verbatim; not part of `source_text`. */
  activationStatement: string
  evidence: ApplicationGuidanceProtocolV1["evidence"]
  steps: HeatActivatedStepInput[]
}

export type HeatActivatedProtocolRow = {
  product_id: string
  category: "leave_in"
  role: "pre_heat_protection"
  application_stage: "damp_leave_on" | "dry_pre_heat"
  application_state: "damp" | "dry"
  placement: HeatActivatedProtocolRowInput["placement"]
  rinse_action: "leave_in"
  reapplication: "required"
  contact_time_seconds: null
  instruction_modifiers: []
  source_label: string
  source_url: string
  source_text: string
  guidance_payload: ApplicationGuidanceProtocolV1
  guidance_payload_v2: ProductApplicationPointerV2
}

function assertQuotedFromManufacturer(input: HeatActivatedProtocolRowInput) {
  for (const step of input.steps) {
    if (!step.sourceSentences.some((sentence) => input.sourceText.includes(sentence))) {
      throw new Error(
        `heat_activated_step_without_source_sentence:${input.productId}:${step.stepKey}`,
      )
    }
    for (const sentence of step.sourceSentences) {
      if (!input.sourceText.includes(sentence) && !input.activationStatement.includes(sentence)) {
        throw new Error(
          `heat_activated_source_sentence_not_manufacturer:${input.productId}:${step.stepKey}`,
        )
      }
    }
  }
  const manufacturer = input.evidence[0]
  if (manufacturer?.sourceType !== "manufacturer" || manufacturer.sourceUrl !== input.sourceUrl) {
    throw new Error(`heat_activated_source_url_not_manufacturer_evidence:${input.productId}`)
  }
}

/**
 * One complete `product_application_protocols` row. The V2 pointer is derived from the V1
 * payload by the published builder, so V1 and V2 agree by construction; both are validated
 * against their schemas and any failure throws.
 */
export function buildHeatActivatedProtocolRow(
  input: HeatActivatedProtocolRowInput,
): HeatActivatedProtocolRow {
  assertQuotedFromManufacturer(input)
  const runtime = HEAT_ACTIVATED_WORKFLOW_RUNTIME[input.applicationFamily]
  const applicationState = input.applicationFamily === "pre_heat_dry" ? "dry" : "damp"
  const guidancePayload = applicationGuidanceProtocolSchema.parse({
    schemaVersion: 1,
    guidanceKey: `heat-activated-verified-product-${input.productId}-${input.applicationFamily}`,
    protocolVersion: 1,
    locale: "de",
    scope: { kind: "product", category: input.category, productId: input.productId },
    role: "heat_protection",
    applicationFamily: input.applicationFamily,
    compatibleDayTypes: [...runtime.compatibleDayTypes],
    exactGuidanceRequired: true,
    sequence: { anchor: runtime.anchor, before: ["heat_tool"], after: [], conflictsWith: [] },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: ["heatEvents"],
    },
    protocolFacts: {
      applicationArea: input.placement,
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "each_separate_heat_event",
      amount: input.amount,
      workflowId: HEAT_ACTIVATED_WORKFLOW_ID,
      heatActivationRequired: true,
      cautions: [],
    },
    steps: input.steps.map((step) => ({
      stepKey: step.stepKey,
      action: step.action,
      copyTemplateDe: step.copyDe,
    })),
    evidence: input.evidence,
  })
  const guidancePayloadV2 = productApplicationPointerV2Schema.parse(
    buildProductApplicationPointerV2({
      sourceRole: "pre_heat_protection",
      guidancePayload,
      applicationState,
    }),
  )
  return {
    product_id: input.productId,
    category: input.category,
    role: "pre_heat_protection",
    application_stage: runtime.anchor,
    application_state: applicationState,
    placement: input.placement,
    rinse_action: "leave_in",
    reapplication: "required",
    contact_time_seconds: null,
    instruction_modifiers: [],
    source_label: input.sourceLabel,
    source_url: input.sourceUrl,
    source_text: input.sourceText,
    guidance_payload: guidancePayload,
    guidance_payload_v2: guidancePayloadV2,
  }
}

// ---------------------------------------------------------------------------------------------
// Reviewed row inputs (S3 plan §5.2 / §5.3). Source texts are verbatim; checked 2026-10-09.

const CHECKED_AT = "2026-10-09"

const NEQI_SOURCE_URL = "https://neqi-hair.com/products/diamond-glass-ultimate-styling-spray"
const NEQI_DM_URL = "https://www.dm.de/p/d/3080142/neqi-leave-in-spray-diamond-glass-ultimate"

/** Neqi Diamond Glass Ultimate Styling Spray — C2 manufacturer page (neqi-hair.com). */
export const NEQI_DIAMOND_GLASS_ULTIMATE_HEAT_ACTIVATED_ROW_INPUT: HeatActivatedProtocolRowInput = {
  productId: "42a2fe20-bd7e-49a3-a880-8ae89015a5c9",
  productName: "Neqi Diamond Glass Ultimate Styling Spray",
  category: "leave_in",
  applicationFamily: "pre_heat_damp",
  placement: "lengths_ends",
  amount: { kind: "qualitative", copyDe: "großzügig" },
  sourceLabel: "Neqi Hersteller (neqi-hair.com)",
  sourceUrl: NEQI_SOURCE_URL,
  sourceText:
    "1. Das Haar in Abschnitte unterteilen. 2. Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen. 3. Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.",
  activationStatement:
    "Noch mehr hitzeaktivierte Polymere als im goldenen Diamond Glass Styling Spray",
  evidence: [
    { sourceUrl: NEQI_SOURCE_URL, sourceType: "manufacturer", checkedAt: CHECKED_AT },
    { sourceUrl: NEQI_DM_URL, sourceType: "retailer", checkedAt: CHECKED_AT },
  ],
  steps: [
    {
      stepKey: "section",
      action: "section",
      copyDe: "Das handtuchtrockene Haar in Partien teilen – es sollte nicht mehr nass sein.",
      sourceSentences: [
        "Das Haar in Abschnitte unterteilen.",
        "handtuchtrockene (nicht nasse) Haar",
      ],
    },
    {
      stepKey: "apply",
      action: "apply_product",
      copyDe: "Das Spray großzügig und gleichmäßig auf jede Partie sprühen.",
      sourceSentences: [
        "Das Spray großzügig und gleichmäßig auf das handtuchtrockene (nicht nasse) Haar sprühen.",
      ],
    },
    {
      stepKey: "activate",
      action: "tool",
      copyDe:
        "Jede Partie mit Hitze und unter Spannung föhnen. Erst die Wärme aktiviert das Spray.",
      sourceSentences: [
        "Anschließend die einzelnen Partien mit Hitze und auf Spannung föhnen.",
        "hitzeaktivierte Polymere",
      ],
    },
  ],
}

const PANTENE_PACK_URL =
  "https://products.dm-static.com/images/f_auto,q_auto,c_fit,h_1200,w_1200/v1754980497/assets/pas/images/73c6eac9-e216-44b2-96ef-6de93449814d/pantene-pro-v-leave-in-moisture-boost-heat-und-glow"
const PANTENE_DM_URL =
  "https://www.dm.de/p/d/3088304/pantene-pro-v-leave-in-moisture-boost-heat-und-glow"
const PANTENE_SOURCE_TEXT =
  "1-2 Pumpstöße auf das gereinigte Haar auftragen. / Föhnen, um zu aktivieren. / Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren."
const PANTENE_ACTIVATE_COPY = "Danach föhnen – erst die Wärme aktiviert die Pflege."

const PANTENE_COMMON = {
  productId: "e781ca9e-886d-40a1-bfe1-48177cfbf381",
  productName: "Pantene Pro-V Leave-In Moisture Boost HEAT&GLOW",
  category: "leave_in",
  placement: "all_hair",
  sourceLabel: "Pantene-Packung DE (Rückseite), Foto via dm",
  sourceUrl: PANTENE_PACK_URL,
  sourceText: PANTENE_SOURCE_TEXT,
  activationStatement: "Hitzeaktivierte Formel für extra Pflege",
  evidence: [
    { sourceUrl: PANTENE_PACK_URL, sourceType: "manufacturer", checkedAt: CHECKED_AT },
    { sourceUrl: PANTENE_DM_URL, sourceType: "retailer", checkedAt: CHECKED_AT },
  ],
} as const satisfies Partial<HeatActivatedProtocolRowInput>

/**
 * Pantene HEAT&GLOW — C1 current German pack (back; front for the activation statement),
 * read from the dm-hosted packshot (H3). Row 1 replaces the Boots-sourced wash-day row; row 2
 * is the pack's between-wash use (P13). The two legacy post-wash rows stay untouched (Q1).
 */
export const PANTENE_HEAT_GLOW_HEAT_ACTIVATED_ROW_INPUTS: HeatActivatedProtocolRowInput[] = [
  {
    ...PANTENE_COMMON,
    evidence: [...PANTENE_COMMON.evidence],
    applicationFamily: "pre_heat_damp",
    amount: { kind: "pumps", minimum: 1, maximum: 2 },
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyDe: "1–2 Pumpstöße im frisch gewaschenen Haar verteilen.",
        sourceSentences: ["1-2 Pumpstöße auf das gereinigte Haar auftragen."],
      },
      {
        stepKey: "activate",
        action: "tool",
        copyDe: PANTENE_ACTIVATE_COPY,
        sourceSentences: ["Föhnen, um zu aktivieren.", "Hitzeaktivierte Formel für extra Pflege"],
      },
    ],
  },
  {
    ...PANTENE_COMMON,
    evidence: [...PANTENE_COMMON.evidence],
    applicationFamily: "pre_heat_dry",
    // The pack names no separate dose for the between-wash use.
    amount: null,
    steps: [
      {
        stepKey: "apply-between-washes",
        action: "apply_product",
        copyDe: "Zwischen den Haarwäschen gegen Frizz: die Creme im trockenen Haar verteilen.",
        sourceSentences: ["Zwischen den Haarwäschen nutzen, um Frizz zu kontrollieren."],
      },
      {
        stepKey: "activate",
        action: "tool",
        copyDe: PANTENE_ACTIVATE_COPY,
        // D-c: the pack's activation direction governs every use it lists.
        sourceSentences: ["Föhnen, um zu aktivieren."],
      },
    ],
  },
]
