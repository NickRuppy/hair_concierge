import type {
  ShampooDecision,
  ConditionerDecision,
  LeaveInDecision,
  OilDecision,
  MaskDecision,
} from "@/lib/types"

/** Union of all category decision types. */
export type AnyCategoryDecision =
  | ShampooDecision
  | ConditionerDecision
  | LeaveInDecision
  | OilDecision
  | MaskDecision
