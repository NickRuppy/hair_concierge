import { PRODUCT_CATEGORY_LABELS } from "@/lib/onboarding/product-options"
import type {
  ApplicationDayTypeKey,
  PersonalPlanCategory,
  SemanticRole,
} from "@/lib/routines/personal-plan/application/contracts"
import type {
  CompiledApplicationViewV1,
  CompiledProductBlock,
} from "@/lib/routines/personal-plan/application/compiler"
import type { ApplicationDayTypeDefinition } from "@/lib/routines/personal-plan/application/repository"

import {
  projectToolsForDay,
  type ToolPlacement,
  type ToolUseSectionView,
} from "@/lib/personal-plan/tools/application"
import {
  dayAnchorIndex,
  TOOL_DAY_ANCHORS,
  type ToolAsset,
  type ToolDayAnchor,
  type ToolGuidance,
  type ToolOccurrence,
  type ToolOccurrenceAnchor,
} from "@/lib/personal-plan/tools/contracts"
import { TOOL_FAMILY_LABELS } from "@/lib/personal-plan/tools/labels"

import type {
  ApplicationDayView,
  ApplicationOuterStepView,
  ApplicationPageView,
  ApplicationShelfSlotView,
} from "./application-types"

const EXTRA_CATEGORY_LABELS_DE: Partial<Record<PersonalPlanCategory, string>> = {
  heat_protectant: "Hitzeschutz",
  scalp_care: "Kopfhautpflege",
  styling: "Styling",
}

const ROLE_PURPOSE_DE: Record<SemanticRole, string> = {
  cleanse: "Reinigt Kopfhaut und Ansatz.",
  condition: "Pflegt Längen und Spitzen.",
  intensive_care: "Versorgt das Haar mit intensiver Pflege.",
  bond_repair: "Wendet deine abgestimmte Bond-Repair-Pflege an.",
  reset_cleanse: "Entfernt stärkere Rückstände mit einer klärenden Wäsche.",
  refresh: "Frischt das Haar zwischen den Wäschen auf.",
  leave_in: "Pflegt das Haar nach der Wäsche, ohne ausgespült zu werden.",
  heat_protection: "Schützt das Haar vor dem bestätigten Wärmeschritt.",
  scalp_care: "Pflegt die vorgesehenen Bereiche der Kopfhaut.",
  styling: "Bringt das Haar in die gewünschte Form.",
  finish: "Schließt die Anwendung in Längen und Spitzen ab.",
}

type ViewAdapterInput = {
  compiled: CompiledApplicationViewV1
  dayDefinitions: readonly ApplicationDayTypeDefinition[]
  cadenceByDay?: Partial<Record<ApplicationDayTypeKey, string>>
  /**
   * The Routine's durable Tool authority. Absent while the Tools rollout is off,
   * which leaves every day exactly as it renders in production today.
   */
  tools?: {
    assets: readonly ToolAsset[]
    occurrences: readonly ToolOccurrence[]
    guidance: readonly ToolGuidance[]
  }
}

function categoryLabelDe(category: PersonalPlanCategory): string {
  return EXTRA_CATEGORY_LABELS_DE[category] ?? PRODUCT_CATEGORY_LABELS[category] ?? category
}

function purposeDe(block: CompiledProductBlock): string {
  return block.roles.map((role) => ROLE_PURPOSE_DE[role]).join(" ")
}

function productStep(block: CompiledProductBlock): ApplicationOuterStepView {
  return {
    kind: "product",
    stepKey: block.applicationInstanceKey,
    applicationInstanceKey: block.applicationInstanceKey,
    productId: block.productId,
    productName: block.productName,
    imageUrl: block.imageUrl ?? null,
    categoryLabelDe: categoryLabelDe(block.category),
    purposeDe: purposeDe(block),
    actions: block.steps.map((step) => ({ actionKey: step.stepKey, copyDe: step.copyDe })),
    coverageNoteDe: block.noteDe,
    status: block.status,
    provisionalReason: block.provisionalReason ?? null,
  }
}

