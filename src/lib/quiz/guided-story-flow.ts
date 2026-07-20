export type GuidedStoryChapter = 1 | 2 | 3 | 4
export type GuidedStoryFocusTarget = "unlock-plan" | "pricing" | null

export const GUIDED_STORY_CHAPTER_TARGETS = {
  2: { anchorId: "unlock-plan", headingId: "guided-story-chapter-2-heading" },
  3: { anchorId: "guided-story-support", headingId: "guided-story-chapter-3-heading" },
  4: { anchorId: "pricing", headingId: "guided-story-chapter-4-heading" },
} as const satisfies Record<Exclude<GuidedStoryChapter, 1>, { anchorId: string; headingId: string }>

export function resolveInitialGuidedStoryChapter({
  focusRoutine,
  focusTarget,
}: {
  focusRoutine: boolean
  focusTarget: GuidedStoryFocusTarget
}): GuidedStoryChapter {
  if (focusRoutine || focusTarget === "pricing") return 4
  if (focusTarget === "unlock-plan") return 2
  return 1
}

export function resolveInitialGuidedStoryFocusChapter({
  focusRoutine,
  focusTarget,
}: {
  focusRoutine: boolean
  focusTarget: GuidedStoryFocusTarget
}): Exclude<GuidedStoryChapter, 1> | null {
  if (focusRoutine || focusTarget === "pricing") return 4
  if (focusTarget === "unlock-plan") return 2
  return null
}

export function guidedStoryScrollBehavior(prefersReducedMotion: boolean): ScrollBehavior {
  return prefersReducedMotion ? "auto" : "smooth"
}
