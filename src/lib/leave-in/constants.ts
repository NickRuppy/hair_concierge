export const POST_WASH_ACTIONS = [
  "air_dry",
  "blow_dry_only",
  "heat_tool_styling",
  "non_heat_styling",
] as const
export type PostWashAction = (typeof POST_WASH_ACTIONS)[number]

export const POST_WASH_ACTION_LABELS = {
  air_dry: "Lufttrocknen",
  blow_dry_only: "Nur Foehnen",
  heat_tool_styling: "Hitzetools (z.B. Glaetteisen)",
  non_heat_styling: "Styling ohne Hitze",
} as const satisfies Record<PostWashAction, string>

export const POST_WASH_ACTION_OPTIONS = POST_WASH_ACTIONS.map((value) => ({
  value,
  label: POST_WASH_ACTION_LABELS[value],
}))

export const ROUTINE_PREFERENCES = [
  "minimal",
  "balanced",
  "advanced",
] as const
export type RoutinePreference = (typeof ROUTINE_PREFERENCES)[number]

export const ROUTINE_PREFERENCE_LABELS = {
  minimal: "Minimal",
  balanced: "Ausgewogen",
  advanced: "Detailliert",
} as const satisfies Record<RoutinePreference, string>

export const ROUTINE_PREFERENCE_OPTIONS = ROUTINE_PREFERENCES.map((value) => ({
  value,
  label: ROUTINE_PREFERENCE_LABELS[value],
}))

export const ROUTINE_PRODUCTS = [
  "shampoo",
  "conditioner",
  "leave_in",
  "oil",
  "mask",
  "heat_protectant",
  "serum",
  "scrub",
] as const
export type RoutineProduct = (typeof ROUTINE_PRODUCTS)[number]

export const ROUTINE_PRODUCT_LABELS = {
  shampoo: "Shampoo",
  conditioner: "Conditioner",
  leave_in: "Leave-in",
  oil: "Oel",
  mask: "Maske",
  heat_protectant: "Hitzeschutz",
  serum: "Serum",
  scrub: "Scrub",
} as const satisfies Record<RoutineProduct, string>

export const ROUTINE_PRODUCT_OPTIONS = ROUTINE_PRODUCTS.map((value) => ({
  value,
  label: ROUTINE_PRODUCT_LABELS[value],
}))

export const LEAVE_IN_FORMATS = [
  "spray",
  "milk",
  "lotion",
  "cream",
  "serum",
] as const
export type LeaveInFormat = (typeof LEAVE_IN_FORMATS)[number]

export const LEAVE_IN_WEIGHTS = ["light", "medium", "rich"] as const
export type LeaveInWeight = (typeof LEAVE_IN_WEIGHTS)[number]

export const LEAVE_IN_ROLES = [
  "replacement_conditioner",
  "extension_conditioner",
  "styling_prep",
  "oil_replacement",
] as const
export type LeaveInRole = (typeof LEAVE_IN_ROLES)[number]

export const LEAVE_IN_CARE_BENEFITS = [
  "moisture",
  "protein",
  "repair",
  "detangling",
  "anti_frizz",
  "shine",
  "curl_definition",
  "volume",
] as const
export type LeaveInCareBenefit = (typeof LEAVE_IN_CARE_BENEFITS)[number]

export const LEAVE_IN_INGREDIENT_FLAGS = [
  "silicones",
  "polymers",
  "oils",
  "proteins",
  "humectants",
] as const
export type LeaveInIngredientFlag = (typeof LEAVE_IN_INGREDIENT_FLAGS)[number]

export const LEAVE_IN_APPLICATION_STAGES = [
  "towel_dry",
  "dry_hair",
  "pre_heat",
  "post_style",
] as const
export type LeaveInApplicationStage = (typeof LEAVE_IN_APPLICATION_STAGES)[number]

export interface ProductLeaveInSpecs {
  product_id: string
  format: LeaveInFormat
  weight: LeaveInWeight
  roles: LeaveInRole[]
  provides_heat_protection: boolean
  heat_protection_max_c: number | null
  heat_activation_required: boolean
  care_benefits: LeaveInCareBenefit[]
  ingredient_flags: LeaveInIngredientFlag[]
  application_stage: LeaveInApplicationStage[]
  created_at?: string
  updated_at?: string
}

export function isLeaveInCategory(category: string | null | undefined): boolean {
  if (!category) return false
  const normalized = category.trim().toLowerCase()
  return normalized === "leave-in" || normalized === "leave_in" || normalized === "leave in"
}
