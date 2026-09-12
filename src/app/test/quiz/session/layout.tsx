import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { QuizShell } from "@/app/quiz/quiz-shell"
import { QuizFunnelPackageProvider } from "@/components/quiz/quiz-funnel-package-provider"
import { FUNNEL_SESSION_COOKIE } from "@/lib/funnel/cookie"
import { resolveQuizFunnelPackageKey } from "@/lib/quiz/funnel-package-context"
import { createClient } from "@/lib/supabase/server"
import {
  REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE,
  resolveRegularQuizFieldTestCampaignCookie,
} from "@/lib/personal-plan-field-test"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function RegularQuizFieldTestSessionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect("/auth")

  const cookieStore = await cookies()
  const value = cookieStore.get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value
  const campaign = await resolveRegularQuizFieldTestCampaignCookie(value)
  if (campaign.kind !== "eligible") redirect("/test/quiz/beendet")

  const funnelPackageKey = await resolveQuizFunnelPackageKey(
    cookieStore.get(FUNNEL_SESSION_COOKIE)?.value,
  )

  return (
    <QuizFunnelPackageProvider funnelPackageKey={funnelPackageKey}>
      <QuizShell regularFieldTest>{children}</QuizShell>
    </QuizFunnelPackageProvider>
  )
}
