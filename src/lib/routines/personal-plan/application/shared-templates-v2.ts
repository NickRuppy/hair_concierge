import { applicationFamilyTemplateV2Schema, type ApplicationFamilyTemplateV2 } from "./contracts-v2"
import type {
  ApplicationDayTypeKey,
  ApplicationFamily,
  PersonalPlanCategory,
  SemanticRole,
} from "./contracts"

type Step = ApplicationFamilyTemplateV2["steps"][number]
type Anchor = ApplicationFamilyTemplateV2["sequence"]["anchor"]

const authorityEvidence = [
  {
    sourceUrl: "https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips",
    sourceType: "professional_authority" as const,
    checkedAt: "2026-08-12",
  },
]

function template(input: {
  guidanceKey: string
  category: PersonalPlanCategory
  role: SemanticRole
  applicationFamily: ApplicationFamily
  compatibleDayTypes: ApplicationDayTypeKey[]
  anchor: Anchor
  steps: Step[]
}): ApplicationFamilyTemplateV2 {
  return applicationFamilyTemplateV2Schema.parse({
    schemaVersion: 2,
    contractKind: "family_template",
    guidanceKey: input.guidanceKey,
    protocolVersion: 2,
    locale: "de",
    scope: { kind: "application_family", category: input.category },
    role: input.role,
    applicationFamily: input.applicationFamily,
    compatibleDayTypes: input.compatibleDayTypes,
    sequence: { anchor: input.anchor, before: [], after: [], conflictsWith: [] },
    steps: input.steps,
    evidence: authorityEvidence,
  })
}

