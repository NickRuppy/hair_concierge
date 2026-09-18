/** Offline public question copy. Never exports saved answers or identity data. */
import { writeFileSync } from "node:fs"
import { mobileEditQuestions } from "../../src/lib/mobile/profile-edit-contract"
import type { QuizAnswers } from "../../src/lib/quiz/types"

const payload = { version: 1, questions: mobileEditQuestions({} as QuizAnswers) }
writeFileSync(
  "ios/Chaarlie/Resources/onboarding-questions-v1.json",
  JSON.stringify(payload, null, 2) + "\n",
)
