import {
  GUIDED_STORY_COPY_RECORDS,
  type GuidedStoryPriorityFamily,
  type GuidedStoryPriorityVariantId,
} from "./guided-story-copy"

export const GUIDED_STORY_PRIORITY_LABELS: Record<GuidedStoryPriorityFamily, string> = {
  scalp_flakes: "Kopfhaut",
  scalp_comfort: "Kopfhaut",
  strength_damage: "Stabilität",
  moisture_dryness: "Feuchtigkeit",
  surface_manageability: "Oberfläche",
  ends_protection: "Spitzen",
  definition: "Definition",
  volume_weight: "Fülle",
  color_protection: "Farbschutz",
}

export const GUIDED_STORY_PRIORITY_IDENTITY: ReadonlyMap<
  GuidedStoryPriorityVariantId,
  { readonly family: GuidedStoryPriorityFamily; readonly label: string }
> = new Map(
  GUIDED_STORY_COPY_RECORDS.map((record) => [
    record.variantId,
    { family: record.family, label: GUIDED_STORY_PRIORITY_LABELS[record.family] },
  ]),
)

export function getGuidedStoryPriorityIdentity(variantId: string) {
  return GUIDED_STORY_PRIORITY_IDENTITY.get(variantId as GuidedStoryPriorityVariantId)
}
