import { z } from "zod"
import { requiredProtocolRoles } from "@/lib/product-intake/category-validators"
import {
  buildExpansionProtocolRow,
  type ExpansionProtocolEvidence,
  type ExpansionTemplateSlots,
} from "@/lib/product-intake/expansion-apply-templates"
import type {
  ExpansionCategoryKey,
  ExpansionTemplateId,
} from "@/lib/product-intake/expansion-manifest"

export type ProtocolResearchDraft = {
  shampoo_scalp_condition_claim?: boolean | null
  mask_contact_time_seconds?: number | null
  mask_wait_copy_de?: string | null
  leave_in_explicit_dry_use_marketing?: boolean | null
  leave_in_post_style_finish?: boolean | null
  heat_usable_on_dry_hair?: boolean | null
  oil_spray_format?: boolean | null
  structural_deviation?: { reason: string; packaging_text: string } | null
  evidence?: Array<{
    sourceUrl: string
    sourceText: string
    sourceType: "manufacturer" | "retailer" | "professional_authority"
    checkedAt: string
  }>
}

export type ProtocolStageResult = {
  status: "templated" | "not_templated" | "blocked"
  templateIds: string[]
  rows: unknown[]
  blockers: string[]
  notes: string[]
}

export const PROTOCOL_SLOT_RESEARCH_CONTRACT: Record<string, unknown> = {
  output_path: "researched_payload.draft.protocol",
  templated_categories: ["shampoo", "conditioner", "mask", "leave_in", "oil"],
  instructions: [
    "For templated categories report sourced facts only in draft.protocol; never write protocol prose or final.category_specs.product_application_protocols. Chaarlie stamps normative templates deterministically.",
    "R-C: packaging never overrides Chaarlie guidance. Structural deviations mean a wrong category or application system (for example an overnight leave-on sold as a rinse-out mask). Packaging style differences (roots-to-tips, conditioner after mask, different ruled contact windows) are never deviations.",
    "P5: report the mask packaging time, exact seconds or null for a range/maximum, with matching German digit-form wait copy (§2.5). If no parseable packaging time exists, report both slots as null; W3 uses 3–5 Minuten einwirken lassen.",
    "R-D/W4: dry-care defaults to spray/serum light or medium, or light lotion. Cream/rich defaults to damp-only; explicit dry-use marketing qualifies regardless of format/weight. Report explicit dry use separately.",
    "P6: flag leave-in marketed as an after-styling finish; that family is parked for Nick.",
    "P9: heat_usable_on_dry_hair is required for heat-protecting leave-ins. True requires explicit dry-use authority, false means damp-only; unknown is null, never guessed.",
    "P3: scalp-condition claims include urea, sensitive/irritated or oily scalp; hair-fibre Repair, Volumen, Feuchtigkeit and Curl claims do not qualify.",
    "R-E/O3/O5: oil role_support must be sourced from German/EU directions; only dry-use authority supports dry_finish. Heat protection is a separate sourced capability on the ordinary leave-on oil purpose; provides_heat_protection=true requires sourced leave_on_fibre_conditioning role support and never an extra oil role.",
    "Provide evidence [{sourceUrl, sourceText: exact quoted German source sentence about application, sourceType: manufacturer|retailer|professional_authority, checkedAt: YYYY-MM-DD}]. Record the actual checked date, never infer it from the current date or a packaging date. final.sources alone has no typed source/date fields; prefer explicit draft evidence.",
    "For all other categories keep the existing model-written exact protocol rows unchanged.",
  ],
  slots: {
    shampoo_scalp_condition_claim: "boolean|null — sourced scalp-condition claim (P3)",
    mask_contact_time_seconds:
      "number|null — positive integer seconds for an exact packaging time; null for range/maximum or no time (P5). Chaarlie derives exact seconds from a single-time wait copy if needed.",
    mask_wait_copy_de:
      "string|null — full German wait step: 3 Minuten einwirken lassen., 30 Sekunden einwirken lassen., 2–3 Minuten einwirken lassen., Bis zu 10 Minuten einwirken lassen. (§2.5)",
    leave_in_explicit_dry_use_marketing: "boolean|null — explicit dry-hair use (R-D)",
    leave_in_post_style_finish: "boolean|null — after-styling finish positioning (P6, parked)",
    heat_usable_on_dry_hair: "boolean|null — explicit dry-hair heat use (P9)",
    oil_spray_format:
      "boolean|null — sourced pump-spray oil format; true parks dosing pending X6 ruling",
    structural_deviation: "{reason: string, packaging_text: string}|null — structural only (R-C)",
    evidence:
      "Array<{sourceUrl: string, sourceText: string (exact quoted German application sentence), sourceType: manufacturer|retailer|professional_authority, checkedAt: YYYY-MM-DD}>",
  },
}

