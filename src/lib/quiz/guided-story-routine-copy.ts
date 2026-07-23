import type {
  OfferPreviewCategory,
  OfferPreviewProductCard,
  OfferPreviewScalpRoute,
} from "./offer-preview-types"
import type { QuizGuidedStoryPreview } from "./guided-story-preview"

type FoundationCategory = "shampoo" | "conditioner"
type TargetedCategory = Exclude<OfferPreviewCategory, FoundationCategory>

export interface GuidedStoryRoutineProductCopy {
  key: string
  categoryLabel: string
  sectionTitle: string
  popover: string
}

export interface GuidedStoryRoutineCopy {
  continuation: string
  basisTitle: string
  basisIntro: string
  targetedTitle: string
  lockedTeasers: Array<{
    key: "further-care" | "tools"
    label: string
  }>
  lockedPopover: string
  lockedCtaLabel: string
  handoff: string
  handoffCtaLabel: string
  products: GuidedStoryRoutineProductCopy[]
}

export const GUIDED_STORY_LOCKED_POPOVER =
  "Diese weiteren Schritte schalten wir mit deiner Chaarlie-Mitgliedschaft frei. Dann passen wir sie an deine komplette Routine und an Produkte an, die du bereits besitzt."

export const GUIDED_STORY_LOCKED_CTA_LABEL = "Mit Chaarlie starten"
export const GUIDED_STORY_CHAPTER_TWO_HANDOFF =
  "Bereit zu sehen, wie Chaarlie dich bei deiner Routine unterstützt?"
export const GUIDED_STORY_CHAPTER_TWO_CTA_LABEL = "Ja, zeig mir Chaarlie"

function withExample(template: string, product: OfferPreviewProductCard): string {
  return template.replace("{product}", product.name)
}

function resolveShampooPopover(route: OfferPreviewScalpRoute, product: OfferPreviewProductCard) {
  if (product.key === "sh-oily-coarse-neutral") {
    return withExample(
      "Dein Ansatz fettet schneller nach. Deshalb bleibt eine regelmäßige Reinigung wichtig. {product} zeigt die passende Richtung, ist für grobes Haar aber nur ein vorläufiges Beispiel. Chaarlie finalisiert das konkrete Shampoo mit dir.",
      product,
    )
  }

  const templates: Record<OfferPreviewScalpRoute, string> = {
    dry: "Deine Kopfhaut neigt zu Trockenheit. Deshalb solltest du sanft reinigen, ohne stark zu entfetten. Dafür brauchst du ein mildes Shampoo, das deine Basis ruhig hält – zum Beispiel {product}.",
    dandruff:
      "Deine Kopfhaut neigt zu Schuppen. Deshalb solltest du den Ansatz gezielt reinigen, ohne die Längen unnötig zu belasten. Dafür brauchst du ein Anti-Schuppen-Shampoo mit Kopfhaut-Fokus – zum Beispiel {product}.",
    irritated:
      "Deine Kopfhaut reagiert empfindlich. Deshalb solltest du mild reinigen und zusätzliche Reize reduzieren. Dafür brauchst du ein sanftes Shampoo mit Kopfhaut-Fokus, das vorsichtig in deine Basis passt – zum Beispiel {product}.",
    oily: "Dein Ansatz fettet schneller nach. Deshalb solltest du die Kopfhaut regelmäßig reinigen, ohne Conditioner an den Ansatz zu ziehen. Dafür brauchst du ein zuverlässig reinigendes Shampoo – zum Beispiel {product}.",
    balanced:
      "Deine Kopfhaut ist gut ausgeglichen. Deshalb reicht eine einfache, regelmäßige Reinigung als stabile Basis. Dafür brauchst du ein passendes Shampoo, das die Längen nicht unnötig beschwert – zum Beispiel {product}.",
  }

  return withExample(templates[route], product)
}

function resolveConditionerPopover(
  balance: QuizGuidedStoryPreview["needs"]["conditioner"]["balance"],
  product: OfferPreviewProductCard,
) {
  const templates: Record<typeof balance, string> = {
    moisture:
      "Dein Zugtest spricht für eine feuchtigkeitsorientierte Pflege. Deshalb solltest du deine Längen bei jeder Wäsche geschmeidig halten und leichter kämmbar machen. Dafür passt ein feuchtigkeitsspendender Conditioner – zum Beispiel {product}.",
    protein:
      "Dein Zugtest spricht für eine proteinorientierte Pflege. Deshalb solltest du deine Längen bei jeder Wäsche beim Entwirren stabiler führen. Dafür passt ein strukturorientierter Conditioner – zum Beispiel {product}.",
    balanced:
      "Deine Haarstärke und Dichte sprechen für eine ausgewogene Pflege. Deshalb solltest du deine Längen bei jeder Wäsche geschmeidig halten, ohne sie unnötig zu beschweren. Dafür passt ein ausgewogener Conditioner – zum Beispiel {product}.",
  }

  return withExample(templates[balance], product)
}

function isCurlLeaveIn(product: OfferPreviewProductCard): boolean {
  return product.key === "extra-curl-leave-in" || /curl|coils|locken/i.test(product.name)
}

