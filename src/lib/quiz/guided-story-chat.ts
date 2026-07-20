import type { OfferPreviewCategory, OfferPreviewScalpRoute } from "./offer-preview-types"
import type { QuizGuidedStoryPreview } from "./guided-story-preview"
import type { GuidedStoryPriorityFamily } from "./guided-story-priorities"

type RoutineCategory = OfferPreviewCategory | null
type RoutineVariant = NonNullable<QuizGuidedStoryPreview["needs"]["extra"]>["variant"]

export interface GuidedStoryChatExchange {
  id:
    | "dandruff_shampoo"
    | "dry_scalp_shampoo"
    | "oily_scalp_shampoo"
    | "bond_care"
    | "protein_mask"
    | "moisture_mask"
    | "leave_in"
    | "curl_leave_in"
    | "hair_oil"
    | "fine_hair_conditioner"
    | "base_order"
    | "safe_fallback"
  routineCategory: RoutineCategory
  routineVariant?: RoutineVariant
  selectionMode?: "positive_foundation" | "safe_fallback"
  priorityFamilies: readonly GuidedStoryPriorityFamily[]
  scalpRoutes?: readonly OfferPreviewScalpRoute[]
  requiredKnownFacts?: { thickness?: QuizGuidedStoryPreview["needs"]["shampoo"]["thickness"] }
  question: string
  answer: string
  trackerSteps: readonly string[]
}

export const GUIDED_STORY_CHAT_EXCHANGES: readonly GuidedStoryChatExchange[] = [
  {
    id: "dandruff_shampoo",
    routineCategory: "shampoo",
    priorityFamilies: ["scalp_flakes"],
    scalpRoutes: ["dandruff"],
    question: "Wie wende ich mein Shampoo bei Schuppen richtig an?",
    answer:
      "Trage das Shampoo direkt auf die Kopfhaut auf und halte dich bei Einwirkzeit und Häufigkeit an die Produktangabe. Spüle es gründlich aus; der Conditioner kommt anschließend nur in Längen und Spitzen.",
    trackerSteps: ["Antischuppen-Shampoo", "Conditioner"],
  },
  {
    id: "dry_scalp_shampoo",
    routineCategory: "shampoo",
    priorityFamilies: ["scalp_comfort"],
    scalpRoutes: ["dry", "irritated"],
    question: "Wie wasche ich meine Kopfhaut möglichst sanft?",
    answer:
      "Verteile dein mildes Shampoo auf Kopfhaut und Ansatz und massiere sanft, ohne stark zu reiben. Spüle gründlich aus; der Conditioner kommt nur in Längen und Spitzen.",
    trackerSteps: ["Mildes Shampoo", "Conditioner"],
  },
  {
    id: "oily_scalp_shampoo",
    routineCategory: "shampoo",
    priorityFamilies: ["scalp_comfort"],
    scalpRoutes: ["oily"],
    question: "Wie reinige ich meinen Ansatz, ohne die Längen zu überpflegen?",
    answer:
      "Shampoo kommt auf Kopfhaut und Ansatz; der Schaum beim Ausspülen reicht für die Längen. Conditioner gibst du nur in Längen und Spitzen. Dein Wasch-Rhythmus folgt deinem schnell fettenden Ansatz.",
    trackerSteps: ["Shampoo", "Conditioner"],
  },
  {
    id: "bond_care",
    routineCategory: "bondbuilder",
    priorityFamilies: ["strength_damage"],
    question: "Wie baue ich die Bond-Pflege bei meinen strapazierten Längen ein?",
    answer:
      "Die Bond-Pflege ist dein gezielter Zusatzschritt für die behandelten, bruchanfälligen Längen. Sie ergänzt Shampoo und Conditioner, ersetzt die Basispflege aber nicht. Die genaue Anwendung folgt der Produktangabe.",
    trackerSteps: ["Bond-Pflege", "Shampoo", "Conditioner"],
  },
  {
    id: "protein_mask",
    routineCategory: "protein_mask",
    priorityFamilies: ["strength_damage"],
    question: "Wie kombiniere ich Proteinmaske und Conditioner?",
    answer:
      "Nutze die Proteinmaske gelegentlich nach dem Shampoo, vor allem in Längen und Spitzen, und spüle sie gründlich aus. Ob danach noch Conditioner folgt, richtet sich nach der Produktangabe.",
    trackerSteps: ["Shampoo", "Proteinmaske", "Conditioner"],
  },
  {
    id: "moisture_mask",
    routineCategory: "moisture_mask",
    priorityFamilies: ["moisture_dryness"],
    question: "Brauche ich die Feuchtigkeitsmaske bei jeder Haarwäsche?",
    answer:
      "Nicht automatisch. Nutze die Feuchtigkeitsmaske gelegentlich nach dem Shampoo, vor allem in Längen und Spitzen, und spüle sie gründlich aus. Rhythmus und ein möglicher Conditioner danach richten sich nach der Produktangabe.",
    trackerSteps: ["Shampoo", "Feuchtigkeitsmaske", "Conditioner"],
  },
  {
    id: "leave_in",
    routineCategory: "leave_in",
    priorityFamilies: ["surface_manageability"],
    question: "Wann benutze ich das Leave-in, damit meine Längen geschmeidiger bleiben?",
    answer:
      "Das Leave-in kommt nach Shampoo und Conditioner ins handtuchtrockene Haar. Verteile es in Längen und Spitzen und lass den Ansatz aus.",
    trackerSteps: ["Shampoo", "Conditioner", "Leave-in"],
  },
  {
    id: "curl_leave_in",
    routineCategory: "leave_in",
    routineVariant: "curl",
    priorityFamilies: ["definition", "surface_manageability"],
    question: "Wie benutze ich das Leave-in, damit meine Struktur gebündelt bleibt?",
    answer:
      "Verteile das Leave-in nach dem Waschen im noch feuchten Haar, vor allem in Längen und Spitzen. Arbeite es von unten nach oben ein und knete deine Wellen oder Locken anschließend in Form.",
    trackerSteps: ["Shampoo", "Conditioner", "Locken-Leave-in"],
  },
  {
    id: "hair_oil",
    routineCategory: "oil",
    priorityFamilies: ["ends_protection"],
    question: "Wann trage ich das Öl auf meine Spitzen auf?",
    answer:
      "Das Öl ist der letzte Schritt. Verteile wenige Tropfen in Längen und Spitzen, besonders dort, wo sie am stärksten beansprucht sind. Es glättet optisch; vorhandenen Spliss entfernt nur ein Schnitt.",
    trackerSteps: ["Shampoo", "Conditioner", "Haaröl"],
  },
  {
    id: "fine_hair_conditioner",
    routineCategory: "conditioner",
    priorityFamilies: ["volume_weight"],
    requiredKnownFacts: { thickness: "fine" },
    question: "Wie benutze ich Conditioner, ohne meine Haare zu beschweren?",
    answer:
      "Bei deinem feinen Haar kommt eine kleine Menge Conditioner nur in Längen und Spitzen, nicht an den Ansatz. Spüle ihn gründlich aus. So bekommst du Pflege, ohne die Basis unnötig zu beschweren.",
    trackerSteps: ["Shampoo", "Conditioner"],
  },
  {
    id: "base_order",
    routineCategory: null,
    selectionMode: "positive_foundation",
    priorityFamilies: [],
    question: "In welcher Reihenfolge benutze ich Shampoo und Conditioner?",
    answer:
      "Zuerst reinigst du Kopfhaut und Ansatz mit Shampoo. Danach kommt der Conditioner in Längen und Spitzen; nach der Einwirkzeit spülst du ihn gründlich aus. Das ist deine Basis bei jeder Haarwäsche.",
    trackerSteps: ["Shampoo", "Conditioner"],
  },
  {
    id: "safe_fallback",
    routineCategory: null,
    selectionMode: "safe_fallback",
    priorityFamilies: [],
    question: "In welcher Reihenfolge benutze ich Shampoo und Conditioner?",
    answer:
      "Zuerst reinigst du Kopfhaut und Ansatz mit Shampoo. Danach kommt der Conditioner in Längen und Spitzen; nach der Einwirkzeit spülst du ihn gründlich aus. Das ist deine Basis bei jeder Haarwäsche.",
    trackerSteps: ["Shampoo", "Conditioner"],
  },
]