export function toApplicationPageView({
  compiled,
  dayDefinitions,
  cadenceByDay = {},
  tools,
}: ViewAdapterInput): ApplicationPageView {
  const definitionByKey = new Map(dayDefinitions.map((definition) => [definition.key, definition]))

  const days: ApplicationDayView[] = compiled.days.map((day) => {
    const definition = definitionByKey.get(day.key)
    if (!definition) {
      throw new Error(`missing active day definition for ${day.key}`)
    }

    const toolProjection = tools
      ? projectToolsForDay({
          dayType: day.key,
          assets: tools.assets,
          occurrences: tools.occurrences,
          guidance: tools.guidance,
        })
      : null

    // The product compiler emits its own generic transition line whenever a
    // product's anchor is `post_rinse_towel_dry` ("Sanft mit einem Handtuch
    // ausdrücken."). Since WS6 a drying-textile Tool step (towel, T-shirt,
    // wrap) can anchor at that same graph position and say the same thing in
    // its own copy. Drop the compiler's generic line in that case — the Tool
    // step alone carries the instruction. The compiler's own output and
    // semantics are untouched; a day without a drying-textile Tool step keeps
    // the transition exactly as compiled.
    const suppressGenericTowelTransition = Boolean(
      toolProjection && hasDryingTextileStepAtTowelDry(toolProjection.sections),
    )
    const effectiveOuterSequence = day.outerSequence.filter(
      (step) => !(suppressGenericTowelTransition && isTowelDryTransition(step)),
    )

    const productSteps: ApplicationOuterStepView[] = effectiveOuterSequence.map((step, index) => {
      if (step.kind === "product") return productStep(step.block)
      if (step.kind === "unresolved_product") {
        return {
          kind: "unresolved_product" as const,
          stepKey: step.block.applicationInstanceKey,
          applicationInstanceKey: step.block.applicationInstanceKey,
          productId: step.block.productId,
          productName: step.block.productName,
          categoryLabelDe: categoryLabelDe(step.block.category),
          reason: step.block.reason ?? ("no_product_chosen" as const),
        }
      }
      return {
        kind: "transition" as const,
        stepKey: `${day.key}:transition:${index}`,
        copyDe: step.copyDe,
      }
    })

    const productShelf = effectiveOuterSequence.flatMap<ApplicationShelfSlotView>((step) => {
      if (step.kind === "product")
        return [
          {
            kind: "product" as const,
            productId: step.block.productId,
            productName: step.block.productName,
            imageUrl: step.block.imageUrl ?? null,
            category: step.block.category,
            status: step.block.status,
          },
        ]
      if (step.kind === "unresolved_product")
        return [
          {
            kind: "open" as const,
            category: step.block.category,
            categoryLabelDe: categoryLabelDe(step.block.category),
            reason: step.block.reason ?? ("no_product_chosen" as const),
          },
        ]
      return []
    })

    return {
      dayType: day.key,
      sortOrder: definition.sortOrder,
      labelDe: definition.label,
      summaryDe: definition.summary,
      cadenceDe: cadenceByDay[day.key] ?? null,
      steps: toolProjection
        ? withToolSteps(
            productSteps,
            productAnchorRanks(effectiveOuterSequence),
            toolProjection,
            finishStepIndex(effectiveOuterSequence),
          )
        : productSteps,
      isPartial: Boolean(day.isPartial),
      provisionalProductCount: day.productBlocks.filter((block) => block.status === "provisional")
        .length,
      unresolvedProductCount: effectiveOuterSequence.filter(
        (step) => step.kind === "unresolved_product",
      ).length,
      // Tools stand on the same shelf as the products; no pill row is added.
      shelf: [...productShelf, ...(toolProjection?.shelf ?? [])],
    }
  })

  const completeProductDays = days.filter((day) => day.dayType !== "rest_day")
  const restDay = days.find((day) => day.dayType === "rest_day")

  if (completeProductDays.length === 0) {
    if (!restDay) throw new Error("missing active day definition for rest_day")
    return { state: "no_complete_day", restDay }
  }

  return { state: "ready", days }
}

type DayOuterSequence = CompiledApplicationViewV1["days"][number]["outerSequence"]

/**
 * Index of the first finishing product (a `dry_finish` Oil or equivalent), or -1.
 * Drying and styling Tools must be used BEFORE the finish is applied — appending
 * them after it would tell the user to finish, then style.
 */
function finishStepIndex(outerSequence: DayOuterSequence): number {
  return outerSequence.findIndex(
    (step) => step.kind === "product" && step.block.roles.includes("finish"),
  )
}

/**
 * The graph position each product step occupies, in the day's own order.
 *
 * Product blocks carry their protocol's `APPLICATION_SEQUENCE_ANCHORS` anchor,
 * which is the same graph the Tool occurrences anchor onto (`D7`). A step
 * without a usable anchor — an unresolved product, a compiler transition —
 * inherits the position of the step before it, so it stays glued where the
 * compiler put it instead of jumping to a bucket of its own.
 */
