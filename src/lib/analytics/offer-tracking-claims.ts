import type { OfferChapterId, OfferSectionId } from "./events"

export type OfferChapterRevealClaim = {
  chapterId: OfferChapterId
  chapterIndex: 1 | 2 | 3 | 4
  revealGeneration: number
}

const OFFER_CHAPTERS = [
  { chapterId: "analysis", chapterIndex: 1 },
  { chapterId: "routine", chapterIndex: 2 },
  { chapterId: "support", chapterIndex: 3 },
  { chapterId: "pricing", chapterIndex: 4 },
] as const satisfies ReadonlyArray<Pick<OfferChapterRevealClaim, "chapterId" | "chapterIndex">>

export function claimOfferChapterReveals(
  previouslyClaimed: ReadonlySet<OfferChapterId>,
  revealedThrough: 1 | 2 | 3 | 4,
  revealGeneration: number,
): OfferChapterRevealClaim[] {
  return OFFER_CHAPTERS.filter(
    ({ chapterId, chapterIndex }) =>
      chapterIndex <= revealedThrough && !previouslyClaimed.has(chapterId),
  ).map(({ chapterId, chapterIndex }) => ({ chapterId, chapterIndex, revealGeneration }))
}

export type OfferFaqOpenClaim = {
  nextOpenIndex: number
  openIndex?: number
}

export function resolveOfferFaqOpenClaim(
  offerVariant: string,
  previouslyOpened: boolean,
  currentOpenIndex: number,
): OfferFaqOpenClaim | null {
  const tracksEveryOpen = offerVariant === "guided-story"
  if (!tracksEveryOpen && previouslyOpened) return null
  const nextOpenIndex = tracksEveryOpen ? currentOpenIndex + 1 : currentOpenIndex
  return {
    nextOpenIndex,
    openIndex: tracksEveryOpen ? nextOpenIndex : undefined,
  }
}

export function isOfferEngagementDepthSection(sectionId: OfferSectionId): boolean {
  return sectionId !== "product_story_chat_answer"
}
