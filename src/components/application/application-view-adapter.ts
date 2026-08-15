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
}: ViewAdapterInput): ApplicationPageView {
  const definitionByKey = new Map(dayDefinitions.map((definition) => [definition.key, definition]))

  const days: ApplicationDayView[] = compiled.days.map((day) => {
    const definition = definitionByKey.get(day.key)
    if (!definition) {
      throw new Error(`missing active day definition for ${day.key}`)
    }

    return {
      dayType: day.key,
      sortOrder: definition.sortOrder,
      labelDe: definition.label,
      summaryDe: definition.summary,
      cadenceDe: cadenceByDay[day.key] ?? null,
      steps: day.outerSequence.map((step, index) => {
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
      }),
      isPartial: Boolean(day.isPartial),
      provisionalProductCount: day.productBlocks.filter((block) => block.status === "provisional")
        .length,
      unresolvedProductCount: day.outerSequence.filter((step) => step.kind === "unresolved_product")
        .length,
      shelf: day.outerSequence.flatMap<ApplicationShelfSlotView>((step) => {
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
            },
          ]
        return []
      }),
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