const wetScalpCleanse: Step[] = [
  {
    stepKey: "wet",
    action: "section",
    copyTemplateDe: "Haare und Kopfhaut vollständig anfeuchten.",
  },
  {
    stepKey: "cleanse",
    action: "apply_product",
    copyTemplateDe:
      "Eine kleine Menge auf die Kopfhaut geben und sanft einmassieren. Die Längen werden beim Ausspülen mitgereinigt.",
  },
  { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
]

const heatDays: ApplicationDayTypeKey[] = [
  "wash_day",
  "intensive_care_day",
  "bond_repair_day",
  "clarifying_wash_day",
  "refresh_day",
  "between_wash_care_day",
  "styling_day",
]

const dampHeatSteps: Step[] = [
  {
    stepKey: "apply",
    action: "apply_product",
    copyTemplateDe:
      "Gleichmäßig auf handtuchtrockenem Haar verteilen. Erst danach föhnen oder stylen.",
  },
]

const dryHeatSteps: Step[] = [
  {
    stepKey: "apply",
    action: "apply_product",
    copyTemplateDe:
      "Gleichmäßig auf vollständig trockenem Haar verteilen. Erst danach das heiße Tool verwenden.",
  },
]

export const SHARED_APPLICATION_TEMPLATES_V2 = [
  template({
    guidanceKey: "shampoo.standard-scalp-cleanse.v2",
    category: "shampoo",
    role: "cleanse",
    applicationFamily: "standard_rinse_out_cleanse",
    compatibleDayTypes: ["wash_day"],
    anchor: "wet_cleanse",
    steps: wetScalpCleanse,
  }),
  template({
    guidanceKey: "shampoo.targeted-scalp-cleanse.v2",
    category: "shampoo",
    role: "cleanse",
    applicationFamily: "targeted_treatment_shampoo",
    compatibleDayTypes: ["wash_day"],
    anchor: "wet_cleanse",
    steps: [
      ...wetScalpCleanse.slice(0, 2),
      {
        stepKey: "wait",
        action: "wait",
        copyTemplateDe: "{{contact_time_de}} einwirken lassen.",
      },
      wetScalpCleanse[2]!,
    ],
  }),
  template({
    guidanceKey: "conditioner.standard-rinse-out.v2",
    category: "conditioner",
    role: "condition",
    applicationFamily: "standard_rinse_out_conditioning",
    compatibleDayTypes: [
      "wash_day",
      "intensive_care_day",
      "bond_repair_day",
      "clarifying_wash_day",
    ],
    anchor: "post_cleanse_rinse_off",
    steps: [
      {
        stepKey: "remove-water",
        action: "section",
        copyTemplateDe: "Überschüssiges Wasser sanft aus dem Haar drücken.",
      },
      {
        stepKey: "condition",
        action: "apply_product",
        copyTemplateDe: "Eine kleine Menge gleichmäßig in Längen und Spitzen verteilen.",
      },
      {
        stepKey: "wait",
        action: "wait",
        copyTemplateDe: "{{contact_time_de}} einwirken lassen.",
      },
      { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
    ],
  }),
  template({
    guidanceKey: "leave-in.damp.v2",
    category: "leave_in",
    role: "leave_in",
    applicationFamily: "post_wash_booster",
    compatibleDayTypes: [
      "wash_day",
      "intensive_care_day",
      "bond_repair_day",
      "clarifying_wash_day",
    ],
    anchor: "damp_leave_on",
    steps: [
      {
        stepKey: "towel-dry",
        action: "section",
        copyTemplateDe: "Das Haar nach dem Waschen sanft handtuchtrocknen.",
      },
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Eine kleine Menge in den Händen verteilen und in Längen und Spitzen einarbeiten. Nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "leave-in.damp-conditioning.v2",
    category: "leave_in",
    role: "leave_in",
    applicationFamily: "post_wash_damp_conditioning",
    compatibleDayTypes: [
      "wash_day",
      "intensive_care_day",
      "bond_repair_day",
      "clarifying_wash_day",
    ],
    anchor: "damp_leave_on",
    steps: [
      {
        stepKey: "towel-dry",
        action: "section",
        copyTemplateDe: "Das Haar nach dem Waschen sanft handtuchtrocknen.",
      },
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Eine kleine Menge in den Händen verteilen und in Längen und Spitzen einarbeiten. Nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "leave-in.damp-refresh.v2",
    category: "leave_in",
    role: "leave_in",
    applicationFamily: "between_wash_damp_refresh",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    anchor: "damp_leave_on",
    steps: [
      {
        stepKey: "refresh",
        action: "apply_product",
        copyTemplateDe:
          "Die betroffenen {{application_area_de}} leicht anfeuchten. Eine sehr kleine Menge in den Händen verteilen und gezielt in {{application_area_de}} einarbeiten. Ansatz und Kopfhaut aussparen. Nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "leave-in.dry-care.v2",
    category: "leave_in",
    role: "leave_in",
    applicationFamily: "between_wash_dry_care",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "dry-care",
        action: "apply_product",
        copyTemplateDe:
          "Mit einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen.",
      },
    ],
  }),
  template({
    guidanceKey: "oil.finish.damp-refresh.v2",
    category: "oil",
    role: "finish",
    applicationFamily: "between_wash_damp_refresh",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    anchor: "damp_leave_on",
    steps: [
      {
        stepKey: "oil-damp-care",
        action: "apply_product",
        copyTemplateDe:
          "Die betroffenen {{application_area_de}} mit feuchten Händen leicht anfeuchten. Einen Tropfen oder eine sehr kleine Menge vollständig in den Handflächen verteilen und nur in {{application_area_de}} drücken. Ansatz und Kopfhaut aussparen. Nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "oil.finish.dry-care.v2",
    category: "oil",
    role: "finish",
    applicationFamily: "between_wash_dry_care",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "dry-care",
        action: "apply_product",
        copyTemplateDe:
          "Mit 1 Tropfen oder einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen.",
      },
    ],
  }),
  template({
    guidanceKey: "oil.leave-in.damp-refresh.v2",
    category: "oil",
    role: "leave_in",
    applicationFamily: "between_wash_damp_refresh",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    anchor: "damp_leave_on",
    steps: [
      {
        stepKey: "oil-damp-care",
        action: "apply_product",
        copyTemplateDe:
          "Die betroffenen {{application_area_de}} mit feuchten Händen leicht anfeuchten. Einen Tropfen oder eine sehr kleine Menge vollständig in den Handflächen verteilen und nur in {{application_area_de}} drücken. Ansatz und Kopfhaut aussparen. Nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "oil.leave-in.dry-care.v2",
    category: "oil",
    role: "leave_in",
    applicationFamily: "between_wash_dry_care",
    compatibleDayTypes: ["refresh_day", "between_wash_care_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "dry-care",
        action: "apply_product",
        copyTemplateDe:
          "Mit 1 Tropfen oder einer sehr kleinen Menge in trockenen {{application_area_de}} beginnen und nur bei Bedarf ergänzen.",
      },
    ],
  }),
  template({
    guidanceKey: "leave-in.post-style-finish.v2",
    category: "leave_in",
    role: "leave_in",
    applicationFamily: "post_style_finish",
    compatibleDayTypes: ["styling_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "post-style-finish",
        action: "apply_product",
        copyTemplateDe:
          "Mit einer sehr kleinen Menge beginnen und nach dem Styling sparsam über Längen und Spitzen geben.",
      },
    ],
  }),
  template({
    guidanceKey: "mask.rinse-out.v2",
    category: "mask",
    role: "intensive_care",
    applicationFamily: "post_shampoo_rinse_out_mask",
    compatibleDayTypes: ["intensive_care_day"],
    anchor: "timed_treatment",
    steps: [
      {
        stepKey: "remove-water",
        action: "section",
        copyTemplateDe: "Nach dem Shampoo überschüssiges Wasser sanft ausdrücken.",
      },
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe: "Die Maske gleichmäßig in Längen und Spitzen verteilen.",
      },
      {
        stepKey: "wait",
        action: "wait",
        copyTemplateDe: "{{contact_time_de}} einwirken lassen.",
      },
      { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
    ],
  }),
  template({
    guidanceKey: "oil.dry-finish.v2",
    category: "oil",
    role: "finish",
    applicationFamily: "dry_finish",
    compatibleDayTypes: heatDays,
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "finish",
        action: "apply_product",
        copyTemplateDe:
          "Mit 1 Tropfen oder einer sehr kleinen Menge beginnen, in den Händen verteilen und in Spitzen und trockene Längen geben. Nur bei Bedarf ergänzen.",
      },
    ],
  }),
  template({
    guidanceKey: "oil.damp.v2",
    category: "oil",
    role: "leave_in",
    applicationFamily: "post_wash_damp_conditioning",
    compatibleDayTypes: [
      "wash_day",
      "intensive_care_day",
      "bond_repair_day",
      "clarifying_wash_day",
    ],
    anchor: "damp_leave_on",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Sparsam in handtuchtrockene Längen und Spitzen verteilen. Nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "oil.pre-wash.v2",
    category: "oil",
    role: "intensive_care",
    applicationFamily: "pre_wash_lengths_treatment",
    compatibleDayTypes: ["intensive_care_day"],
    anchor: "pre_wash",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe: "In Längen und Spitzen verteilen.",
      },
      {
        stepKey: "wait",
        action: "wait",
        copyTemplateDe: "{{contact_time_de}} einwirken lassen.",
      },
      { stepKey: "cleanse", action: "section", copyTemplateDe: "Danach shampoonieren." },
    ],
  }),
  template({
    guidanceKey: "deep-cleanse.standard-reset.v2",
    category: "deep_cleansing_shampoo",
    role: "reset_cleanse",
    applicationFamily: "reset_cleanse",
    compatibleDayTypes: ["clarifying_wash_day"],
    anchor: "wet_cleanse",
    steps: wetScalpCleanse,
  }),
  template({
    guidanceKey: "dry-shampoo.aerosol.v2",
    category: "dry_shampoo",
    role: "refresh",
    applicationFamily: "aerosol_spray",
    compatibleDayTypes: ["refresh_day"],
    anchor: "dry_finish",
    steps: [
      { stepKey: "shake", action: "section", copyTemplateDe: "Dose kräftig schütteln." },
      {
        stepKey: "spray",
        action: "apply_product",
        copyTemplateDe:
          "Trockenes Haar scheiteln und sparsam aus Abstand auf fettige Ansätze sprühen.",
      },
      {
        stepKey: "finish",
        action: "section",
        copyTemplateDe:
          "Nach der angegebenen Zeit mit den Fingerspitzen verteilen und Überschüsse ausbürsten.",
      },
    ],
  }),
  template({
    guidanceKey: "dry-shampoo.foam.v2",
    category: "dry_shampoo",
    role: "refresh",
    applicationFamily: "foam",
    compatibleDayTypes: ["refresh_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Eine kleine Menge auf die trockenen Ansätze geben, verteilen, trocknen lassen und anschließend stylen.",
      },
    ],
  }),
  template({
    guidanceKey: "dry-shampoo.liquid-to-dry.v2",
    category: "dry_shampoo",
    role: "refresh",
    applicationFamily: "liquid_to_dry",
    compatibleDayTypes: ["refresh_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe: "Sparsam auf die trockenen Ansätze geben.",
      },
      {
        stepKey: "wait",
        action: "wait",
        copyTemplateDe: "{{contact_time_de}} warten, einmassieren und anschließend stylen.",
      },
    ],
  }),
  template({
    guidanceKey: "heat.damp.heat-protectant.v2",
    category: "heat_protectant",
    role: "heat_protection",
    applicationFamily: "pre_heat_damp",
    compatibleDayTypes: heatDays,
    anchor: "damp_leave_on",
    steps: dampHeatSteps,
  }),
  template({
    guidanceKey: "heat.dry.heat-protectant.v2",
    category: "heat_protectant",
    role: "heat_protection",
    applicationFamily: "pre_heat_dry",
    compatibleDayTypes: heatDays,
    anchor: "dry_pre_heat",
    steps: dryHeatSteps,
  }),
  template({
    guidanceKey: "heat.damp.leave-in.v2",
    category: "leave_in",
    role: "heat_protection",
    applicationFamily: "pre_heat_damp",
    compatibleDayTypes: heatDays,
    anchor: "damp_leave_on",
    steps: dampHeatSteps,
  }),
  template({
    guidanceKey: "heat.dry.leave-in.v2",
    category: "leave_in",
    role: "heat_protection",
    applicationFamily: "pre_heat_dry",
    compatibleDayTypes: heatDays,
    anchor: "dry_pre_heat",
    steps: dryHeatSteps,
  }),
  template({
    guidanceKey: "heat.damp.oil.v2",
    category: "oil",
    role: "heat_protection",
    applicationFamily: "pre_heat_damp",
    compatibleDayTypes: heatDays,
    anchor: "damp_leave_on",
    steps: dampHeatSteps,
  }),
  template({
    guidanceKey: "heat.dry.oil.v2",
    category: "oil",
    role: "heat_protection",
    applicationFamily: "pre_heat_dry",
    compatibleDayTypes: heatDays,
    anchor: "dry_pre_heat",
    steps: dryHeatSteps,
  }),
  template({
    guidanceKey: "scalp.leave-on.v2",
    category: "scalp_care",
    role: "scalp_care",
    applicationFamily: "leave_on_scalp_care",
    compatibleDayTypes: ["between_wash_care_day"],
    anchor: "dry_finish",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe:
          "Scheitelweise sparsam direkt auf die saubere Kopfhaut geben, sanft verteilen und nicht ausspülen.",
      },
    ],
  }),
  template({
    guidanceKey: "scalp.rinse-off.v2",
    category: "scalp_care",
    role: "scalp_care",
    applicationFamily: "rinse_off_scalp_care",
    compatibleDayTypes: ["wash_day"],
    anchor: "pre_wash",
    steps: [
      {
        stepKey: "apply",
        action: "apply_product",
        copyTemplateDe: "Scheitelweise auf die Kopfhaut geben und sanft verteilen.",
      },
      {
        stepKey: "wait",
        action: "wait",
        copyTemplateDe: "{{contact_time_de}} einwirken lassen.",
      },
      { stepKey: "rinse", action: "rinse", copyTemplateDe: "Gründlich ausspülen." },
    ],
  }),
] as const

export const SHARED_APPLICATION_TEMPLATE_BY_KEY_V2 = new Map(
  SHARED_APPLICATION_TEMPLATES_V2.map((entry) => [entry.guidanceKey, entry]),
)