function productAnchorRanks(outerSequence: DayOuterSequence): number[] {
  let carried = -1
  return outerSequence.map((step) => {
    const anchor =
      step.kind === "product" ? (step.block.anchor as ToolDayAnchor | undefined) : undefined
    const index = anchor ? TOOL_DAY_ANCHORS.indexOf(anchor) : -1
    if (index >= 0) carried = index
    return carried
  })
}

/**
 * True for the compiler's own generic transition into the towel-dry graph
 * position (`toAnchor === "post_rinse_towel_dry"`) — the line this dedupe may
 * suppress. Every other transition (into `wet_cleanse`, `damp_leave_on`, etc.)
 * is untouched.
 */
function isTowelDryTransition(step: DayOuterSequence[number]): boolean {
  return step.kind === "state_transition" && step.toAnchor === "post_rinse_towel_dry"
}

/**
 * Whether the Tool projection already renders a drying-textile Tool step
 * (towel, T-shirt, wrap) at the towel-dry graph position. When it does, the
 * compiler's generic transition line would repeat the same instruction the
 * Tool step already gives, so the view drops the generic line and keeps the
 * Tool step as the single source of the instruction.
 */
function hasDryingTextileStepAtTowelDry(sections: readonly ToolUseSectionView[]): boolean {
  return sections.some(
    (section) =>
      section.anchor.position === "post_rinse_towel_dry" &&
      section.familyLabelDe === TOOL_FAMILY_LABELS.drying_textiles,
  )
}

/**
 * Splices the Tool sections and behaviour-only guidance into the day's ordered
 * sequence by GRAPH POSITION (`D7`), not by a five-slot bucket of its own.
 *
 * A Tool step renders after every product step at or before its position and
 * before the first product step past it. At an equal position the product goes
 * first — you apply the heat protection, then you reach for the tool.
 *
 * Two ordering guarantees survive unchanged: nothing but the nightly step
 * renders after the finishing product, and the nightly step is always last.
 */
function withToolSteps(
  productSteps: readonly ApplicationOuterStepView[],
  productRanks: readonly number[],
  projection: ReturnType<typeof projectToolsForDay>,
  finishIndex: number,
): ApplicationOuterStepView[] {
  type Pending = {
    rank: number
    placement: ToolPlacement
    relativeToStep: ToolOccurrenceAnchor["relativeToStep"]
    step: ApplicationOuterStepView
  }
  const pending: Pending[] = [
    ...projection.sections.map((section) => ({
      rank: dayAnchorIndex(section.anchor),
      placement: section.placement,
      relativeToStep: section.anchor.relativeToStep,
      step: section as ApplicationOuterStepView,
    })),
    ...projection.transitions.map((transition) => ({
      rank: dayAnchorIndex(transition.anchor),
      placement: transition.placement,
      relativeToStep: transition.anchor.relativeToStep,
      step: {
        kind: "transition" as const,
        stepKey: transition.stepKey,
        copyDe: transition.copyDe,
      },
    })),
  ].sort((left, right) => left.rank - right.rank)

  const nightly = pending.filter((entry) => entry.placement === "nightly")
  const inDay = pending.filter((entry) => entry.placement !== "nightly")
  // Everything except the nightly step belongs before the finishing product.
  const cap = finishIndex >= 0 ? finishIndex : productSteps.length

  const merged: ApplicationOuterStepView[] = []
  let cursor = 0
  for (const entry of inDay) {
    let target = productRanks.filter((rank) => rank <= entry.rank).length
    // An optional refinement INSIDE the position: sit immediately after (or
    // before) the named product step when the day actually contains it. The
    // graph position still decides everything else, so this can never move a
    // step into another phase.
    if (entry.relativeToStep) {
      const at = productSteps.findIndex((step) => step.stepKey === entry.relativeToStep?.stepKey)
      if (at >= 0) target = entry.relativeToStep.side === "after" ? at + 1 : at
    }
    target = Math.min(target, cap)
    target = Math.max(target, cursor)
    while (cursor < target) merged.push(productSteps[cursor++])
    merged.push(entry.step)
  }
  while (cursor < productSteps.length) merged.push(productSteps[cursor++])
  return [...merged, ...nightly.map((entry) => entry.step)]
}
