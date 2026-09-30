import type {
  DiscoveryCockpitIntakeProductView,
  DiscoveryCockpitModel,
  DiscoveryCockpitStepView,
  DiscoveryCockpitUnassignedView,
  DiscoveryCockpitVerdictView,
  DiscoveryCockpitView,
} from "../../../src/lib/discovery/cockpit"
import type { ConsultInputSource } from "../../../src/lib/discovery/consult-brief/input"
import {
  consultBriefSource,
  type ConsultBriefSource,
} from "../../../src/lib/discovery/consult-brief/source"
import type { DiscoveryHeatStylingV1 } from "../../../src/lib/discovery/heat-styling"
import type { DiscoveryQuizAnswers } from "../../../src/lib/discovery/quiz-answers"
import type { PersonalPlanCategory } from "../../../src/lib/personal-plan/products/contracts"
import type { DiagnosticConcern } from "../../../src/lib/quiz/diagnostic-input"
import type { ScanPresentedVerdictPayload, ScanVerdict } from "../../../src/lib/scan/types"

/**
 * The consult brief's golden profiles (consult-agent T5): three synthetic enrollments in the
 * shape `consultBriefSource` consumes (cockpit model + view, quiz answers, call sheet). The
 * eval lane (`npm run test:consult-brief`) sends them to the real model; the recorded-fixture
 * test pins the parse/lint path over one real answer.
 *
 * Brands are invented on purpose (none is in `CONSULT_MARKET_BRANDS`): the eval's
 * "no product outside the input" check then sees any real-world brand as a leak.
 *
 * Profile facts the input has no field for (density, length) are documented, not encoded.
 */

export type ConsultGoldenProfileId = "nomi" | "oily-overwash" | "curly-breakage" | "colored-frizz"

export type ConsultGoldenProfile = {
  id: ConsultGoldenProfileId
  /** One German line for the eval output. */
  summary: string
  /** Facts from the profile brief that the input has no field for. */
  notEncoded: string[]
  parts: {
    /** Only the profile side `assembleConsultInput` reads; the rest of the model is unused. */
    model: ConsultInputSource["model"]
    view: DiscoveryCockpitView
    quiz: DiscoveryQuizAnswers
    callSheet: { baselineScore: number | null }
  }
}

// --- builders (the pattern of tests/discovery-consult-input.test.ts) -----------------------

function inCatalog(
  verdict: ScanVerdict,
  product: { name: string; brand: string | null },
  verdictLabel: string,
): DiscoveryCockpitVerdictView {
  return {
    status: "verdict",
    product: { productId: `p-${product.name}`, ...product } as never,
    payload: {
      kind: "in_catalog",
      verdict,
      verdictLabel,
      verdictTitle: verdictLabel,
      status: "neutral",
      subtitle: "",
      evaluatedRole: null,
      evaluatedRoleLabel: null,
      dimensions: [],
      criteria: [],
      coverage: null,
      fitNarrative: null,
      alternatives: [],
    } satisfies ScanPresentedVerdictPayload,
    propertyRows: [],
  }
}

type StepInput = Partial<DiscoveryCockpitStepView> & {
  decisionKey: string
  category: PersonalPlanCategory
  categoryLabel: string
}

function step(input: StepInput): DiscoveryCockpitStepView {
  return {
    roleLabel: input.categoryLabel,
    roleDescription: null,
    frequencyLabel: "2× pro Woche",
    depth: null,
    section: "basis",
    outcome: input.intakeItemId ? "undecided" : "ideal",
    ownedLabel: null,
    intakeItemId: null,
    ownedProductId: null,
    ownedUsageRole: null,
    stepEntryCount: 1,
    ownedFrequencyLabel: null,
    ownedFrequency: null,
    idealAllowedRange: null,
    canDrop: false,
    unanswered: false,
    verdict: null,
    swapOptions: [],
    swapProductId: null,
    swapProductLabel: null,
    idealRecommendation: null,
    recommendationLabel: null,
    ownedUsageLabel: null,
    ownedImageUrl: null,
    swapProductImageUrl: null,
    recommendationImageUrl: null,
    usageDifference: null,
    ...input,
  }
}

