import type { Metadata } from "next"
import { cookies } from "next/headers"

import { QuizShell } from "./quiz-shell"
import { QuizFunnelPackageProvider } from "@/components/quiz/quiz-funnel-package-provider"
import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveQuizFunnelPackageKey } from "@/lib/quiz/funnel-package-context"
import { isScannerFunnelRefinementEnabled } from "@/lib/funnel/scanner-refinement"
import { QUIZ_METADATA } from "@/lib/seo/site-identity"

export const metadata: Metadata = QUIZ_METADATA

export default async function QuizLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const funnelPackageKey = await resolveQuizFunnelPackageKey(
    cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
  )
  const scannerFunnelRefinementEnabled = isScannerFunnelRefinementEnabled()

  return (
    <QuizFunnelPackageProvider
      funnelPackageKey={funnelPackageKey}
      scannerFunnelRefinementEnabled={scannerFunnelRefinementEnabled}
    >
      <QuizShell>{children}</QuizShell>
    </QuizFunnelPackageProvider>
  )
}
