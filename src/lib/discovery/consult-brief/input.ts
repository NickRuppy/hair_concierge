import { CATEGORY_LABELS } from "@/lib/personal-plan/decision-presentation"
import type { DiagnosticConcern } from "@/lib/quiz/diagnostic-input"

import type { DiscoveryCallSheet } from "../call-sheet"
import type {
  DiscoveryCockpitModel,
  DiscoveryCockpitStepView,
  DiscoveryCockpitView,
} from "../cockpit"
import { concernRecipeFor } from "../concern-recipes"
import { DISCOVERY_FREQUENCY_LABELS, mostFrequentDiscoveryFrequency } from "../frequency"
import { describeDiscoveryHeatStyling, type DiscoveryHeatStylingSummary } from "../heat-styling"
import { resolveDiscoveryMainConcern } from "../quiz-answers"
import {
  deriveBuckets,
  derivePrepChecklist,
  type RunsheetBuckets,
  type RunsheetPrepItem,
  type RunsheetVerdictFit,
} from "../runsheet"
import {
  CONSULT_FLAGS,
  deriveConsultFlags,
  selectConsultKnowledge,
  type ConsultFlag,
  type FiredConsultKnowledge,
} from "./knowledge"

/**
 * The consult brief's input (consult-agent T2): ONE structured context the prompt renders and
 * the source hash fingerprints. Pure and read-only over the cockpit read model, the runsheet
 * derivations (buckets, checklist), the main-problem recipe and the knowledge base.
 *
 * Deliberately left out (G5): every evidence grade and confidence — the recipe's and the
 * knowledge entries' `evidence` steer the selection only. The existing brief text is not an
 * input either: the hash describes what the brief was generated FROM.
 */

export type ConsultInputSource = {
  /** The cockpit view the page renders (`buildDiscoveryCockpitView(model)`). */
  view: Pick<DiscoveryCockpitView, "steps" | "unassigned" | "intakeProducts">
  /** The cockpit model's profile side; every field optional (legacy / test models). */
  model: Partial<
    Pick<
      DiscoveryCockpitModel,
      "concernProfileFacts" | "hairElasticity" | "heatStyling" | "consultFacts" | "research"
    >
  >
  /**
   * Her quiz concerns and stated main problem (`buildDiscoveryQuizAnswers`, when ready). Null:
   * the plan snapshot's concerns are used, and the main problem is her only concern, if one.
   */
  quiz?: { concerns: readonly DiagnosticConcern[]; mainConcern: DiagnosticConcern | null } | null
}

export type ConsultProductVerdict =
  | "passt"
  | "passt_nicht"
  | "unklar"
  /** An empty step the Idealplan fills. */
  | "neu"
  /** Not yet in the catalog. */
  | "in_recherche"
  /** Her usage is unknown. */
  | "kategorie_offen"
  /** Her category has no step in the Idealroutine. */
  | "kein_schritt"
  /** Styling — never evaluated. */
  | "nicht_bewertet"

export type ConsultProduct = {
  bucket: keyof RunsheetBuckets
  /** The step key `swapReasons` is keyed by; null for a product without a step. */
  decisionKey: string | null
  intakeItemId: string | null
  categoryLabel: string | null
  /** As the cockpit names it. */
  name: string
  /** Every spelling the lint accepts as a mention of this product (name first). */
  aliases: string[]
  /** The catalog brand of her product (lint aliases: brand + name token, unique brand). */
  brand: string | null
  verdict: ConsultProductVerdict
  /** The engine's own label („Passt mit Einschränkung"), only for a catalog verdict. */
  verdictLabel: string | null
  /** The call's recorded decision; null while undecided. */
  decision: "keep" | "swap" | "drop" | null
  /** The decided swap target. */
  swapTarget: string | null
  /** The swap targets the engine offers for this entry (the only admissible ones). */
  swapOptions: string[]
}

export type ConsultChecklistItem = { kind: RunsheetPrepItem["kind"]; label?: string }

export type ConsultBoundaryTrigger = "hair_loss_concern" | "hair_loss_assessment"