function option(productId: string, label: string) {
  return {
    productId,
    name: label,
    brand: null,
    label,
    verdictLabel: "Passt",
    origin: "alternative" as const,
    propertyRows: null,
    priceLabel: null,
    imageUrl: null,
  }
}

function recommendation(productId: string, label: string) {
  return { ...option(productId, label), origin: "ideal_recommendation" as const }
}

function intakeProduct(
  itemId: string,
  category: PersonalPlanCategory,
  label: string,
  frequency: DiscoveryCockpitIntakeProductView["frequency"],
): DiscoveryCockpitIntakeProductView {
  return {
    itemId,
    category,
    usageRole: null,
    productType: null,
    frequency,
    frequencyLabel: null,
    typeOpen: false,
    productName: label,
    label,
    imageUrl: null,
    status: "in_catalog",
    statusLabel: "",
    canStartResearch: false,
  }
}

function view(
  steps: DiscoveryCockpitStepView[],
  intakeProducts: DiscoveryCockpitIntakeProductView[],
  unassigned: DiscoveryCockpitUnassignedView[] = [],
): DiscoveryCockpitView {
  // The input reads steps, unassigned and intakeProducts only; the rest of the view is unused.
  return { steps, unassigned, intakeProducts } as unknown as DiscoveryCockpitView
}

function quiz(concerns: DiagnosticConcern[], mainConcern: DiagnosticConcern): DiscoveryQuizAnswers {
  return { status: "ready", kind: "personal_plan", groups: [], concerns, mainConcern }
}

// --- nomi -----------------------------------------------------------------------------------

const NOMI_HEAT: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: ["curling_or_wave_iron"],
  heatEvents: {
    "heat:ordinary_blow_dry": { frequency: "weekly_3_4x" },
    "heat:curling_or_wave_iron": { frequency: "weekly_2x", protectionConsistency: "sometimes" },
  },
}

const NOMI: ConsultGoldenProfile = {
  id: "nomi",
  summary:
    "Blondiert, fein, reißt sofort; trockene Kopfhaut mit Trockenschuppen; Hauptproblem strapaziert; Lockenstab 2×/Woche, Hitzeschutz manchmal.",
  notEncoded: ["dicht (Dichte)", "lang (Länge)"],
  parts: {
    model: {
      concernProfileFacts: {
        hair_texture: "straight",
        thickness: "fine",
        scalp_type: "dry",
        chemical_treatment: ["lightened"],
        damaged: true,
        heat_styling: true,
      },
      hairElasticity: "snaps",
      heatStyling: NOMI_HEAT,
      consultFacts: {
        concerns: ["hair_damage", "dry_lengths"],
        scalpConcerns: ["dry_dandruff"],
        profileHeatTools: ["curling_iron"],
        currentWashFrequency: "weekly_3_4x",
        idealWashFrequency: "weekly_3_4x",
        hairLossBoundary: false,
      },
    },
    view: view(
      [
        step({
          decisionKey: "shampoo:shampoo_everyday:none",
          category: "shampoo",
          categoryLabel: "Shampoo",
          intakeItemId: "nomi-shampoo",
          ownedLabel: "Klarwerk Anti-Schuppen Shampoo",
          verdict: inCatalog(
            "mismatch",
            { name: "Anti-Schuppen Shampoo", brand: "Klarwerk" },
            "Passt nicht",
          ),
          swapOptions: [option("prod-sanft-mild", "Sanftwerk Mild Shampoo")],
        }),
        step({
          decisionKey: "conditioner:conditioner_rinse_out:none",
          category: "conditioner",
          categoryLabel: "Conditioner",
          idealRecommendation: recommendation("prod-leicht-spuelung", "Leichtwerk Feuchte Spülung"),
          recommendationLabel: "Leichtwerk Feuchte Spülung",
        }),
        step({
          decisionKey: "mask:mask_intensive:none",
          category: "mask",
          categoryLabel: "Maske",
          frequencyLabel: "1× pro Woche",
          intakeItemId: "nomi-mask",
          ownedLabel: "Butterhaus Reichhaltige Maske",
          verdict: inCatalog(
            "mismatch",
            { name: "Reichhaltige Maske", brand: "Butterhaus" },
            "Passt nicht",
          ),
          swapOptions: [option("prod-leicht-maske", "Leichtwerk Feuchte Maske")],
        }),
        step({
          decisionKey: "oil:oil_finish:none",
          category: "oil",
          categoryLabel: "Öl",
          intakeItemId: "nomi-oil",
          ownedLabel: "Glanzhain Haaröl",
          verdict: inCatalog("unknown", { name: "Haaröl", brand: "Glanzhain" }, "Unklar"),
        }),
      ],
      [
        intakeProduct("nomi-shampoo", "shampoo", "Klarwerk Anti-Schuppen Shampoo", "weekly_3_4x"),
        intakeProduct("nomi-mask", "mask", "Butterhaus Reichhaltige Maske", "weekly_2x"),
        intakeProduct("nomi-oil", "oil", "Glanzhain Haaröl", "weekly_3_4x"),
      ],
    ),
    quiz: quiz(["hair_damage", "dry_lengths"], "hair_damage"),
    callSheet: { baselineScore: 4 },
  },
}

