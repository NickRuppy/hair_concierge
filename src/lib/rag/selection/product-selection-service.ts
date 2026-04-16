import { matchProducts } from "@/lib/rag/product-matcher"
import {
  selectBondbuilderProductsWithEngine,
  selectConditionerProductsWithEngine,
  selectDeepCleansingShampooProductsWithEngine,
  selectDryShampooProductsWithEngine,
  selectLeaveInProductsWithEngine,
  selectMaskProductsWithEngine,
  selectOilProductsWithEngine,
  selectPeelingProductsWithEngine,
  selectShampooProductsWithEngine,
} from "@/lib/recommendation-engine"
import type { PersistenceRoutineItemRow } from "@/lib/recommendation-engine/adapters/from-persistence"
import { applyProductMemoryConstraints } from "@/lib/rag/user-memory"
import type { SelectionResult } from "@/lib/rag/selection/types"
import type { HairProfile, ProductCategory } from "@/lib/types"
import type { UserMemoryContext } from "@/lib/rag/user-memory"

async function selectGeneric(
  message: string,
  hairProfile: HairProfile | null,
): Promise<SelectionResult> {
  const products = await matchProducts({
    query: message,
    thickness: hairProfile?.thickness ?? undefined,
    concerns: [],
    count: 3,
  })

  return { products }
}

export async function selectProducts(params: {
  category: ProductCategory
  message: string
  hairProfile: HairProfile | null
  memoryContext: UserMemoryContext
  shouldPlanRoutine: boolean
  routineItems: PersistenceRoutineItemRow[]
}): Promise<SelectionResult> {
  const { category, message, hairProfile, memoryContext, shouldPlanRoutine, routineItems } = params

  if (shouldPlanRoutine) {
    return { products: [] }
  }

  let result: SelectionResult

  switch (category) {
    case "shampoo":
      result = {
        products: await selectShampooProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "conditioner":
      result = {
        products: await selectConditionerProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "leave_in":
      result = {
        products: await selectLeaveInProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "mask":
      result = {
        products: await selectMaskProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "oil":
      result = {
        products: await selectOilProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "bondbuilder":
      result = {
        products: await selectBondbuilderProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "deep_cleansing_shampoo":
      result = {
        products: await selectDeepCleansingShampooProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "dry_shampoo":
      result = {
        products: await selectDryShampooProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    case "peeling":
      result = {
        products: await selectPeelingProductsWithEngine({
          message,
          hairProfile,
          routineItems,
        }),
      }
      break
    default:
      result = await selectGeneric(message, hairProfile)
      break
  }

  result.products = applyProductMemoryConstraints(result.products, memoryContext)
  return result
}
