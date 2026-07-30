import type { SupabaseBillingAnalyticsClient } from "@/lib/billing/types"

export type FunnelExperienceSnapshot = {
  sessionId: string
  packageKey: string
  landingVariant: string
  quizVariant: string
  offerVariant: string
}

export type PurchaseFunnelAttribution =
  | { kind: "resolved"; snapshot: FunnelExperienceSnapshot }
  | { kind: "missing"; reportedPackageKey: string | null }
  | {
      kind: "invalid"
      issue: "package_mismatch" | "session_not_found"
      reportedPackageKey: string | null
    }
  | { kind: "transient"; error: string }

type FunnelExperienceRow = {
  id: string
  package_key: string
  landing_variant: string
  quiz_variant: string
  offer_variant: string
}

function payloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key]
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

export async function resolvePurchaseFunnelAttribution(
  supabase: SupabaseBillingAnalyticsClient,
  payload: Record<string, unknown>,
): Promise<PurchaseFunnelAttribution> {
  const sessionId = payloadString(payload, "funnel_session_id")
  const reportedPackageKey = payloadString(payload, "funnel_package_key")
  if (!sessionId) return { kind: "missing", reportedPackageKey }

  const { data, error } = await supabase
    .from("funnel_sessions")
    .select("id, package_key, landing_variant, quiz_variant, offer_variant")
    .eq("id", sessionId)
    .maybeSingle()

  if (error) return { kind: "transient", error: errorMessage(error) }
  if (!data) {
    return {
      kind: "invalid",
      issue: "session_not_found",
      reportedPackageKey,
    }
  }

  const row = data as FunnelExperienceRow
  if (reportedPackageKey && row.package_key !== reportedPackageKey) {
    return {
      kind: "invalid",
      issue: "package_mismatch",
      reportedPackageKey,
    }
  }

  return {
    kind: "resolved",
    snapshot: {
      sessionId: row.id,
      packageKey: row.package_key,
      landingVariant: row.landing_variant,
      quizVariant: row.quiz_variant,
      offerVariant: row.offer_variant,
    },
  }
}
