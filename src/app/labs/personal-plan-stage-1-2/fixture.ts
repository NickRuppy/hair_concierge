import type { PersonalPlanQuizSubmissionEnvelope } from "@/lib/personal-plan-quiz/types"

export const STAGE1_STAGE2_LAB_ENVELOPE: PersonalPlanQuizSubmissionEnvelope = {
  kind: "personal_plan",
  version: 3,
  answers: {
    texture: "wavy",
    thickness: "fine",
    density: "medium",
    goals: ["moisture", "shine"],
    routineClarity: "partial",
    resultReliability: "sometimes",
    adaptationConfidence: "partly",
    currentConcerns: ["dry_lengths", "split_ends"],
    concernRecurrence: { concernId: "dry_lengths", frequency: "often" },
    hairLength: "long",
    hairSurface: "rough",
    elasticResponse: "stretches_stays",
    chemicalTreatments: ["colored"],
    scalpOiliness: "oily",
    scalpConcerns: ["irritated"],
    previousAttempts: "some_steps_helped",
    blockers: ["product_fit"],
    routineStyle: "simple_reliable",
    meaningfulMoment: "everyday",
  },
}
