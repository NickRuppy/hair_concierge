import "server-only"

import { getOilSharedLab } from "./oil"
import { getMaskSharedLab } from "./mask"
import { getShampooSharedLab } from "./shampoo"
import { getConditionerSharedLab } from "./conditioner"
import { getLeaveInSharedLab } from "./leave-in"
import type { ResearchCategory, ResearchLabData } from "./model"

export function getSharedResearchLab(
  category: ResearchCategory,
  dataset = "default",
  itemId?: string,
): ResearchLabData {
  if (
    category === "oil" &&
    (dataset === "default" || dataset === "intake" || dataset === "candidate")
  )
    return getOilSharedLab(dataset, itemId)
  if (category === "mask" && dataset === "default") return getMaskSharedLab(itemId)
  if (category === "shampoo") return getShampooSharedLab(dataset, itemId)
  if (category === "conditioner" && dataset === "default") return getConditionerSharedLab(itemId)
  if (category === "leave-in" && dataset === "default") return getLeaveInSharedLab(itemId)
  throw new Error("Kategorie oder Datensatz ist noch nicht verbunden.")
}