// --- oily-overwash --------------------------------------------------------------------------

const OILY_HEAT: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["ordinary_blow_dry"],
  additionalHeatTools: [],
  heatEvents: { "heat:ordinary_blow_dry": { frequency: "daily_1x" } },
}

const OILY_OVERWASH: ConsultGoldenProfile = {
  id: "oily-overwash",
  summary:
    "Fettige Kopfhaut, wäscht täglich mit starkem Shampoo; Hauptproblem fettiger/platter Ansatz; wenig Produkte.",
  notEncoded: [
    "„fettiger Ansatz“ hat keinen Quiz-Concern-Code — abgebildet als scalp_type oily + Hauptproblem low_volume_or_weighed_down",
  ],
  parts: {
    model: {
      concernProfileFacts: {
        hair_texture: "straight",
        thickness: "normal",
        scalp_type: "oily",
        chemical_treatment: [],
        damaged: false,
        heat_styling: true,
      },
      hairElasticity: "stretches_bounces",
      heatStyling: OILY_HEAT,
      consultFacts: {
        concerns: ["low_volume_or_weighed_down"],
        scalpConcerns: [],
        profileHeatTools: [],
        currentWashFrequency: "daily_1x",
        idealWashFrequency: "weekly_5_6x",
        hairLossBoundary: false,
      },
    },
    view: view(
      [
        step({
          decisionKey: "shampoo:shampoo_everyday:none",
          category: "shampoo",
          categoryLabel: "Shampoo",
          frequencyLabel: "5–6× pro Woche",
          intakeItemId: "oily-shampoo",
          ownedLabel: "Frischkraft Tiefenrein Shampoo",
          verdict: inCatalog(
            "mismatch",
            { name: "Tiefenrein Shampoo", brand: "Frischkraft" },
            "Passt nicht",
          ),
          swapOptions: [
            option("prod-sanft-balance", "Sanftwerk Balance Shampoo"),
            option("prod-klar-mild", "Klarwerk Mildes Alltagsshampoo"),
          ],
        }),
        step({
          decisionKey: "conditioner:conditioner_rinse_out:none",
          category: "conditioner",
          categoryLabel: "Conditioner",
          idealRecommendation: recommendation("prod-leicht-light", "Leichtwerk Light Spülung"),
          recommendationLabel: "Leichtwerk Light Spülung",
        }),
      ],
      [intakeProduct("oily-shampoo", "shampoo", "Frischkraft Tiefenrein Shampoo", "daily_1x")],
    ),
    quiz: quiz(["low_volume_or_weighed_down"], "low_volume_or_weighed_down"),
    callSheet: { baselineScore: 5 },
  },
}