type ChatPreview = Pick<QuizGuidedStoryPreview, "priorities" | "needs" | "products">

function hasSelectedCategory(
  preview: ChatPreview,
  category: Exclude<RoutineCategory, null>,
): boolean {
  return preview.products.some((product) => product.category === category)
}

function hasRequiredFacts(exchange: GuidedStoryChatExchange, preview: ChatPreview): boolean {
  const facts = exchange.requiredKnownFacts
  return !facts || !facts.thickness || facts.thickness === preview.needs.shampoo.thickness
}

function hasMatchingVariant(exchange: GuidedStoryChatExchange, preview: ChatPreview): boolean {
  if (exchange.routineCategory !== "leave_in") return true
  return (exchange.routineVariant ?? "general") === (preview.needs.extra?.variant ?? "general")
}

function isAvailable(exchange: GuidedStoryChatExchange, preview: ChatPreview): boolean {
  return (
    exchange.routineCategory !== null &&
    hasSelectedCategory(preview, exchange.routineCategory) &&
    (!exchange.scalpRoutes || exchange.scalpRoutes.includes(preview.needs.shampoo.scalpRoute)) &&
    hasMatchingVariant(exchange, preview) &&
    hasRequiredFacts(exchange, preview)
  )
}

function fallback(selectionMode: "positive_foundation" | "safe_fallback"): GuidedStoryChatExchange {
  const exchange = GUIDED_STORY_CHAT_EXCHANGES.find(
    (candidate) => candidate.selectionMode === selectionMode,
  )
  if (!exchange) throw new Error(`Missing guided story chat ${selectionMode} exchange`)
  return exchange
}

export function selectGuidedStoryChatExchange(preview: ChatPreview): GuidedStoryChatExchange {
  const safePriorities = preview.priorities.filter((priority) => !priority.isFallback)

  for (const priority of safePriorities) {
    const exchange = GUIDED_STORY_CHAT_EXCHANGES.find(
      (candidate) =>
        candidate.priorityFamilies.includes(priority.family) && isAvailable(candidate, preview),
    )
    if (exchange) return exchange
  }

  return fallback(safePriorities.length === 0 ? "safe_fallback" : "positive_foundation")
}