const TEMPLATED_CATEGORIES = new Set<string>(["shampoo", "conditioner", "mask", "leave_in", "oil"])
const evidenceSchema = z
  .array(
    z.object({
      sourceUrl: z.string().url(),
      sourceType: z.enum(["manufacturer", "retailer", "professional_authority"]),
      checkedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .min(1)

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

type ProtocolEvidence = ExpansionProtocolEvidence & { sourceText?: string }

function normalizedSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "")
    url.hash = ""
    url.pathname = url.pathname.replace(/\/+$/, "")
    return url.toString().replace(/\/$/, "")
  } catch {
    return null
  }
}

function fallbackEvidence(sources: Record<string, unknown>[]): ProtocolEvidence[] {
  return sources.flatMap((source) => {
    // §2.3: final.sources has only url/title/evidence; require explicit source kind and checked date.
    const label = typeof source.title === "string" ? source.title : ""
    const text = typeof source.evidence === "string" ? source.evidence : ""
    const sourceType = /\b(manufacturer|hersteller)\b/i.test(label)
      ? ("manufacturer" as const)
      : /\b(retailer|händler|haendler)\b/i.test(label)
        ? ("retailer" as const)
        : null
    const checkedAt = text.match(
      /(?:checked(?:\s+(?:at|on))?|geprüft(?:\s+am)?|abgerufen(?:\s+am)?)\s*:?\s*(\d{4}-\d{2}-\d{2})/i,
    )?.[1]
    if (!sourceType || !checkedAt || typeof source.url !== "string") return []
    const entry = { sourceUrl: source.url, sourceType, checkedAt, sourceText: text }
    return evidenceSchema.safeParse([entry]).success ? [entry] : []
  })
}

function maskSlots(
  draft: ProtocolResearchDraft | null,
  notes: string[],
): Pick<ExpansionTemplateSlots, "contactTimeSeconds" | "waitCopyDe"> {
  const seconds = draft?.mask_contact_time_seconds ?? null
  const copy = draft?.mask_wait_copy_de?.trim() ?? ""
  // P5/§2.5: exact seconds must agree with the copy; range/maximum copy keeps seconds null.
  const range = copy.match(/(\d+)\s*[–-]\s*(\d+)\s*Minuten/i)
  const maximum = copy.match(/bis zu\s*(\d+)\s*Minuten/i)
  const exact = copy.match(/(\d+)\s*(Minuten?|Sekunden?)/i)
  if (seconds === null && !range && !maximum && !exact) {
    // W3: no parseable packaging time uses the ruled fallback (amends the older P5 no-default text).
    notes.push("mask_wait_fallback_w3")
    return { contactTimeSeconds: null, waitCopyDe: "3–5 Minuten einwirken lassen." }
  }
  if (
    seconds !== null &&
    (range ||
      maximum ||
      (exact && seconds !== Number(exact[1]) * (/^Minute/i.test(exact[2]) ? 60 : 1)))
  ) {
    throw new Error("TPL-MASK: contact time seconds and German wait copy disagree (§2.5)")
  }
  return {
    contactTimeSeconds:
      seconds ??
      (exact && !range && !maximum
        ? Number(exact[1]) * (/^Minute/i.test(exact[2]) ? 60 : 1)
        : null),
    waitCopyDe: copy,
  }
}

