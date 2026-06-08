import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ResultPageClient } from "./result-client"
import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import type { QuizAnswers } from "@/lib/quiz/types"
import { quizAnswersSchema } from "@/lib/quiz/validators"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

interface Props {
  params: Promise<{ leadId: string }>
  searchParams: Promise<{ focus?: string }>
}

interface LeadResultRow {
  id: string
  name: string
  quiz_answers: unknown
}

// Result links are intentionally public-by-unguessable lead ID so emailed result artifacts
// can open without forcing account login before plan selection.
async function getLeadResult(leadId: string): Promise<LeadResultRow | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from("leads")
    .select("id, name, quiz_answers")
    .eq("id", leadId)
    .maybeSingle()

  if (error) {
    console.error("[result-page] failed to load lead", error)
    return null
  }

  return data as LeadResultRow | null
}

function parseQuizAnswers(raw: unknown): QuizAnswers | null {
  const normalized = normalizeStoredQuizAnswers((raw as Record<string, unknown> | null) ?? null)
  const parsed = quizAnswersSchema.safeParse(normalized)

  return parsed.success ? parsed.data : null
}

export default async function ResultPage({ params, searchParams }: Props) {
  const [{ leadId }, sp] = await Promise.all([params, searchParams])
  const lead = await getLeadResult(leadId)
  const quizAnswers = lead ? parseQuizAnswers(lead.quiz_answers) : null

  if (!lead || !quizAnswers) {
    notFound()
  }

  return (
    <ResultPageClient
      leadId={lead.id}
      name={lead.name}
      quizAnswers={quizAnswers}
      focusRoutine={sp.focus === "routine"}
    />
  )
}