function resolveTargetedPopover(category: TargetedCategory, product: OfferPreviewProductCard) {
  if (category === "bondbuilder") {
    return withExample(
      "Dein Haarbruch trifft auf chemisch behandelte Längen. Deshalb ist ein gezielter Zusatzschritt sinnvoll. Eine Bond-Pflege kann deine Routine ergänzen – zum Beispiel {product}. Anwendung und Rhythmus folgen der Produktangabe.",
      product,
    )
  }
  if (category === "protein_mask") {
    return withExample(
      "Dein Zugtest und dein Haarbruch sprechen gemeinsam für einen zusätzlichen proteinorientierten Schritt. Eine Proteinmaske ergänzt deinen Conditioner in größeren Abständen, ohne ihn bei jeder Wäsche zu ersetzen – zum Beispiel {product}.",
      product,
    )
  }
  if (category === "moisture_mask") {
    return withExample(
      "Dein Zugtest und deine Trockenheit sprechen gemeinsam für einen zusätzlichen Feuchtigkeitsschritt. Eine Feuchtigkeitsmaske ergänzt deinen Conditioner in größeren Abständen, ohne die Basis unnötig zu verlängern – zum Beispiel {product}.",
      product,
    )
  }
  if (category === "leave_in") {
    if (isCurlLeaveIn(product)) {
      return withExample(
        "Deine wellige oder lockige Struktur und die raue Oberfläche brauchen nach der Wäsche mehr Bündelung und Schutz. Ein Locken-Leave-in unterstützt beides zwischen den Wäschen – zum Beispiel {product}.",
        product,
      )
    }
    return withExample(
      "Deine raue Haaroberfläche braucht auch nach der Wäsche Schutz. Ein leichtes Leave-in gibt zusätzliche Gleitfähigkeit und reduziert Reibung zwischen den Wäschen – zum Beispiel {product}.",
      product,
    )
  }

  return withExample(
    "Deine Spitzen sind bereits stärker abgenutzt. Deshalb solltest du sie zwischen den Wäschen sparsam schützen. Ein Haaröl kann Reibung reduzieren und sie glatter wirken lassen – zum Beispiel {product}.",
    product,
  )
}

function resolveSectionTitle(
  product: OfferPreviewProductCard,
  preview: QuizGuidedStoryPreview,
): string {
  if (product.category === "shampoo") {
    const routeTitles: Record<OfferPreviewScalpRoute, string> = {
      dry: "Trockene Kopfhaut: sanft reinigen",
      dandruff: "Schuppen: gezielt reinigen",
      irritated: "Gereizte Kopfhaut: Reize reduzieren",
      oily: "Öliger Ansatz: regelmäßig reinigen",
      balanced: "Kopfhaut-Basis: einfach reinigen",
    }
    return routeTitles[preview.needs.shampoo.scalpRoute]
  }
  if (product.category === "conditioner") {
    if (preview.needs.conditioner.balance === "moisture") return "Längen: geschmeidig halten"
    if (preview.needs.conditioner.balance === "protein") return "Längen: Struktur unterstützen"
    return "Längen: ausgewogen pflegen"
  }
  if (product.category === "bondbuilder") return "Behandelte Längen: gezielt ergänzen"
  if (product.category === "protein_mask") return "Haarbruch: in Abständen stärken"
  if (product.category === "moisture_mask") return "Trockenheit: in Abständen ergänzen"
  if (product.category === "leave_in") {
    return isCurlLeaveIn(product)
      ? "Struktur: nach der Wäsche bündeln"
      : "Raue Oberfläche: zwischen den Wäschen schützen"
  }
  return "Spitzen: sparsam schützen"
}

function resolveCategoryLabel(product: OfferPreviewProductCard): string {
  if (product.category === "shampoo") return product.categoryLabel
  if (product.category === "conditioner") return "Conditioner · Beispiel"
  if (product.category === "bondbuilder") return "Bond-Pflege · Vorschlag"
  if (product.category === "protein_mask") return "Proteinmaske · Vorschlag"
  if (product.category === "moisture_mask") return "Feuchtigkeitsmaske · Vorschlag"
  if (product.category === "leave_in") {
    return isCurlLeaveIn(product) ? "Locken-Leave-in · Vorschlag" : "Leave-in · Vorschlag"
  }
  return "Haaröl · Vorschlag"
}

function resolveProductCopy(
  product: OfferPreviewProductCard,
  preview: QuizGuidedStoryPreview,
): GuidedStoryRoutineProductCopy {
  const popover =
    product.category === "shampoo"
      ? resolveShampooPopover(preview.needs.shampoo.scalpRoute, product)
      : product.category === "conditioner"
        ? resolveConditionerPopover(preview.needs.conditioner.balance, product)
        : resolveTargetedPopover(product.category, product)

  return {
    key: product.key,
    categoryLabel: resolveCategoryLabel(product),
    sectionTitle: resolveSectionTitle(product, preview),
    popover,
  }
}

export function resolveGuidedStoryRoutineCopy(
  preview: QuizGuidedStoryPreview,
): GuidedStoryRoutineCopy {
  const hasTargetedProduct = preview.products.some((product) => product.suggested)

  return {
    continuation: "So setzt deine Routine bei deinen drei wichtigsten Themen an.",
    basisTitle: "Deine Basis",
    basisIntro: hasTargetedProduct
      ? "Fast jede Routine beginnt mit Shampoo und Conditioner. Hier sind zwei passende Beispiele für deine Basis – plus der Schritt, der gezielt bei deinen wichtigsten Themen ansetzt."
      : "Fast jede Routine beginnt mit Shampoo und Conditioner. Hier sind zwei passende Beispiele für deine Basis.",
    targetedTitle: "Gezielte Ergänzung",
    lockedTeasers: [
      { key: "further-care", label: "Weitere Pflege" },
      { key: "tools", label: "Tools" },
    ],
    lockedPopover: GUIDED_STORY_LOCKED_POPOVER,
    lockedCtaLabel: GUIDED_STORY_LOCKED_CTA_LABEL,
    handoff: GUIDED_STORY_CHAPTER_TWO_HANDOFF,
    handoffCtaLabel: GUIDED_STORY_CHAPTER_TWO_CTA_LABEL,
    products: preview.products.map((product) => resolveProductCopy(product, preview)),
  }
}
