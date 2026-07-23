"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  GUIDED_STORY_CHAPTER_TARGETS,
  guidedStoryScrollBehavior,
  resolveInitialGuidedStoryChapter,
  resolveInitialGuidedStoryFocusChapter,
  type GuidedStoryChapter,
  type GuidedStoryFocusTarget,
} from "@/lib/quiz/guided-story-flow"

export function useGuidedStoryFlow({
  focusRoutine,
  focusTarget,
}: {
  focusRoutine: boolean
  focusTarget: GuidedStoryFocusTarget
}) {
  const initialChapter = resolveInitialGuidedStoryChapter({ focusRoutine, focusTarget })
  const [revealedThrough, setRevealedThrough] = useState<GuidedStoryChapter>(initialChapter)
  const [revealGeneration, setRevealGeneration] = useState(0)
  const revealedThroughRef = useRef<GuidedStoryChapter>(initialChapter)
  const pendingFocusChapter = useRef<Exclude<GuidedStoryChapter, 1> | null>(
    resolveInitialGuidedStoryFocusChapter({ focusRoutine, focusTarget }),
  )

  const reveal = useCallback((chapter: Exclude<GuidedStoryChapter, 1>) => {
    if (chapter <= revealedThroughRef.current) return
    revealedThroughRef.current = chapter
    pendingFocusChapter.current = chapter
    setRevealedThrough(chapter)
    setRevealGeneration((generation) => generation + 1)
  }, [])

  useEffect(() => {
    const chapter = pendingFocusChapter.current
    if (!chapter || chapter > revealedThrough) return
    pendingFocusChapter.current = null

    const frame = window.requestAnimationFrame(() => {
      const target = GUIDED_STORY_CHAPTER_TARGETS[chapter]
      const anchor = document.getElementById(target.anchorId)
      const heading = document.getElementById(target.headingId)
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches

      anchor?.scrollIntoView({
        behavior: guidedStoryScrollBehavior(prefersReducedMotion),
        block: "start",
      })
      heading?.focus({ preventScroll: true })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [revealedThrough])

  return {
    isRevealed: (chapter: GuidedStoryChapter) => chapter <= revealedThrough,
    reveal,
    revealedThrough,
    revealGeneration,
  }
}
