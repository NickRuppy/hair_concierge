import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

export type CheckoutActivationMethod = "password" | "passwordless"

export async function claimCheckoutActivation(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  method: CheckoutActivationMethod,
): Promise<boolean> {
  const { error } = await supabase.from("checkout_activation_claims").insert({
    session_hash: checkoutSessionHash(sessionId),
    user_id: userId,
    method,
  })

  if (!error) return true
  if (isUniqueViolation(error)) return false
  throw new Error(`checkout activation claim failed: ${error.message}`)
}

export async function releaseCheckoutActivationClaim(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<void> {
  const { error } = await supabase
    .from("checkout_activation_claims")
    .delete()
    .eq("session_hash", checkoutSessionHash(sessionId))

  if (error) throw new Error(`checkout activation claim release failed: ${error.message}`)
}

export function checkoutSessionHash(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex")
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const err = error as { code?: unknown; message?: unknown }
  const text = String(err.message ?? "").toLowerCase()
  return err.code === "23505" || text.includes("duplicate") || text.includes("unique")
}
