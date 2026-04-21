"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQuizStore } from "@/lib/quiz/store"

/**
 * Final quiz step (14 "auth_transition"). In the new paid-funnel model,
 * user accounts are created exclusively by the Stripe webhook — not by
 * self-service signup mid-quiz. This step therefore forwards the user
 * to /pricing with their leadId so their quiz email pre-fills the
 * Stripe Checkout Session.
 */
export function QuizWelcome() {
  const router = useRouter()
  const leadId = useQuizStore((s) => s.leadId)

  useEffect(() => {
    const target = leadId ? `/pricing?lead=${leadId}` : "/pricing"
    router.replace(target)
  }, [leadId, router])

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in-up">
      <p className="text-sm text-muted-foreground">Einen Moment …</p>
    </div>
  )
}
