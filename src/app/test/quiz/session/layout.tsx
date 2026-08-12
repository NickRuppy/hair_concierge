import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { QuizShell } from "@/app/quiz/quiz-shell"
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

  const value = (await cookies()).get(REGULAR_QUIZ_FIELD_TEST_CAMPAIGN_COOKIE)?.value
  const campaign = await resolveRegularQuizFieldTestCampaignCookie(value)
  if (campaign.kind !== "eligible") redirect("/test/quiz/beendet")

  return <QuizShell regularFieldTest>{children}</QuizShell>
}
