import type { Metadata } from "next"

import { QuizShell } from "./quiz-shell"
import { QUIZ_METADATA } from "@/lib/seo/site-identity"

export const metadata: Metadata = QUIZ_METADATA

export default function QuizLayout({ children }: { children: React.ReactNode }) {
  return <QuizShell>{children}</QuizShell>
}
