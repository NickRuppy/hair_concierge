import {
  EXPANSION_TEMPLATE_META,
  type ExpansionTemplateId,
} from "@/lib/product-intake/expansion-manifest"

/**
 * Stamps the 12 reviewed protocol content templates from
 * `docs/product-application-protocol-templates.md` (Rev 2) onto a single product,
 * producing the exact `product_application_protocols` row the Product Intake spec
 * operation expects (category-validators.ts:168-183).
 *
 * The German step copy, `stepKey`s, `guidanceKey` shapes, sequence anchors and
 * `protocolFacts` in `PAYLOAD_BUILDERS` below are transcribed byte-for-byte from
 * the markdown's ```json blocks — they are Nick's ruled content, not defaults to
 * be "improved" here. Only the `⟨…⟩` slots are filled from `slots`.
 *
 * Scope of this module (per the templates' §2.2 / §6 checklist):
 *  - It never emits `application_family` or `category_key` — both are
 *    `GENERATED ALWAYS` columns.
 *  - It never emits `source_label` / `source_url` / `source_text`; the caller
 *    attaches the product's own sources to the row.
 *  - It emits no `guidance_payload_v2`; the caller runs
 *    `buildProductApplicationPointerV2` when a V2 pointer is wanted.
 *
 * ---------------------------------------------------------------------------
 * Where the markdown and the live code disagree, the CODE wins (recorded here):
 *
 * 1. TPL-MASK's `protocolFacts.contactTimeSeconds` is written in the markdown as
 *    a STRING placeholder (`"⟨REQUIRED: from packaging …⟩"`,
 *    product-application-protocol-templates.md:594). `applicationGuidanceProtocolSchema` types the
 *    field as `z.number().int().nonnegative().nullable()`
 *    (src/lib/routines/personal-plan/application/contracts.ts:266). Followed the
 *    schema: the slot is a `number | null`.
 *
 * 2. §2.3 lists only `"retailer"` and `"manufacturer"` as evidence source types
 *    (product-application-protocol-templates.md:87). The schema's enum is
 *    `manufacturer | retailer | professional_authority | internal_authority`
 *    (contracts.ts:318-323). Followed the schema, minus `internal_authority`,
 *    which the expansion manifest's own evidence enum also excludes
 *    (src/lib/product-intake/expansion-manifest.ts:301).
 *
 * 3. The markdown leaves `applicationFamily` as a per-product slot for the two
 *    heat templates (`⟨pre_heat_damp | either_state_protection⟩`,
 *    product-application-protocol-templates.md:832 and :1081), so no single constant can be exactly
 *    right for them. `EXPANSION_TEMPLATE_APPLICATION_FAMILY` therefore records
 *    the DEFAULT (damp-only) family, `pre_heat_damp` — which is also the V2
 *    builder's own default for `sourceRole: "pre_heat_protection"`
 *    (stage5-v2-builder.ts:47). With `usableOnDryHair: true` the stamped row and
 *    the V2 pointer both carry `either_state_protection` instead.
 *
 * 4. `application_stage` for TPL-LEAVEIN-DRYCARE is `dry_hair`
 *    (product-application-protocol-templates.md:736) while its payload `sequence.anchor` is
 *    `dry_finish`. That is not a contradiction: the column is a free
 *    `nullableTrimmedString` (category-validators.ts:739) and only
 *    `sequence.anchor` is constrained to `APPLICATION_SEQUENCE_ANCHORS`
 *    (contracts.ts:75-85). Both values are kept exactly as written.
 */

export type ExpansionProtocolEvidence = {
  sourceUrl: string
  sourceType: "manufacturer" | "retailer" | "professional_authority"
  checkedAt: string // YYYY-MM-DD
}

export type ExpansionTemplateSlots = {
  productId: string
  evidence: ExpansionProtocolEvidence[] // >= 1
  /** TPL-MASK only: required. integer seconds, or null for a range/maximum (see §2.5). */
  contactTimeSeconds?: number | null
  /** TPL-MASK only: required. The German wait-step copy, e.g. "5–10 Minuten einwirken lassen." */
  waitCopyDe?: string
  /** TPL-LEAVEIN-HEAT / TPL-OIL-HEAT only: required (see those templates' slots). */
  usableOnDryHair?: boolean
}

