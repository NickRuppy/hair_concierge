import type { HairProfile, HairTexture, Concern, Goal, RoutineProduct } from "@/lib/types"
import type { IconName } from "@/components/ui/icon"
import { deriveLeaveInStylingContextFromStages } from "@/lib/profile/signal-derivations"

export interface SuggestedPrompt {
  text: string
  icon?: IconName
}

const FALLBACK_PROMPTS: SuggestedPrompt[] = [
  { text: "Welche Routine passt am besten zu meinem Haar?", icon: "product-shampoo" },
  { text: "Welches Shampoo passt zu meiner Kopfhaut?", icon: "product-shampoo" },
  {
    text: "Welcher Conditioner passt gerade am besten zu meinem Haar?",
    icon: "product-conditioner",
  },
  { text: "Was hilft gegen Frizz?", icon: "goal-frizz" },
]

const TEXTURE_ICON: Record<HairTexture, IconName> = {
  straight: "hair-straight",
  wavy: "hair-wavy",
  curly: "hair-curly",
  coily: "hair-coily",
}

function hasTexturedHair(profile: HairProfile): boolean {
  return (
    profile.hair_texture === "wavy" ||
    profile.hair_texture === "curly" ||
    profile.hair_texture === "coily"
  )
}

function hasConcern(profile: HairProfile, concern: Concern): boolean {
  return (profile.concerns ?? []).includes(concern)
}

function hasGoal(profile: HairProfile, goal: Goal): boolean {
  return (profile.goals ?? []).includes(goal)
}

function hasRoutineProduct(profile: HairProfile, product: RoutineProduct): boolean {
  return (profile.current_routine_products ?? []).includes(product)
}

function hasMeaningfulProfile(profile: HairProfile | null): profile is HairProfile {
  if (!profile) return false

  return Boolean(
    profile.hair_texture ||
    profile.thickness ||
    profile.density ||
    profile.scalp_type ||
    (profile.scalp_condition && profile.scalp_condition !== "none") ||
    profile.protein_moisture_balance ||
    profile.cuticle_condition ||
    profile.wash_frequency ||
    profile.heat_styling ||
    profile.desired_volume ||
    profile.routine_preference ||
    (profile.concerns ?? []).length > 0 ||
    (profile.goals ?? []).length > 0 ||
    (profile.chemical_treatment ?? []).length > 0 ||
    (profile.current_routine_products ?? []).length > 0 ||
    profile.drying_method ||
    (profile.styling_tools ?? []).length > 0,
  )
}

function hasHeatOrStylingSignal(profile: HairProfile): boolean {
  const stylingContext = deriveLeaveInStylingContextFromStages(
    profile.drying_method,
    profile.heat_styling,
    profile.styling_tools,
  )

  return Boolean(
    (profile.heat_styling && profile.heat_styling !== "never") ||
    stylingContext !== null ||
    (profile.styling_tools ?? []).length > 0 ||
    hasRoutineProduct(profile, "heat_protectant"),
  )
}

function hasLeaveInSignals(profile: HairProfile): boolean {
  return Boolean(
    hasHeatOrStylingSignal(profile) ||
    hasRoutineProduct(profile, "leave_in") ||
    hasGoal(profile, "less_frizz") ||
    hasGoal(profile, "curl_definition") ||
    hasConcern(profile, "frizz"),
  )
}

function hasDamageSignals(profile: HairProfile): boolean {
  return Boolean(
    profile.cuticle_condition === "slightly_rough" ||
    profile.cuticle_condition === "rough" ||
    profile.protein_moisture_balance === "snaps" ||
    hasConcern(profile, "dryness") ||
    hasConcern(profile, "hair_damage") ||
    hasConcern(profile, "split_ends") ||
    hasGoal(profile, "moisture") ||
    hasGoal(profile, "anti_breakage") ||
    profile.chemical_treatment.includes("colored") ||
    profile.chemical_treatment.includes("bleached"),
  )
}