// --- curly-breakage -------------------------------------------------------------------------

const CURLY_HEAT: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["air_dry", "diffuser_or_airflow_shaping"],
  additionalHeatTools: [],
  heatEvents: {
    "heat:diffuser_airflow_shaping": { frequency: "monthly_1x", protectionConsistency: "always" },
  },
}

const CURLY_BREAKAGE: ConsultGoldenProfile = {
  id: "curly-breakage",
  summary:
    "Lockig, Bruch, trockene Längen, Hitze selten; Hauptproblem Bruch — mit Haarausfall als Nebensignal (G2-Grenze).",
  notEncoded: [],
  parts: {
    model: {
      concernProfileFacts: {
        hair_texture: "curly",
        thickness: "normal",
        scalp_type: "balanced",
        chemical_treatment: [],
        damaged: true,
        heat_styling: false,
      },
      hairElasticity: "snaps",
      heatStyling: CURLY_HEAT,
      consultFacts: {
        concerns: ["breakage", "dry_lengths", "hair_loss_or_thinning"],
        scalpConcerns: [],
        profileHeatTools: [],
        currentWashFrequency: "weekly_2x",
        idealWashFrequency: "weekly_2x",
        hairLossBoundary: true,
      },
    },
    view: view(
      [
        step({
          decisionKey: "shampoo:shampoo_everyday:none",
          category: "shampoo",
          categoryLabel: "Shampoo",
          intakeItemId: "curly-shampoo",
          ownedLabel: "Lockenhof Sanftes Shampoo",
          verdict: inCatalog("ideal", { name: "Sanftes Shampoo", brand: "Lockenhof" }, "Passt"),
        }),
        step({
          decisionKey: "conditioner:conditioner_rinse_out:none",
          category: "conditioner",
          categoryLabel: "Conditioner",
          intakeItemId: "curly-conditioner",
          ownedLabel: "Lockenhof Feuchte Spülung",
          verdict: inCatalog(
            "supportive",
            { name: "Feuchte Spülung", brand: "Lockenhof" },
            "Passt mit Einschränkung",
          ),
        }),
        step({
          decisionKey: "leave_in:leave_in_everyday:none",
          category: "leave_in",
          categoryLabel: "Leave-in",
          frequencyLabel: "Nach jeder Wäsche",
          idealRecommendation: recommendation("prod-locken-leavein", "Lockenhof Curl Leave-in"),
          recommendationLabel: "Lockenhof Curl Leave-in",
        }),
      ],
      [
        intakeProduct("curly-shampoo", "shampoo", "Lockenhof Sanftes Shampoo", "weekly_2x"),
        intakeProduct("curly-conditioner", "conditioner", "Lockenhof Feuchte Spülung", "weekly_2x"),
      ],
    ),
    quiz: quiz(["breakage", "dry_lengths", "hair_loss_or_thinning"], "breakage"),
    callSheet: { baselineScore: 4 },
  },
}

// --- colored-frizz ---------------------------------------------------------------------------
// The most common uncovered archetype in the live quiz data (2026-09-29 seeding analysis):
// colored (not bleached) + fine + oily scalp + wavy, main concern frizz. Exercises the seeded
// entries (frizz, color-fade, oily scalp/wash cadence, wavy handling) and the R22 tone.

const COLORED_FRIZZ_HEAT: DiscoveryHeatStylingV1 = {
  dryingRoutes: ["air_dry"],
  additionalHeatTools: ["straightener"],
  heatEvents: {
    "heat:straightener": { frequency: "weekly_1x", protectionConsistency: "no" },
  },
}