/** The exact row shape the Product-Intake spec operation for `product_application_protocols` expects. */
export type ExpansionProtocolRow = {
  category: string
  role: string
  cadence: Record<string, unknown> | null
  application_stage: string | null
  application_state: "damp" | "dry" | "either" | null
  placement: string | null
  contact_time_seconds: number | null
  rinse_action: string | null
  reapplication: "required" | "optional" | "not_stated" | null
  instruction_modifiers: string[]
  guidance_payload: Record<string, unknown>
}

/**
 * The V1 `applicationFamily` each template stamps. For the two heat templates this
 * is the damp-only default — see disagreement (3) in the module header.
 */
export const EXPANSION_TEMPLATE_APPLICATION_FAMILY: Record<ExpansionTemplateId, string> = {
  "TPL-SHAMPOO-STD": "standard_rinse_out_cleanse",
  "TPL-SHAMPOO-TARGETED": "targeted_treatment_shampoo",
  "TPL-SHAMPOO-DANDRUFF": "targeted_treatment_shampoo",
  "TPL-CONDITIONER": "standard_rinse_out_conditioning",
  "TPL-MASK": "post_shampoo_rinse_out_mask",
  "TPL-LEAVEIN-DAMP": "post_wash_damp_conditioning",
  "TPL-LEAVEIN-DRYCARE": "between_wash_dry_care",
  "TPL-LEAVEIN-HEAT": "pre_heat_damp",
  "TPL-OIL-DRYFINISH": "dry_finish",
  "TPL-OIL-LEAVEON": "post_wash_damp_conditioning",
  "TPL-OIL-HEAT": "pre_heat_damp",
  "TPL-OIL-PREWASH": "pre_wash_lengths_treatment",
}

const MASK_TEMPLATE_ID: ExpansionTemplateId = "TPL-MASK"
const HEAT_TEMPLATE_IDS: ReadonlySet<ExpansionTemplateId> = new Set<ExpansionTemplateId>([
  "TPL-LEAVEIN-HEAT",
  "TPL-OIL-HEAT",
])

/**
 * The oil templates' `⟨lengths_ends | ends⟩` slot. `ends` is the documented
 * exception for rich/heavy oils, which is a researched oil-weight fact that
 * `ExpansionTemplateSlots` does not carry — so the documented default applies.
 * Rich oils need `placement` / `applicationArea` corrected by the caller.
 */
const OIL_APPLICATION_AREA_DEFAULT = "lengths_ends"

type TemplateContext = {
  productId: string
  evidence: ExpansionProtocolEvidence[]
  contactTimeSeconds: number | null
  waitCopyDe: string
  usableOnDryHair: boolean
}

/** P9 mapping table (product-application-protocol-templates.md:810-813 and :1059-1062). */
function heatFamily(ctx: TemplateContext): string {
  return ctx.usableOnDryHair ? "either_state_protection" : "pre_heat_damp"
}

function heatAnchor(ctx: TemplateContext): string {
  return ctx.usableOnDryHair ? "dry_pre_heat" : "damp_leave_on"
}

function heatStage(ctx: TemplateContext): string {
  return ctx.usableOnDryHair ? "dry_pre_heat" : "damp_leave_on"
}

function heatState(ctx: TemplateContext): "damp" | "either" {
  return ctx.usableOnDryHair ? "either" : "damp"
}

const PAYLOAD_BUILDERS: Record<
  ExpansionTemplateId,
  (ctx: TemplateContext) => Record<string, unknown>
