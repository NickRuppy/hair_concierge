export const GUIDED_STORY_OFFER_EXPERIMENT = {
  id: "guided_story_offer_v2",
  revision: 1,
  baseVariant: "guided-story",
  variants: ["guided-story-locked", "guided-story-founder-letter", "guided-story-potential"],
} as const

export type GuidedStoryExperimentVariant = (typeof GUIDED_STORY_OFFER_EXPERIMENT.variants)[number]

const GUIDED_STORY_FAMILY = new Set<string>([
  GUIDED_STORY_OFFER_EXPERIMENT.baseVariant,
  ...GUIDED_STORY_OFFER_EXPERIMENT.variants,
])
const EXPERIMENT_VARIANTS = new Set<string>(GUIDED_STORY_OFFER_EXPERIMENT.variants)

export function isGuidedStoryFamilyVariant(offerVariant: string): boolean {
  return GUIDED_STORY_FAMILY.has(offerVariant)
}

export function isGuidedStoryExperimentVariant(
  offerVariant: string | null | undefined,
): offerVariant is GuidedStoryExperimentVariant {
  return typeof offerVariant === "string" && EXPERIMENT_VARIANTS.has(offerVariant)
}

export function assignGuidedStoryExperimentVariant(
  stableIdentity: string,
): GuidedStoryExperimentVariant {
  const hash = fnv1a(
    `${GUIDED_STORY_OFFER_EXPERIMENT.id}:${GUIDED_STORY_OFFER_EXPERIMENT.revision}:${stableIdentity}`,
  )
  return GUIDED_STORY_OFFER_EXPERIMENT.variants[
    hash % GUIDED_STORY_OFFER_EXPERIMENT.variants.length
  ]
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}
