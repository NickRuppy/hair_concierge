import type { HairProfile, ProductCategory } from "@/lib/types"
import { ROUTER_SLOT_KEYS } from "@/lib/rag/retrieval-constants"

type SlotKey = (typeof ROUTER_SLOT_KEYS)[number]

/** German question templates for each missing information slot */
const SLOT_QUESTIONS: Record<SlotKey, string> = {
  problem:
    "Was genau ist dein Anliegen? Beschreib mir mal, was dich an deinen Haaren stört.",
  duration:
    "Seit wann fällt dir das auf? Hat sich kürzlich was verändert?",
  products_tried:
    "Was benutzt du aktuell so? Shampoo, Conditioner, irgendwas Leave-in?",
  routine:
    "Wie sieht deine Routine aus? Wie oft wäschst du deine Haare?",
  special_circumstances:
    "Gibt es besondere Umstände — Färben, Hitze, Schwangerschaft, Medikamente?",
}

/** Category-specific supplemental questions */
const SCALP_QUESTION =
  "Wie würdest du deine Kopfhaut beschreiben — eher fettig, trocken, oder ausgeglichen?"
const PROTEIN_MOISTURE_QUESTION =
  "Hast du mal den Zugtest gemacht? Einzelnes Haar ziehen — bricht es direkt, dehnt es sich, oder federt es zurück?"

/** Priority order for selecting which questions to ask (most important first) */
const SLOT_PRIORITY: SlotKey[] = [
  "problem",
  "routine",
  "products_tried",
  "duration",
  "special_circumstances",
]

/**
 * Determines which information slots are missing from the classification filters.
 */
function getMissingSlots(
  filters: Record<string, string | string[] | null>,
): SlotKey[] {
  const missing: SlotKey[] = []
  for (const key of ROUTER_SLOT_KEYS) {
    const val = filters[key]
    const isEmpty =
      val === null ||
      val === undefined ||
      (typeof val === "string" && val.trim() === "") ||
      (Array.isArray(val) && val.length === 0)
    if (isEmpty) {
      missing.push(key)
    }
  }
  return missing
}

/**
 * Builds a prioritized list of 2–3 clarification questions based on missing slots
 * and category-specific needs.
 *
 * @param filters - Normalized filter values from classification
 * @param productCategory - Optional product category for category-specific questions
 * @param hairProfile - User's hair profile for checking existing data
 * @returns Array of German question strings (max 3)
 */
export function buildClarificationQuestions(
  filters: Record<string, string | string[] | null>,
  productCategory: ProductCategory,
  hairProfile: HairProfile | null,
): string[] {
  const missingSlots = getMissingSlots(filters)
  const questions: string[] = []

  // Add slot-based questions in priority order
  for (const slot of SLOT_PRIORITY) {
    if (questions.length >= 3) break
    if (missingSlots.includes(slot)) {
      questions.push(SLOT_QUESTIONS[slot])
    }
  }

  // Category-specific additions (replace the least important question if at capacity)
  if (productCategory === "shampoo" && !hairProfile?.scalp_type) {
    if (questions.length < 3) {
      questions.push(SCALP_QUESTION)
    } else {
      questions[questions.length - 1] = SCALP_QUESTION
    }
  }

  if (productCategory === "conditioner" && !hairProfile?.protein_moisture_balance) {
    if (questions.length < 3) {
      questions.push(PROTEIN_MOISTURE_QUESTION)
    } else {
      questions[questions.length - 1] = PROTEIN_MOISTURE_QUESTION
    }
  }

  // Ensure at least 2 questions if there are missing slots
  if (questions.length < 2 && missingSlots.length > 0) {
    for (const slot of SLOT_PRIORITY) {
      if (questions.length >= 2) break
      if (!missingSlots.includes(slot)) continue
      const q = SLOT_QUESTIONS[slot]
      if (!questions.includes(q)) {
        questions.push(q)
      }
    }
  }

  return questions.slice(0, 3)
}
