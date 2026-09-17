import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { MobileError } from "./errors"
export type RegistrationIntent = {
  id: string
  request_id: string
  request_hash: string
  email: string
  flow: "registration" | "login"
  send_generation: string
  code_digest: string | null
  code_key_id: string | null
  provider_user_id: string | null
  verified_user_id: string | null
  verification_count: number
  claim_id: string | null
  claim_expires_at: string | null
  expires_at: string
  verified_at: string | null
  completed_at: string | null
  completion_receipt: unknown
  superseded_at: string | null
}
export function registrationStore(client: SupabaseClient) {
  async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await client.rpc(name, args)
    if (error) throw new MobileError("temporarily_unavailable", 503)
    return data as T
  }
  return {
    async start(
      requestId: string,
      requestHash: string,
      email: string,
      flow: "registration" | "login" = "registration",
    ) {
      const result = await rpc<{ status: string; intent?: RegistrationIntent }>(
        "mobile_registration_start",
        { p_request_id: requestId, p_request_hash: requestHash, p_email: email, p_flow: flow },
      )
      if (result?.status !== "ready" || !result.intent)
        throw new MobileError("invalid_request", 400)
      return result.intent
    },
    async read(attemptId: string) {
      const { data, error } = await client
        .from("mobile_registration_intents")
        .select("*")
        .eq("id", attemptId)
        .maybeSingle()
      if (error) throw new MobileError("temporarily_unavailable", 503)
      return data as RegistrationIntent | null
    },
    claim: (id: string, generation: string, digest: string | null) =>
      rpc<RegistrationIntent | null>("mobile_registration_claim", {
        p_attempt_id: id,
        p_send_generation: generation,
        p_code_digest: digest,
      }),
    finish: (v: RegistrationIntent, userId: string, email: string) =>
      rpc<boolean>("mobile_registration_finish", {
        p_attempt_id: v.id,
        p_send_generation: v.send_generation,
        p_claim_id: v.claim_id,
        p_user_id: userId,
        p_email: email,
      }),
    release: (v: RegistrationIntent) =>
      rpc<null>("mobile_registration_release", { p_attempt_id: v.id, p_claim_id: v.claim_id }),
    async enrollment(email: string, userId?: string) {
      let query = client
        .from("mobile_registration_enrollments")
        .select("user_id,email,ready_at")
        .eq("email", email)
        .not("ready_at", "is", null)
      if (userId) query = query.eq("user_id", userId)
      const { data, error } = await query.maybeSingle()
      if (error) throw new MobileError("temporarily_unavailable", 503)
      return data as { user_id: string; email: string; ready_at: string } | null
    },
  }
}