const COLORED_FRIZZ: ConsultGoldenProfile = {
  id: "colored-frizz",
  summary:
    "Gefärbt (nicht blondiert), fein, wellig, fettige Kopfhaut; Hauptproblem Frizz, dazu wenig Glanz; Glätteisen 1×/Woche ohne Hitzeschutz; wäscht 5–6×, Ideal 3–4×.",
  notEncoded: ["mittellang (Länge)"],
  parts: {
    model: {
      concernProfileFacts: {
        hair_texture: "wavy",
        thickness: "fine",
        scalp_type: "oily",
        chemical_treatment: ["colored"],
        damaged: false,
        heat_styling: true,
      },
      hairElasticity: "stretches_stays",
      heatStyling: COLORED_FRIZZ_HEAT,
      consultFacts: {
        concerns: ["frizz_flyaways", "low_shine"],
        scalpConcerns: [],
        profileHeatTools: ["straightener"],
        currentWashFrequency: "weekly_5_6x",
        idealWashFrequency: "weekly_3_4x",
        hairLossBoundary: false,
      },
    },
    view: view(
      [
        step({
          decisionKey: "shampoo:shampoo_everyday:none",
          category: "shampoo",
          categoryLabel: "Shampoo",
          frequencyLabel: "5–6× pro Woche",
          intakeItemId: "cf-shampoo",
          ownedLabel: "Frischkraft Tiefenrein Shampoo",
          verdict: inCatalog(
            "mismatch",
            { name: "Tiefenrein Shampoo", brand: "Frischkraft" },
            "Passt nicht",
          ),
          swapOptions: [
            option("prod-sanft-balance", "Sanftwerk Balance Shampoo"),
            option("prod-klar-mild", "Klarwerk Mildes Alltagsshampoo"),
          ],
        }),
        step({
          decisionKey: "conditioner:conditioner_rinse_out:none",
          category: "conditioner",
          categoryLabel: "Conditioner",
          intakeItemId: "cf-conditioner",
          ownedLabel: "Leichtwerk Feuchte Spülung",
          verdict: inCatalog("ideal", { name: "Feuchte Spülung", brand: "Leichtwerk" }, "Passt"),
        }),
        step({
          decisionKey: "leave_in:leave_in_everyday:none",
          category: "leave_in",
          categoryLabel: "Leave-in",
          frequencyLabel: "Nach jeder Wäsche",
          idealRecommendation: recommendation("prod-seiden-leavein", "Seidenwerk Glätte Leave-in"),
          recommendationLabel: "Seidenwerk Glätte Leave-in",
        }),
        step({
          decisionKey: "heat_protectant:heat_protectant:none",
          category: "heat_protectant",
          categoryLabel: "Hitzeschutz",
          frequencyLabel: "Vor jeder Hitze-Anwendung",
          idealRecommendation: recommendation("prod-schutz-spray", "Schutzwerk Hitzeschutzspray"),
          recommendationLabel: "Schutzwerk Hitzeschutzspray",
        }),
      ],
      [
        intakeProduct("cf-shampoo", "shampoo", "Frischkraft Tiefenrein Shampoo", "weekly_5_6x"),
        intakeProduct("cf-conditioner", "conditioner", "Leichtwerk Feuchte Spülung", "weekly_5_6x"),
      ],
    ),
    quiz: quiz(["frizz_flyaways", "low_shine"], "frizz_flyaways"),
    callSheet: { baselineScore: 6 },
  },
}

export const CONSULT_GOLDEN_PROFILES: readonly ConsultGoldenProfile[] = [
  NOMI,
  OILY_OVERWASH,
  CURLY_BREAKAGE,
  COLORED_FRIZZ,
]

export function consultGoldenProfile(id: ConsultGoldenProfileId): ConsultGoldenProfile {
  const profile = CONSULT_GOLDEN_PROFILES.find((entry) => entry.id === id)
  if (!profile) throw new Error(`unknown golden profile ${id}`)
  return profile
}

/** The input and hash exactly as the route assembles them (`consultBriefSource`). */
export function consultGoldenSource(profile: ConsultGoldenProfile): ConsultBriefSource {
  const { model, view, quiz, callSheet } = profile.parts
  return consultBriefSource({
    // Only the profile side is read; a full cockpit model is not needed to assemble.
    model: model as unknown as DiscoveryCockpitModel,
    view,
    quiz,
    callSheet,
  })
}
