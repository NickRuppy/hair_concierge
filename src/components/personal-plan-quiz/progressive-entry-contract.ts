import type { PersonalPlanTexture } from "./texture-question"

export type FreshPersonalPlanQuizEntry = {
  suppressInitialTextureScreenView: true
  texture?: PersonalPlanTexture
  selectedAt?: number
  quizStarted: boolean
}
