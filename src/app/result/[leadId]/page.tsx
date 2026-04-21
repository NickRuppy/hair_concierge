import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import type { QuizAnswers } from "@/lib/quiz/types"
import { ResultPageClient } from "./result-client"

interface Props {
  params: Promise<{ leadId: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function getLead(leadId: string) {
  if (!UUID_RE.test(leadId)) return null

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data } = await supabase
    .from("leads")
    .select("id, name, quiz_answers, share_quote")
    .eq("id", leadId)
    .single()

  return data
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { leadId } = await params
  const lead = await getLead(leadId)

  if (!lead) {
    return { title: "Nicht gefunden — Hair Concierge" }
  }

  const name = lead.name as string
  const quote = (lead.share_quote as string) || "Finde heraus, was deine Haare wirklich brauchen."

  return {
    title: `${name}s Haarprofil — Hair Concierge`,
    description: quote,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${name}s Haarprofil — Hair Concierge`,
      description: quote,
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${name}s Haarprofil — Hair Concierge`,
      description: quote,
    },
  }
}

export default async function ResultPage({ params }: Props) {
  const { leadId } = await params
  const lead = await getLead(leadId)

  if (!lead) {
    notFound()
  }

  return (
    <ResultPageClient
      leadId={lead.id}
      name={lead.name}
      quizAnswers={lead.quiz_answers as QuizAnswers}
      shareQuote={lead.share_quote || null}
    />
  )
}