> = {
  "TPL-SHAMPOO-STD": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-shampoo-everyday-${ctx.productId}`,
    scope: {
      kind: "product",
      category: "shampoo",
      productId: ctx.productId,
    },
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "wet_cleanse",
      before: ["post_cleanse_rinse_off"],
      after: [],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-shampoo",
        action: "apply_product",
        copyTemplateDe:
          "Das Shampoo mit etwas Wasser in den Handflächen aufschäumen. Auf der Kopfhaut verteilen und mit den Fingerkuppen sanft einmassieren.",
      },
      {
        stepKey: "rinse-shampoo",
        action: "rinse",
        copyTemplateDe:
          "Gründlich lauwarm ausspülen – der ablaufende Schaum reinigt die Längen mit.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-SHAMPOO-TARGETED": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-shampoo-everyday-${ctx.productId}`,
    scope: {
      kind: "product",
      category: "shampoo",
      productId: ctx.productId,
    },
    role: "cleanse",
    applicationFamily: "targeted_treatment_shampoo",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "wet_cleanse",
      before: ["post_cleanse_rinse_off"],
      after: [],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-shampoo",
        action: "apply_product",
        copyTemplateDe:
          "Das Shampoo mit etwas Wasser in den Handflächen aufschäumen. Auf der Kopfhaut verteilen und mit den Fingerkuppen sanft einmassieren.",
      },
      {
        stepKey: "wait-shampoo",
        action: "wait",
        copyTemplateDe: "2–3 Minuten einwirken lassen.",
      },
      {
        stepKey: "rinse-shampoo",
        action: "rinse",
        copyTemplateDe:
          "Gründlich lauwarm ausspülen – der ablaufende Schaum reinigt die Längen mit.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-SHAMPOO-DANDRUFF": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-shampoo-dandruff-${ctx.productId}`,
    scope: {
      kind: "product",
      category: "shampoo",
      productId: ctx.productId,
    },
    role: "cleanse",
    applicationFamily: "targeted_treatment_shampoo",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "wet_cleanse",
      before: ["post_cleanse_rinse_off"],
      after: [],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "scalp_roots",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-dandruff-shampoo",
        action: "apply_product",
        copyTemplateDe:
          "Das Shampoo mit etwas Wasser in den Handflächen aufschäumen. Auf der Kopfhaut verteilen und mit den Fingerkuppen sanft einmassieren.",
      },
      {
        stepKey: "wait-dandruff-shampoo",
        action: "wait",
        copyTemplateDe: "2–3 Minuten einwirken lassen.",
      },
      {
        stepKey: "rinse-dandruff-shampoo",
        action: "rinse",
        copyTemplateDe:
          "Gründlich lauwarm ausspülen – der ablaufende Schaum reinigt die Längen mit.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-CONDITIONER": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-conditioner-${ctx.productId}`,
    scope: {
      kind: "product",
      category: "conditioner",
      productId: ctx.productId,
    },
    role: "condition",
    applicationFamily: "standard_rinse_out_conditioning",
    compatibleDayTypes: ["wash_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "post_cleanse_rinse_off",
      before: [],
      after: ["wet_cleanse"],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "lengths_ends",
      rinse: "rinse_out",
      contactTimeSeconds: null,
      sharedTemplateContactTime: "include",
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-conditioner",
        action: "apply_product",
        copyTemplateDe:
          "Das Haar erst sanft ausdrücken, bis es nicht mehr tropft – sonst verdünnt Wasser den Conditioner. Dann in Längen und Spitzen einarbeiten, den Ansatz aussparen. Mit den Fingern oder einem grobzinkigen Kamm gleichmäßig verteilen.",
      },
      {
        stepKey: "wait-conditioner",
        action: "wait",
        copyTemplateDe: "1–3 Minuten einwirken lassen.",
      },
      {
        stepKey: "rinse-conditioner",
        action: "rinse",
        copyTemplateDe: "Gründlich ausspülen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-MASK": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-mask-${ctx.productId}`,
    scope: {
      kind: "product",
      category: "mask",
      productId: ctx.productId,
    },
    role: "intensive_care",
    applicationFamily: "post_shampoo_rinse_out_mask",
    compatibleDayTypes: ["intensive_care_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "post_cleanse_rinse_off",
      before: [],
      after: ["wet_cleanse"],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: "lengths_ends",
      rinse: "rinse_out",
      contactTimeSeconds: ctx.contactTimeSeconds,
      conditionerRelationship: "replaces_conditioner",
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-mask",
        action: "apply_product",
        copyTemplateDe:
          "Das Haar nach der Wäsche sanft ausdrücken, bis es nicht mehr tropft. In Längen und Spitzen einarbeiten, den Ansatz aussparen. Mit einem grobzinkigen Kamm durchkämmen, damit jede Strähne bedeckt ist.",
      },
      {
        stepKey: "wait-mask",
        action: "wait",
        copyTemplateDe: ctx.waitCopyDe,
      },
      {
        stepKey: "rinse-mask",
        action: "rinse",
        copyTemplateDe: "Gründlich ausspülen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-LEAVEIN-DAMP": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-leave-in-${ctx.productId}-post-wash`,
    scope: {
      kind: "product",
      category: "leave_in",
      productId: ctx.productId,
    },
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
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "towel-dry",
        action: "section",
        copyTemplateDe:
          "Das Haar nach dem Waschen mit dem Handtuch sanft ausdrücken, nicht rubbeln – nasses Haar bricht leichter.",
      },
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Eine kleine Menge in den Handflächen verreiben und in Längen und Spitzen einarbeiten, den Ansatz aussparen. Zum Verteilen mit einem grobzinkigen Kamm durchkämmen. Nicht ausspülen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-LEAVEIN-DRYCARE": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-leave-in-${ctx.productId}-dry-care`,
    scope: {
      kind: "product",
      category: "leave_in",
      productId: ctx.productId,
    },
    role: "leave_in",
    applicationFamily: "between_wash_dry_care",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "dry_finish",
      before: [],
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
      reapplication: "none",
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "dry-care",
        action: "apply_product",
        copyTemplateDe:
          "Mit einer sehr kleinen Menge starten und in den Handflächen verreiben. Zuerst in die trockenen Spitzen einarbeiten, dann in die Längen – den Ansatz aussparen. Nur bei Bedarf nachlegen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-LEAVEIN-HEAT": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-leave-in-${ctx.productId}-pre-heat`,
    scope: {
      kind: "product",
      category: "leave_in",
      productId: ctx.productId,
    },
    role: "heat_protection",
    applicationFamily: heatFamily(ctx),
    compatibleDayTypes: ["styling_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: heatAnchor(ctx),
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
      amount: null,
      cautions: [],
    },
    steps: [
      {
        stepKey: "apply-pre-heat",
        action: "apply_product",
        copyTemplateDe: ctx.usableOnDryHair
          ? "Vor dem Hitzestyling gleichmäßig ins feuchte oder trockene Haar geben, in Längen und Spitzen verteilen und durchkämmen – nur Strähnen mit Produkt sind geschützt."
          : "Vor dem Hitzestyling gleichmäßig ins handtuchtrockene Haar geben, in Längen und Spitzen verteilen und durchkämmen – nur Strähnen mit Produkt sind geschützt.",
      },
      {
        stepKey: "tool-pre-heat",
        action: "tool",
        copyTemplateDe:
          "Danach mit Wärme stylen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-OIL-DRYFINISH": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-oil-${ctx.productId}-dry`,
    scope: {
      kind: "product",
      category: "oil",
      productId: ctx.productId,
    },
    role: "finish",
    applicationFamily: "dry_finish",
    compatibleDayTypes: ["wash_day", "intensive_care_day", "styling_day", "between_wash_care_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "dry_finish",
      before: [],
      after: [],
      conflictsWith: [],
    },
    requirements: {
      requiredCatalogFacts: [],
      requiredProtocolFacts: [],
      requiredProfileFacts: [],
    },
    protocolFacts: {
      applicationArea: OIL_APPLICATION_AREA_DEFAULT,
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: {
        kind: "qualitative",
        copyDe: "Wenige Tropfen verwenden.",
      },
      cautions: [],
    },
    steps: [
      {
        stepKey: "dose-dry-finish",
        action: "apply_product",
        copyTemplateDe:
          "Wenige Tropfen zwischen den Handflächen verreiben und anwärmen, bis beide Hände dünn benetzt sind.",
      },
      {
        stepKey: "apply-dry-finish",
        action: "apply_product",
        copyTemplateDe:
          "Zuerst in die trockenen Spitzen einarbeiten, dann den Rest über die Längen streichen. Den Ansatz aussparen, nicht ausspülen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-OIL-LEAVEON": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-oil-${ctx.productId}-leave-on`,
    scope: {
      kind: "product",
      category: "oil",
      productId: ctx.productId,
    },
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
      applicationArea: OIL_APPLICATION_AREA_DEFAULT,
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: {
        kind: "qualitative",
        copyDe: "Wenige Tropfen verwenden.",
      },
      cautions: [],
    },
    steps: [
      {
        stepKey: "dose-damp",
        action: "apply_product",
        copyTemplateDe:
          "Wenige Tropfen zwischen den Handflächen verreiben und anwärmen, bis beide Hände dünn benetzt sind.",
      },
      {
        stepKey: "apply-damp",
        action: "apply_product",
        copyTemplateDe:
          "Zuerst in die handtuchtrockenen Spitzen einarbeiten, dann den Rest über die Längen streichen. Den Ansatz aussparen, nicht ausspülen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-OIL-HEAT": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-oil-${ctx.productId}-heat`,
    scope: {
      kind: "product",
      category: "oil",
      productId: ctx.productId,
    },
    role: "heat_protection",
    applicationFamily: heatFamily(ctx),
    compatibleDayTypes: ["styling_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: heatAnchor(ctx),
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
      applicationArea: OIL_APPLICATION_AREA_DEFAULT,
      rinse: "leave_in",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "each_separate_heat_event",
      amount: {
        kind: "qualitative",
        copyDe: "Wenige Tropfen verwenden.",
      },
      cautions: [],
    },
    steps: [
      {
        stepKey: "dose-heat",
        action: "apply_product",
        copyTemplateDe:
          "Vor dem Hitzestyling wenige Tropfen zwischen den Handflächen verreiben und anwärmen.",
      },
      {
        stepKey: "apply-heat",
        action: "apply_product",
        copyTemplateDe: ctx.usableOnDryHair
          ? "In handtuchtrockene oder trockene Längen und Spitzen einarbeiten und zum Verteilen durchkämmen; bei feinem Haar nur die Spitzen und nie den Ansatz."
          : "In die handtuchtrockenen Längen und Spitzen einarbeiten und zum Verteilen durchkämmen; bei feinem Haar nur die Spitzen und nie den Ansatz.",
      },
      {
        stepKey: "tool-heat",
        action: "tool",
        copyTemplateDe:
          "Danach mit Wärme stylen. Glätteisen oder Lockenstab nur auf komplett trockenem Haar verwenden. Vor jedem weiteren Hitzestyling erneut auftragen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),

  "TPL-OIL-PREWASH": (ctx: TemplateContext) => ({
    schemaVersion: 1,
    protocolVersion: 1,
    locale: "de",
    guidanceKey: `product-oil-${ctx.productId}-pre-wash`,
    scope: {
      kind: "product",
      category: "oil",
      productId: ctx.productId,
    },
    role: "intensive_care",
    applicationFamily: "pre_wash_lengths_treatment",
    compatibleDayTypes: ["intensive_care_day"],
    exactGuidanceRequired: true,
    sequence: {
      anchor: "pre_wash",
      before: ["wet_cleanse"],
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
      rinse: "rinse_out",
      contactTimeSeconds: null,
      conditionerRelationship: "not_applicable",
      reapplication: "none",
      amount: {
        kind: "qualitative",
        copyDe:
          "Fein: mit 1 Tropfen starten; normal: 2 Tropfen; kräftig: 3 Tropfen. Nur so viel ergänzen, dass ein sehr dünner Film entsteht.",
      },
      cautions: [],
    },
    steps: [
      {
        stepKey: "dose-pre-wash",
        action: "apply_product",
        copyTemplateDe:
          "Fein: mit 1 Tropfen starten; normal: 2 Tropfen; kräftig: 3 Tropfen. Nur so viel ergänzen, dass ein sehr dünner Film entsteht.",
      },
      {
        stepKey: "apply-pre-wash",
        action: "apply_product",
        copyTemplateDe:
          "Das Öl vor dem Waschen ins trockene Haar geben: Strähne für Strähne sehr dünn in Längen und Spitzen verteilen. Kopfhaut und Ansatz aussparen.",
      },
      {
        stepKey: "wait-pre-wash",
        action: "wait",
        copyTemplateDe: "15–20 Minuten einwirken lassen.",
      },
      {
        stepKey: "rinse-pre-wash",
        action: "rinse",
        copyTemplateDe: "Anschließend mit Shampoo auswaschen.",
      },
    ],
    evidence: ctx.evidence.map((entry) => ({
      sourceUrl: entry.sourceUrl,
      sourceType: entry.sourceType,
      checkedAt: entry.checkedAt,
    })),
  }),
}

type ColumnDefinition = {
  applicationStage: (ctx: TemplateContext) => string
  applicationState: (ctx: TemplateContext) => ExpansionProtocolRow["application_state"]
  reapplication: ExpansionProtocolRow["reapplication"]
  /**
   * §2.4's single legitimate column/payload divergence: the pre-wash oil column
   * carries `shampoo_out` while the payload carries `rinse_out`, because the
   * product is washed out with shampoo rather than rinsed with water.
   */
  rinseActionOverride?: string
}

const COLUMN_DEFINITIONS: Record<ExpansionTemplateId, ColumnDefinition> = {
  "TPL-SHAMPOO-STD": {
    applicationStage: () => "wet_cleanse",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-SHAMPOO-TARGETED": {
    applicationStage: () => "wet_cleanse",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-SHAMPOO-DANDRUFF": {
    applicationStage: () => "wet_cleanse",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-CONDITIONER": {
    applicationStage: () => "post_cleanse_rinse_off",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-MASK": {
    applicationStage: () => "post_cleanse_rinse_off",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-LEAVEIN-DAMP": {
    applicationStage: () => "damp_leave_on",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-LEAVEIN-DRYCARE": {
    applicationStage: () => "dry_hair",
    applicationState: () => "dry",
    reapplication: "not_stated",
  },
  "TPL-LEAVEIN-HEAT": {
    applicationStage: heatStage,
    applicationState: heatState,
    // P7: heat protection is reapplied before every separate heat session.
    reapplication: "required",
  },
  "TPL-OIL-DRYFINISH": {
    applicationStage: () => "dry_finish",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-OIL-LEAVEON": {
    applicationStage: () => "damp_leave_on",
    applicationState: () => null,
    reapplication: "not_stated",
  },
  "TPL-OIL-HEAT": {
    applicationStage: heatStage,
    applicationState: heatState,
    reapplication: "required",
  },
  "TPL-OIL-PREWASH": {
    applicationStage: () => "pre_wash",
    applicationState: () => "dry",
    reapplication: "not_stated",
    rinseActionOverride: "shampoo_out",
  },
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Product Intake's spec-operation placeholder (category-validators.ts:47). */
const PRODUCT_ID_PLACEHOLDER = "__PRODUCT_ID__"
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const EVIDENCE_SOURCE_TYPES: ReadonlySet<string> = new Set([
  "manufacturer",
  "retailer",
  "professional_authority",
])

// §2.5 contact-time copy forms, mirroring the V2 builder's own regexes
// (stage5-v2-builder.ts:216-231) so a stamped mask cannot silently lose its time.
const WAIT_COPY_RANGE = /(\d+)\s*[–-]\s*(\d+)\s*Minuten/i
const WAIT_COPY_MAXIMUM = /bis zu\s*(\d+)\s*Minuten/i
const WAIT_COPY_EXACT = /(\d+)\s*(Minuten?|Sekunden?)/i

function normalizeSlots(
  templateId: ExpansionTemplateId,
  slots: ExpansionTemplateSlots,
): TemplateContext {
  const fail = (message: string): never => {
    throw new Error(`${templateId}: ${message}`)
  }

  if (typeof slots?.productId !== "string" || slots.productId.trim().length === 0) {
    fail("slots.productId is required (the product's uuid)")
  }
  const productId = slots.productId
  if (!UUID_PATTERN.test(productId) && productId !== PRODUCT_ID_PLACEHOLDER) {
    // §2.1: a payload that is not scoped to the real product uuid silently degrades
    // the stamped row to `verified_incomplete`.
    fail(`slots.productId must be a uuid or "${PRODUCT_ID_PLACEHOLDER}", got "${productId}"`)
  }

  if (!Array.isArray(slots.evidence) || slots.evidence.length === 0) {
    fail("slots.evidence requires at least one {sourceUrl, sourceType, checkedAt} entry")
  }
  slots.evidence.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") fail(`slots.evidence[${index}] must be an object`)
    if (typeof entry.sourceUrl !== "string" || entry.sourceUrl.trim().length === 0) {
      fail(`slots.evidence[${index}].sourceUrl is required`)
    }
    if (!EVIDENCE_SOURCE_TYPES.has(entry.sourceType)) {
      fail(
        `slots.evidence[${index}].sourceType must be one of ${[...EVIDENCE_SOURCE_TYPES].join(" | ")}, got "${entry.sourceType}"`,
      )
    }
    if (typeof entry.checkedAt !== "string" || !ISO_DATE_PATTERN.test(entry.checkedAt)) {
      fail(`slots.evidence[${index}].checkedAt must be YYYY-MM-DD`)
    }
  })

  const isMask = templateId === MASK_TEMPLATE_ID
  const isHeat = HEAT_TEMPLATE_IDS.has(templateId)

  if (!isMask && (slots.contactTimeSeconds !== undefined || slots.waitCopyDe !== undefined)) {
    fail("contactTimeSeconds / waitCopyDe are only valid for TPL-MASK")
  }
  if (!isHeat && slots.usableOnDryHair !== undefined) {
    fail("usableOnDryHair is only valid for TPL-LEAVEIN-HEAT / TPL-OIL-HEAT")
  }

  let contactTimeSeconds: number | null = null
  let waitCopyDe = ""
  if (isMask) {
    // P5: the mask has no default window — it is sourced per product, and a stamp
    // without a sourced contact time is invalid and must not be published.
    if (slots.contactTimeSeconds === undefined) {
      fail(
        "TPL-MASK requires slots.contactTimeSeconds (integer seconds, or null for a range/maximum)",
      )
    }
    const seconds = slots.contactTimeSeconds
    if (seconds !== null) {
      if (typeof seconds !== "number" || !Number.isInteger(seconds) || seconds <= 0) {
        fail(
          `TPL-MASK slots.contactTimeSeconds must be a positive integer or null, got ${String(seconds)}`,
        )
      }
    }
    if (typeof slots.waitCopyDe !== "string" || slots.waitCopyDe.trim().length === 0) {
      fail('TPL-MASK requires slots.waitCopyDe, e.g. "5–10 Minuten einwirken lassen."')
    }
    const copy = slots.waitCopyDe as string
    if (
      !WAIT_COPY_EXACT.test(copy) &&
      !WAIT_COPY_RANGE.test(copy) &&
      !WAIT_COPY_MAXIMUM.test(copy)
    ) {
      fail(
        `TPL-MASK slots.waitCopyDe must name a time in a §2.5 copy form; "Kurz einwirken lassen." is not stampable. Got "${copy}"`,
      )
    }
    if (
      (seconds ?? null) === null &&
      !WAIT_COPY_RANGE.test(copy) &&
      !WAIT_COPY_MAXIMUM.test(copy)
    ) {
      fail(
        `TPL-MASK slots.waitCopyDe must be a range ("5–10 Minuten einwirken lassen.") or maximum ("Bis zu 10 Minuten einwirken lassen.") form when contactTimeSeconds is null (§2.5). Got "${copy}"`,
      )
    }
    contactTimeSeconds = (seconds ?? null) as number | null
    waitCopyDe = copy
  }

  let usableOnDryHair = false
  if (isHeat) {
    if (typeof slots.usableOnDryHair !== "boolean") {
      fail(
        'TPL-LEAVEIN-HEAT / TPL-OIL-HEAT require slots.usableOnDryHair (true only on an explicit "nass oder trocken" source statement)',
      )
    }
    usableOnDryHair = slots.usableOnDryHair as boolean
  }

  return {
    productId,
    evidence: slots.evidence,
    contactTimeSeconds,
    waitCopyDe,
    usableOnDryHair,
  }
}

/**
 * Stamps `templateId` onto one product.
 *
 * Throws a descriptive Error when a required per-product slot is missing or invalid
 * for this template (unknown template id, no evidence, TPL-MASK without a sourced
 * contact time, a heat template without the researched damp/either fact).
 *
 * The §2.4 column↔payload invariants hold by construction: `placement`,
 * `contact_time_seconds` and `rinse_action` are all read back off the payload the
 * template just produced (with the one documented pre-wash-oil rinse exception).
 */
export function buildExpansionProtocolRow(
  templateId: ExpansionTemplateId,
  slots: ExpansionTemplateSlots,
): ExpansionProtocolRow {
  const meta = EXPANSION_TEMPLATE_META[templateId]
  const buildPayload = PAYLOAD_BUILDERS[templateId]
  const columns = COLUMN_DEFINITIONS[templateId]
  if (!meta || !buildPayload || !columns) {
    throw new Error(`unknown expansion template id: ${String(templateId)}`)
  }

  const ctx = normalizeSlots(templateId, slots)
  const guidancePayload = buildPayload(ctx)
  const protocolFacts = guidancePayload.protocolFacts as {
    applicationArea: string | null
    rinse: string | null
    contactTimeSeconds: number | null
  }

  return {
    category: meta.category,
    // The payload's own `role` is the SEMANTIC role vocabulary ("intensive_care",
    // "finish", …); the ROW's role column is the derived protocol role from
    // EXPANSION_TEMPLATE_META ("intensive_conditioning_mask", "dry_finish", …).
    role: meta.role,
    cadence: null,
    application_stage: columns.applicationStage(ctx),
    application_state: columns.applicationState(ctx),
    placement: protocolFacts.applicationArea,
    contact_time_seconds: protocolFacts.contactTimeSeconds,
    rinse_action: columns.rinseActionOverride ?? protocolFacts.rinse,
    reapplication: columns.reapplication,
    instruction_modifiers: [],
    guidance_payload: guidancePayload,
  }
}
