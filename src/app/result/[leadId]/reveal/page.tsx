import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { getBerlinDateKey } from "@/lib/quiz/personal-plan-result-reveal"
import { createAdminClient } from "@/lib/supabase/admin"
import { PersonalPlanResultReveal } from "./personal-plan-result-reveal"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

export default async function PersonalPlanResultRevealPage({
  params,
}: {
  params: Promise<{ leadId: string }>
}) {
  const { leadId } = await params
  const admin = createAdminClient()
  const { data, error } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("quiz_kind", "personal_plan")
    .maybeSingle()

  if (error || !data) notFound()

  const { data: artifact, error: artifactError } = await admin
    .from("personal_plan_prepared_artifacts")
    .select("id")
    .eq("lead_id", leadId)
    .eq("status", "attached")
    .maybeSingle()

  if (artifactError || !artifact) {
    redirect(`/result/${leadId}?entry=quiz_completion`)
  }

  return <PersonalPlanResultReveal dateKey={getBerlinDateKey()} leadId={leadId} />
}