function buildRoutinePrompt(profile: HairProfile): SuggestedPrompt {
  return {
    text: "Welche Routine passt am besten zu meinem Haarprofil?",
    icon: profile.hair_texture ? TEXTURE_ICON[profile.hair_texture] : "product-shampoo",
  }
}

function buildScalpPrompt(profile: HairProfile): SuggestedPrompt {
  if (profile.scalp_condition === "dry_flakes") {
    return { text: "Was hilft bei trockenen Schuppen?", icon: "scalp-dry-flakes" }
  }

  if (profile.scalp_condition === "irritated") {
    return { text: "Was hilft bei gereizter Kopfhaut?", icon: "scalp-irritated" }
  }

  if (profile.scalp_condition === "dandruff" || hasConcern(profile, "dandruff")) {
    return { text: "Was hilft bei Schuppen?", icon: "scalp-flaky" }
  }

  if (
    profile.scalp_type === "oily" ||
    hasConcern(profile, "oily_scalp") ||
    profile.wash_frequency === "daily"
  ) {
    return {
      text: "Welches Shampoo passt zu meinem schnell fettenden Ansatz?",
      icon: "scalp-oily",
    }
  }

  return {
    text: "Welches Shampoo passt zu meiner Kopfhaut?",
    icon: profile.scalp_type === "dry" ? "scalp-dry" : "product-shampoo",
  }
}

function buildCarePrompt(profile: HairProfile): SuggestedPrompt {
  if (profile.protein_moisture_balance === "snaps") {
    return {
      text: "Welcher Conditioner passt bei Feuchtigkeitsmangel?",
      icon: "goal-moisture",
    }
  }

  if (
    hasRoutineProduct(profile, "conditioner") &&
    (hasLeaveInSignals(profile) || hasTexturedHair(profile))
  ) {
    return {
      text: "Welcher Leave-in passt zu meinem Styling-Alltag?",
      icon: "product-leave-in",
    }
  }

  if (profile.thickness && profile.protein_moisture_balance) {
    return {
      text: "Welcher Conditioner passt gerade am besten zu meinem Haar?",
      icon: "product-conditioner",
    }
  }

  if (hasLeaveInSignals(profile)) {
    return {
      text: "Welcher Leave-in passt zu meinem Styling-Alltag?",
      icon: "product-leave-in",
    }
  }

  if (hasDamageSignals(profile)) {
    return {
      text: "Brauche ich eher Maske oder Leave-in für meine Längen?",
      icon: "product-mask",
    }
  }

  return {
    text: "Welcher Conditioner passt gerade am besten zu meinem Haar?",
    icon: "product-conditioner",
  }
}

function buildOutcomePrompt(profile: HairProfile): SuggestedPrompt {
  if (hasConcern(profile, "frizz") || hasGoal(profile, "less_frizz")) {
    return { text: "Was hilft gegen Frizz bei meinem Haarprofil?", icon: "goal-frizz" }
  }

  if (profile.desired_volume === "more" || hasGoal(profile, "volume")) {
    return {
      text: "Wie bekomme ich mehr Volumen, ohne zu beschweren?",
      icon: "goal-volume",
    }
  }

  if (hasTexturedHair(profile) && hasDamageSignals(profile)) {
    return { text: "Was hilft gegen Frizz bei meinem Haarprofil?", icon: "goal-frizz" }
  }

  return {
    text: "Was ist der nächste sinnvolle Schritt für mein Haarprofil?",
    icon: "arrow-right",
  }
}

export function generateSuggestedPrompts(profile: HairProfile | null): SuggestedPrompt[] {
  if (!hasMeaningfulProfile(profile)) {
    return FALLBACK_PROMPTS
  }

  return [
    buildRoutinePrompt(profile),
    buildScalpPrompt(profile),
    buildCarePrompt(profile),
    buildOutcomePrompt(profile),
  ]
}
