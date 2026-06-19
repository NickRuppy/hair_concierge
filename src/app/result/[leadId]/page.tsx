import type { Metadata } from "next"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { createServerClient } from "@supabase/ssr"

import { ResultPageClient } from "./result-client"
import { hasCurrentAppAccess } from "@/lib/billing/subscriptions"
import { normalizeStoredQuizAnswers } from "@/lib/quiz/normalization"
import type { QuizAnswers } from "@/lib/quiz/types"
import { storedQuizAnswersSchema } from "@/lib/quiz/validators"
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
  const parsed = storedQuizAnswersSchema.safeParse(normalized)

  return parsed.success ? parsed.data : null
}

async function getAuthenticatedResultAccess(): Promise<boolean> {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return false

  return hasCurrentAppAccess(supabase, { userId: user.id, email: user.email }).catch((error) => {
    console.warn("[result-page] failed to resolve authenticated access", error)
    return false
  })
}

export default async function ResultPage({ params, searchParams }: Props) {
  const [{ leadId }, sp] = await Promise.all([params, searchParams])
  const [lead, hasAccess] = await Promise.all([
    getLeadResult(leadId),
    getAuthenticatedResultAccess(),
  ])
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
      hasAccess={hasAccess}
    />
  )
}
