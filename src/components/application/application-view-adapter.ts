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

import { projectToolsForDay, type ToolPlacement } from "@/lib/personal-plan/tools/application"
import type { ToolAsset, ToolGuidance, ToolOccurrence } from "@/lib/personal-plan/tools/contracts"

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

    const productSteps: ApplicationOuterStepView[] = day.outerSequence.map((step, index) => {
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

    const toolProjection = tools
      ? projectToolsForDay({
          dayType: day.key,
          assets: tools.assets,
          occurrences: tools.occurrences,
          guidance: tools.guidance,
        })
      : null

    const productShelf = day.outerSequence.flatMap<ApplicationShelfSlotView>((step) => {
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
        ? withToolSteps(productSteps, toolProjection, finishStepIndex(day))
        : productSteps,
      isPartial: Boolean(day.isPartial),
      provisionalProductCount: day.productBlocks.filter((block) => block.status === "provisional")
        .length,
      unresolvedProductCount: day.outerSequence.filter((step) => step.kind === "unresolved_product")
        .length,
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

/**
 * Splices the Tool sections and behaviour-only guidance into the day's ordered
 * sequence: wash aids before the product steps, detangling and drying after
 * them, then styling, then the nightly step last. Product steps keep their
 * relative order untouched.
 */
/**
 * Index of the first finishing product (a `dry_finish` Oil or equivalent), or -1.
 * Drying and styling Tools must be used BEFORE the finish is applied — appending
 * them after it would tell the user to finish, then style.
 */
function finishStepIndex(day: CompiledApplicationViewV1["days"][number]): number {
  return day.outerSequence.findIndex(
    (step) => step.kind === "product" && step.block.roles.includes("finish"),
  )
}

function withToolSteps(
  productSteps: readonly ApplicationOuterStepView[],
  projection: ReturnType<typeof projectToolsForDay>,
  finishIndex: number,
): ApplicationOuterStepView[] {
  const byPlacement = new Map<ToolPlacement, ApplicationOuterStepView[]>()
  const push = (placement: ToolPlacement, step: ApplicationOuterStepView) => {
    const bucket = byPlacement.get(placement) ?? []
    bucket.push(step)
    byPlacement.set(placement, bucket)
  }
  for (const section of projection.sections) push(section.placement, section)
  for (const transition of projection.transitions) {
    push(transition.placement, {
      kind: "transition",
      stepKey: transition.stepKey,
      copyDe: transition.copyDe,
    })
  }

  const before = byPlacement.get("wash") ?? []
  const middle = (["post_wash", "drying", "styling"] as const).flatMap(
    (placement) => byPlacement.get(placement) ?? [],
  )
  const nightly = byPlacement.get("nightly") ?? []

  // Everything except the nightly step belongs before the finishing product.
  const cut = finishIndex >= 0 ? finishIndex : productSteps.length
  return [
    ...before,
    ...productSteps.slice(0, cut),
    ...middle,
    ...productSteps.slice(cut),
    ...nightly,
  ]
}