export type ConsultInput = {
  profile: {
    hairTexture: string | null
    thickness: string | null
    scalpType: string | null
    chemicalTreatments: string[] | null
    elasticity: string | null
    scalpConcerns: string[] | null
    concerns: DiagnosticConcern[]
  }
  /** Her main problem with the recipe excerpt (no evidence grades); null when none is stated. */
  mainConcern: {
    code: DiagnosticConcern
    label: string
    meaning: string
    talkingPoint: string
    primaryCategories: Array<{ label: string; why: string }>
    levers: string[]
    avoid: string[]
    callQuestions: string[]
    /** `hair_loss_or_thinning`: the safety boundary — never a product list. */
    boundary: string | null
  } | null
  /** The derived flags, sorted (the knowledge selection's input). */
  flags: ConsultFlag[]
  knowledge: FiredConsultKnowledge[]
  products: ConsultProduct[]
  checklist: ConsultChecklistItem[]
  heat: DiscoveryHeatStylingSummary | null
  washFrequency: {
    current: string | null
    currentLabel: string | null
    ideal: string | null
    idealLabel: string | null
    changes: boolean
  }
  /** G2 signals in her data; the boundary line is mandatory regardless (guardrails G2). */
  boundaryTriggers: ConsultBoundaryTrigger[]
  baselineScore: number | null
}

const VERDICT_BY_FIT: Record<RunsheetVerdictFit, ConsultProductVerdict> = {
  fits: "passt",
  does_not_fit: "passt_nicht",
  uncertain: "unklar",
}

const UNASSIGNED_VERDICT = {
  research_pending: "in_recherche",
  category_unknown: "kategorie_offen",
  no_ideal_step: "kein_schritt",
  styling_not_evaluated: "nicht_bewertet",
} as const

const DOES_NOT_WASH_LABEL = "wäscht nicht"

export function assembleConsultInput(
  source: ConsultInputSource,
  callSheet: Pick<DiscoveryCallSheet, "baselineScore"> | null,
): ConsultInput {
  const { view, model } = source
  const facts = model.concernProfileFacts ?? null
  const consultFacts = model.consultFacts ?? null

  const concerns: DiagnosticConcern[] = source.quiz
    ? [...source.quiz.concerns]
    : [...(consultFacts?.concerns ?? [])]
  const mainConcernCode = source.quiz
    ? source.quiz.mainConcern
    : resolveDiscoveryMainConcern(concerns, null)

  const ownedCategories = view.intakeProducts.flatMap((product): string[] =>
    [product.category, product.productType].flatMap((entry) => (entry ? [entry] : [])),
  )
  const currentWash =
    mostFrequentDiscoveryFrequency(
      view.intakeProducts
        .filter((product) => product.category === "shampoo")
        .map((product) => product.frequency),
    ) ??
    consultFacts?.currentWashFrequency ??
    null
  const idealWash = consultFacts?.idealWashFrequency ?? null

  const flagSet = deriveConsultFlags({
    chemicalTreatments: facts?.chemical_treatment ?? null,
    hairTexture: facts?.hair_texture ?? null,
    thickness: facts?.thickness ?? null,
    scalpType: facts?.scalp_type ?? null,
    scalpConcerns: consultFacts?.scalpConcerns ?? null,
    intakeHeatTools: model.heatStyling ? model.heatStyling.additionalHeatTools : null,
    profileHeatTools: consultFacts?.profileHeatTools ?? null,
    ownedCategories,
    planCategories: view.steps.map((entry) => entry.category),
    elasticity: model.hairElasticity ?? null,
    concerns,
    washFrequency: { current: currentWash, ideal: idealWash },
  })

  const boundaryTriggers: ConsultBoundaryTrigger[] = []
  if (concerns.includes("hair_loss_or_thinning")) boundaryTriggers.push("hair_loss_concern")
  if (consultFacts?.hairLossBoundary === true) boundaryTriggers.push("hair_loss_assessment")

  return {
    profile: {
      hairTexture: facts?.hair_texture ?? null,
      thickness: facts?.thickness ?? null,
      scalpType: facts?.scalp_type ?? null,
      chemicalTreatments: facts?.chemical_treatment ?? null,
      elasticity: model.hairElasticity ?? null,
      scalpConcerns: consultFacts?.scalpConcerns ?? null,
      concerns,
    },
    mainConcern: mainConcernExcerpt(mainConcernCode),
    flags: CONSULT_FLAGS.filter((flag) => flagSet.has(flag)).sort(),
    knowledge: selectConsultKnowledge(flagSet),
    products: consultProducts(deriveBuckets(view)),
    checklist: derivePrepChecklist({
      view,
      intakeItems: model.research?.items ?? null,
      callSheet: callSheet ? { baselineScore: callSheet.baselineScore } : null,
      profile: {
        chemicalTreatments: facts?.chemical_treatment ?? null,
        elasticity: model.hairElasticity ?? null,
        primaryConcern: mainConcernCode,
      },
    }).map((item) =>
      item.kind === "research_open" ? { kind: item.kind, label: item.label } : { kind: item.kind },
    ),
    heat: model.heatStyling ? describeDiscoveryHeatStyling(model.heatStyling) : null,
    washFrequency: {
      current: currentWash,
      currentLabel: washLabel(currentWash),
      ideal: idealWash,
      idealLabel: washLabel(idealWash),
      changes: flagSet.has("wash_frequency_change"),
    },
    boundaryTriggers,
    baselineScore: callSheet?.baselineScore ?? null,
  }
}