export function runProtocolStage(input: {
  categoryKey: string
  categorySpecs: Record<string, unknown>
  draft: ProtocolResearchDraft | null
  sources: unknown
  productId?: string
}): ProtocolStageResult {
  const { categoryKey, categorySpecs, draft } = input
  if (!TEMPLATED_CATEGORIES.has(categoryKey)) {
    return {
      status: "not_templated",
      templateIds: [],
      blockers: [],
      notes: [],
      rows: Array.isArray(categorySpecs.product_application_protocols)
        ? categorySpecs.product_application_protocols
        : [],
    }
  }

  const templateIds: ExpansionTemplateId[] = []
  const blockers: string[] = []
  const notes: string[] = []
  // R-C: only a researched structural mismatch pauses normative stamping.
  if (draft?.structural_deviation)
    blockers.push(`protocol_structural_deviation: ${draft.structural_deviation.reason}`)
  // P6: post-style leave-in finish remains parked, even if other slots are complete.
  if (categoryKey === "leave_in" && draft?.leave_in_post_style_finish === true) {
    blockers.push(
      "protocol_parked_post_style: leave-in positioned as after-styling finish — needs Nick (P6)",
    )
  }
  // X6: pump-spray format is a sourced draft slot, not a canonical oil-spec column.
  if (categoryKey === "oil" && draft?.oil_spray_format === true) {
    blockers.push("protocol_parked_spray_oil (X6)")
  }

  const sources = Array.isArray(input.sources) ? input.sources.map(asRecord) : []
  const evidence = draft?.evidence?.length ? draft.evidence : fallbackEvidence(sources)
  if (evidence.length === 0) blockers.push("protocol_evidence_missing")

  try {
    const roles = requiredProtocolRoles(categoryKey as ExpansionCategoryKey, categorySpecs)
    if (
      categoryKey === "oil" &&
      asRecord(categorySpecs.product_oil_specs).provides_heat_protection === true &&
      !roles?.includes("leave_on_fibre_conditioning")
    ) {
      blockers.push("protocol_oil_heat_without_leave_on")
    }
    if (!Array.isArray(roles) || roles.length === 0) blockers.push("protocol_roles_missing")
    else {
      for (const role of new Set(roles)) {
        switch (categoryKey) {
          case "conditioner":
            // P2: every rinse-out conditioner uses the normative conditioner template.
            templateIds.push("TPL-CONDITIONER")
            break
          case "mask":
            // P5: mask replaces conditioner; only its contact-time slot is researched.
            templateIds.push("TPL-MASK")
            break
          case "leave_in": {
            const specs = asRecord(categorySpecs.product_leave_in_specs)
            if (role === "pre_heat_protection") {
              // P9/R-E: derived heat capability selects one damp/either template with a required slot.
              templateIds.push("TPL-LEAVEIN-HEAT")
              if (typeof draft?.heat_usable_on_dry_hair !== "boolean")
                blockers.push("protocol_slot_missing: heat_usable_on_dry_hair")
            } else {
              // P6/R-D/W4: default DAMP plus optional DRYCARE, sharing post_wash_leave_in as in expansion.
              templateIds.push("TPL-LEAVEIN-DAMP")
              const dryDefault =
                ((specs.format === "spray" || specs.format === "serum") &&
                  (specs.weight === "light" || specs.weight === "medium")) ||
                (specs.format === "lotion" && specs.weight === "light")
              if (dryDefault || draft?.leave_in_explicit_dry_use_marketing === true)
                templateIds.push("TPL-LEAVEIN-DRYCARE")
            }
            break
          }
          case "oil": {
            // P8/O1–O5/R-E: one template per sourced role; heat capability never adds an Oil role.
            const oilTemplates: Record<string, ExpansionTemplateId> = {
              dry_finish: "TPL-OIL-DRYFINISH",
              leave_on_fibre_conditioning: "TPL-OIL-LEAVEON",
              pre_wash_fibre_treatment: "TPL-OIL-PREWASH",
            }
            const templateId = oilTemplates[role]
            if (!templateId) throw new Error(`unsupported oil protocol role: ${role}`)
            templateIds.push(templateId)
            break
          }
          case "shampoo": {
            // P1/P3/P4: TARGETED only for an explicit sourced scalp-condition claim (P3 is
            // claim-based; reviewed buckets alone do not qualify); schuppen → DANDRUFF.
            templateIds.push(
              role === "shampoo_dandruff"
                ? "TPL-SHAMPOO-DANDRUFF"
                : draft?.shampoo_scalp_condition_claim === true
                  ? "TPL-SHAMPOO-TARGETED"
                  : "TPL-SHAMPOO-STD",
            )
            break
          }
        }
      }
    }
    if (blockers.length) return { status: "blocked", templateIds, rows: [], blockers, notes }
    const checkedEvidence = evidenceSchema.parse(evidence)
    const chosen = checkedEvidence[0]
    const chosenUrl = normalizedSourceUrl(chosen.sourceUrl)
    const source = sources.find(
      (entry) => chosenUrl !== null && normalizedSourceUrl(entry.url) === chosenUrl,
    )
    const quotedText = evidence[0]?.sourceText
    const sourceText =
      typeof quotedText === "string" && quotedText.trim()
        ? quotedText
        : typeof source?.evidence === "string" && source.evidence.trim()
          ? source.evidence
          : null
    if (!sourceText)
      return {
        status: "blocked",
        templateIds,
        rows: [],
        blockers: ["protocol_source_text_missing"],
        notes,
      }
    const sourceLabels = {
      manufacturer: "Hersteller",
      retailer: "Händler",
      professional_authority: "Fachquelle",
    }
    const rows = templateIds.map((templateId) => {
      const slots: ExpansionTemplateSlots = {
        productId: input.productId ?? "__PRODUCT_ID__",
        evidence: checkedEvidence,
      }
      if (templateId === "TPL-MASK") Object.assign(slots, maskSlots(draft, notes))
      if (templateId === "TPL-LEAVEIN-HEAT")
        slots.usableOnDryHair = draft!.heat_usable_on_dry_hair as boolean
      const row = buildExpansionProtocolRow(templateId, slots)
      // §2.4 / oil templates: the builder defaults to lengths_ends; rich weight is caller-owned.
      if (categoryKey === "oil" && asRecord(categorySpecs.product_oil_specs).weight === "rich") {
        row.placement = "ends"
        const facts = asRecord(row.guidance_payload.protocolFacts)
        facts.applicationArea = "ends"
        if (templateId === "TPL-OIL-PREWASH") {
          const dose =
            "Fein: mit 1 Tropfen starten; normal: 1 Tropfen; kräftig: 2 Tropfen. Vollständig zwischen den Handflächen anwärmen und sehr dünn verteilen."
          asRecord(facts.amount).copyDe = dose
          const steps = row.guidance_payload.steps as Record<string, unknown>[]
          const doseStep = steps.find((step) => step.stepKey === "dose-pre-wash")!
          doseStep.copyTemplateDe = dose
        }
      }
      return {
        ...row,
        source_label:
          typeof source?.title === "string" && source.title.trim()
            ? source.title
            : sourceLabels[chosen.sourceType],
        source_url: chosen.sourceUrl,
        source_text: sourceText,
      }
    })
    return { status: "templated", templateIds, rows, blockers: [], notes }
  } catch (error) {
    blockers.push(
      `protocol_slot_invalid: ${error instanceof Error ? error.message : String(error)}`,
    )
    return { status: "blocked", templateIds, rows: [], blockers, notes }
  }
}
