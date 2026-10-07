import { notFound } from "next/navigation"

import { buildQuizResultNarrative } from "@/lib/quiz/result-narrative"
import type { QuizAnswers } from "@/lib/quiz/types"

import { ScannerRefinementLabClient } from "./scanner-refinement-lab-client"

const REVIEW_ANSWERS: QuizAnswers = {
  structure: "wavy",
  thickness: "normal",
  density: "medium",
  hair_length: "long",
  fingertest: "rau",
  pulltest: "stretches_bounces",
  scalp_type: "ausgeglichen",
  has_scalp_issue: false,
  concerns: ["frizz", "dryness"],
  treatment: ["natur"],
  goals: ["less_frizz", "moisture", "shine"],
}

/** Dev-only, local-only real-component harness. It has no checkout provider. */
export default function ScannerRefinementLabPage() {
  if (process.env.NODE_ENV !== "development") notFound()

  return (
    <ScannerRefinementLabClient
      narrative={buildQuizResultNarrative(REVIEW_ANSWERS)}
      quizAnswers={REVIEW_ANSWERS}
    />
  )
}
