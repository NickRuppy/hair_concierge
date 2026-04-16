import {
  buildRoutineItemsFromCurrentRoutineProducts,
  loadRoutineItemsForEngine,
  selectConditionerProductsWithEngine,
  selectLeaveInProductsWithEngine,
  selectMaskProductsWithEngine,
  selectOilProductsWithEngine,
  selectShampooProductsWithEngine,
  type PersistenceRoutineItemRow,
} from "@/lib/recommendation-engine"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import { getRoutineAutofillSlots } from "@/lib/routines/planner"
import type { HairProfile, Product, RoutinePlan, RoutineSlotAdvice } from "@/lib/types"

const ROUTINE_ATTACHMENT_SLOT_LIMIT = 2

type MemoryContextLike = {
  enabled: boolean
  dislikedProductNames: string[]
}

async function loadRoutineItemsForRoutineAttachments(
  hairProfile: HairProfile | null,
): Promise<PersistenceRoutineItemRow[]> {
  if (hairProfile?.user_id) {
    const persisted = await loadRoutineItemsForEngine(hairProfile.user_id)
    if (persisted.length > 0) {
      return persisted
    }
  }

  return buildRoutineItemsFromCurrentRoutineProducts(hairProfile)
}

async function attachProductsForSlot(
  slot: RoutineSlotAdvice,
  hairProfile: HairProfile | null,
  routineItems: PersistenceRoutineItemRow[],
): Promise<Product[]> {
  const query = slot.product_query ?? `Ich suche ein Produkt fuer den Slot ${slot.label}.`

  switch (slot.category) {
    case "shampoo":
      return selectShampooProductsWithEngine({
        message: query,
        hairProfile,
        routineItems,
      })
    case "conditioner":
      return selectConditionerProductsWithEngine({
        message: query,
        hairProfile,
        routineItems,
      })
    case "leave_in":
      return selectLeaveInProductsWithEngine({
        message: query,
        hairProfile,
        routineItems,
      })
    case "mask":
      return selectMaskProductsWithEngine({
        message: query,
        hairProfile,
        routineItems,
      })
    case "oil":
      return selectOilProductsWithEngine({
        message: query,
        hairProfile,
        routineItems,
      })
    default:
      return []
  }
}

export async function attachProductsToRoutinePlan(params: {
  plan: RoutinePlan
  hairProfile: HairProfile | null
  memoryContext: MemoryContextLike
  supabase?: unknown
}): Promise<{ plan: RoutinePlan; matchedProducts: Product[] }> {
  const { plan, hairProfile, memoryContext } = params
  const slotAttachments = new Map<string, Product[]>()
  const matchedProducts: Product[] = []
  const autofillSlots = getRoutineAutofillSlots(plan)
  const routineItems = await loadRoutineItemsForRoutineAttachments(hairProfile)

  for (let start = 0; start < autofillSlots.length; start += ROUTINE_ATTACHMENT_SLOT_LIMIT) {
    if (slotAttachments.size >= ROUTINE_ATTACHMENT_SLOT_LIMIT) break

    const batch = autofillSlots.slice(start, start + ROUTINE_ATTACHMENT_SLOT_LIMIT)
    const batchResults = await Promise.all(
      batch.map(async (slot) => ({
        slot,
        products: await attachProductsForSlot(slot, hairProfile, routineItems),
      })),
    )

    for (const { slot, products } of batchResults) {
      if (slotAttachments.size >= ROUTINE_ATTACHMENT_SLOT_LIMIT) break
      if (products.length === 0) continue

      const constrained = applyProductMemoryConstraints(products, memoryContext)
      if (constrained.length === 0) continue

      slotAttachments.set(slot.id, constrained)
      matchedProducts.push(...constrained)
    }
  }

  if (slotAttachments.size === 0) {
    return { plan, matchedProducts: [] }
  }

  return {
    plan: {
      ...plan,
      sections: plan.sections.map((section) => ({
        ...section,
        slots: section.slots.map((slot) => {
          const attachedProducts = slotAttachments.get(slot.id)
          return attachedProducts ? { ...slot, attached_products: attachedProducts } : slot
        }),
      })),
    },
    matchedProducts,
  }
}
