import type { IconName } from "@/components/ui/icon"
import type { QuizAnswers } from "@/lib/quiz/types"
import type {
  PortraitConfig,
  PortraitHairPattern,
  PortraitLength,
} from "@/lib/quiz/portrait-config"

const PERSONAL_PLAN_ASSET_BASE = "/images/funnels/personal-plan-quiz"

const TEXTURE_IMAGES: Record<string, { src: string; alt: string }> = {
  straight: { src: `${PERSONAL_PLAN_ASSET_BASE}/texture-straight.webp`, alt: "Glattes Haar" },
  wavy: { src: `${PERSONAL_PLAN_ASSET_BASE}/texture-wavy.webp`, alt: "Welliges Haar" },
  curly: { src: `${PERSONAL_PLAN_ASSET_BASE}/texture-curly.webp`, alt: "Lockiges Haar" },
  coily: { src: `${PERSONAL_PLAN_ASSET_BASE}/texture-coily.webp`, alt: "Krauses Haar" },
}

const THICKNESS_IMAGES: Record<string, { src: string; alt: string }> = {
  fine: { src: `${PERSONAL_PLAN_ASSET_BASE}/thickness-fine.webp`, alt: "Feines Haar" },
  normal: { src: `${PERSONAL_PLAN_ASSET_BASE}/thickness-normal.webp`, alt: "Mitteldickes Haar" },
  coarse: { src: `${PERSONAL_PLAN_ASSET_BASE}/thickness-coarse.webp`, alt: "Dickes Haar" },
}

const HAIR_TEXTURES = ["straight", "wavy", "curly", "coily"] as const
const HAIR_LENGTHS = ["very_short", "short", "medium", "long", "very_long"] as const

const GOAL_ICONS: Record<string, IconName> = {
  hydration: "goal-moisture",
  moisture: "goal-moisture",
  shine: "goal-shine",
  volume: "goal-volume",
  less_volume: "goal-volume",
  volume_balance: "goal-volume",
  repair: "goal-repair",
  healthier_hair: "goal-repair",
  strength: "goal-strength",
  strength_ends: "goal-strength",
  curl_definition: "goal-definition",
  shape_definition: "goal-definition",
  frizz_control: "goal-frizz",
  frizz_surface: "goal-frizz",
  color_protection: "goal-color-protection",
  scalp_balance: "goal-scalp-health",
  manageability_styling: "goal-smoothness",
  smoothness: "goal-smoothness",
  growth: "goal-growth",
}

const CONCERN_ICONS: Record<string, IconName> = {
  dry_lengths: "goal-moisture",
  frizz_flyaways: "goal-frizz",
  low_shine: "goal-shine",
  hair_damage: "goal-repair",
  breakage: "goal-strength",
  split_ends: "goal-split-ends",
  tangling: "goal-smoothness",
  lost_shape: "goal-definition",
  low_volume_or_weighed_down: "goal-volume",
  hair_loss_or_thinning: "goal-growth",
}

export type LegacyQuizOptionVisual =
  | {
      kind: "image"
      src: string
      alt: string
      priority?: boolean
    }
  | {
      kind: "portrait"
      config: PortraitConfig
      alt: string
      priority?: boolean
    }

export type LegacyQuizOptionLayout = "row" | "grid" | "thumbnail"

function isHairTexture(value: unknown): value is PortraitHairPattern {
  return typeof value === "string" && HAIR_TEXTURES.includes(value as PortraitHairPattern)
}

function isHairLength(value: unknown): value is PortraitLength {
  return typeof value === "string" && HAIR_LENGTHS.includes(value as PortraitLength)
}

export function getLegacyQuizOptionLayout(step: number): LegacyQuizOptionLayout {
  if (step === 2 || step === 15) return "grid"
  if (step === 3) return "thumbnail"
  return "row"
}

export function getLegacyQuizOptionVisual({
  answers,
  index,
  step,
  value,
}: {
  answers: QuizAnswers
  index: number
  step: number
  value: string
}): LegacyQuizOptionVisual | undefined {
  if (step === 2) {
    const image = TEXTURE_IMAGES[value]
    return image ? { kind: "image", ...image, priority: index === 0 } : undefined
  }

  if (step === 3) {
    const image = THICKNESS_IMAGES[value]
    return image ? { kind: "image", ...image } : undefined
  }

  if (step === 15 && isHairLength(value)) {
    const texture = isHairTexture(answers.structure) ? answers.structure : "wavy"
    return {
      kind: "portrait",
      alt: "Haarlängen-Illustration",
      config: {
        kind: "personalized",
        density: "medium",
        length: value,
        naturalRootPattern: texture,
        treatedLengthPattern: texture,
        treatmentState: "none",
      },
    }
  }

  return undefined
}

export function getLegacyQuizGoalIcon(goal: string): IconName {
  return GOAL_ICONS[goal] ?? "goal-repair"
}

export function getLegacyQuizConcernIcon(concern: string): IconName {
  return CONCERN_ICONS[concern] ?? "goal-repair"
}