function mainConcernExcerpt(code: DiagnosticConcern | null): ConsultInput["mainConcern"] {
  const recipe = code ? concernRecipeFor(code) : null
  if (!recipe) return null
  return {
    code: recipe.code,
    label: recipe.labelDe,
    meaning: recipe.meaningDe,
    talkingPoint: recipe.talkingPointDe,
    primaryCategories: recipe.primary.categories.map((entry) => ({
      label: CATEGORY_LABELS[entry.category],
      why: entry.why,
    })),
    levers: recipe.primary.levers.map((entry) => entry.lever),
    avoid: [...recipe.avoid],
    callQuestions: [...recipe.callQuestionsDe],
    boundary: recipe.boundary,
  }
}

function consultProducts(buckets: RunsheetBuckets): ConsultProduct[] {
  const products: ConsultProduct[] = []
  for (const bucket of [
    "behalten",
    "weglassen",
    "tauschenOderNeu",
    "klaeren",
    "styling",
  ] as const) {
    for (const entry of buckets[bucket]) {
      if (entry.kind === "unassigned") {
        const label = entry.unassigned.label
        products.push({
          bucket,
          decisionKey: null,
          intakeItemId: entry.intakeItemId,
          categoryLabel: entry.category ? CATEGORY_LABELS[entry.category] : null,
          name: label,
          aliases: [label],
          brand: null,
          verdict: UNASSIGNED_VERDICT[entry.reason],
          verdictLabel: null,
          decision: null,
          swapTarget: null,
          swapOptions: [],
        })
      } else if (entry.kind === "neu") {
        const label = entry.label ?? entry.step.categoryLabel
        products.push({
          bucket,
          decisionKey: entry.decisionKey,
          intakeItemId: null,
          categoryLabel: entry.step.categoryLabel,
          name: label,
          aliases: entry.label ? [entry.label] : [],
          brand: null,
          verdict: "neu",
          verdictLabel: null,
          decision: entry.proposed ? null : "swap",
          swapTarget: null,
          swapOptions: [],
        })
      } else {
        const name = ownedName(entry.step)
        products.push({
          bucket,
          decisionKey: entry.decisionKey,
          intakeItemId: entry.intakeItemId,
          categoryLabel: entry.step.categoryLabel,
          name,
          aliases: ownedAliases(entry.step, name),
          brand: entry.step.verdict?.status === "verdict" ? entry.step.verdict.product.brand : null,
          verdict: VERDICT_BY_FIT[entry.verdictFit],
          verdictLabel:
            entry.step.verdict?.status === "verdict" &&
            entry.step.verdict.payload.kind === "in_catalog"
              ? entry.step.verdict.payload.verdictLabel
              : null,
          decision: entry.decision,
          swapTarget: entry.swapProductLabel,
          swapOptions: entry.step.swapOptions.map((option) => option.label),
        })
      }
    }
  }
  return products
}

function ownedName(step: DiscoveryCockpitStepView): string {
  if (step.ownedLabel) return step.ownedLabel
  if (step.verdict?.status === "verdict") {
    const { brand, name } = step.verdict.product
    return brand ? `${brand} ${name}` : name
  }
  return step.categoryLabel
}

/**
 * The cockpit label, plus the catalog's „brand name" and — when it is distinctive enough to
 * be a product and not a category word — the bare catalog name.
 */
function ownedAliases(step: DiscoveryCockpitStepView, name: string): string[] {
  const aliases = new Set([name])
  if (step.verdict?.status === "verdict") {
    const product = step.verdict.product
    if (product.brand) aliases.add(`${product.brand} ${product.name}`)
    if (product.name.trim().split(/\s+/).length >= 2 && product.name.length >= 12) {
      aliases.add(product.name)
    }
  }
  return [...aliases]
}

function washLabel(value: string | null): string | null {
  if (value === null) return null
  if (value === "does_not_wash") return DOES_NOT_WASH_LABEL
  return (DISCOVERY_FREQUENCY_LABELS as Record<string, string>)[value] ?? null
}
