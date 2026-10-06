export const ORGANIC_OFFER_MEDIA_EXPERIMENT = {
  id: "organic_offer_media_v1",
  revision: 1,
  packageKey: "default_organic",
  baseVariant: "organic-plan-v1",
  treatmentVariant: "organic-plan-before-after-v1",
  variants: ["organic-plan-v1", "organic-plan-before-after-v1"],
} as const

export type OrganicOfferMediaExperimentVariant =
  (typeof ORGANIC_OFFER_MEDIA_EXPERIMENT.variants)[number]

const EXPERIMENT_VARIANTS = new Set<string>(ORGANIC_OFFER_MEDIA_EXPERIMENT.variants)

export function isOrganicOfferMediaExperimentVariant(
  offerVariant: string | null | undefined,
): offerVariant is OrganicOfferMediaExperimentVariant {
  return typeof offerVariant === "string" && EXPERIMENT_VARIANTS.has(offerVariant)
}

export function assignOrganicOfferMediaExperimentVariant(
  sessionId: string,
): OrganicOfferMediaExperimentVariant {
  return ORGANIC_OFFER_MEDIA_EXPERIMENT.variants[
    fnv1a(
      `${ORGANIC_OFFER_MEDIA_EXPERIMENT.id}:${ORGANIC_OFFER_MEDIA_EXPERIMENT.revision}:${sessionId}`,
    ) % ORGANIC_OFFER_MEDIA_EXPERIMENT.variants.length
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
