import type { Metadata } from "next"

import { QuizGateLanding } from "@/components/waitlist/quiz-gate-landing"

export const metadata: Metadata = {
  title: "Kostenloses Quiz | chaarlie",
  robots: { index: false, follow: false },
}

export default function WaitlistQuizGatePage() {
  return <QuizGateLanding />
}
