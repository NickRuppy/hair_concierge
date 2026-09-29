import "server-only"
import {
  readPilotConfig,
  eligibleAccount,
  openCredential,
  sealCredential,
  type PilotConfig,
  type CredentialClaims,
} from "../../../supabase/functions/_shared/mobile-credentials"
import { MobileError } from "./errors"

export { eligibleAccount, openCredential, sealCredential }
export type { CredentialClaims, PilotConfig }
export type MobilePolicy = { mode: "local" } | { mode: "pilot"; config: PilotConfig }

/**
 * The complete local-development predicate: mobile API on, local auth, no pilot, a
 * loopback Supabase and the local callback. Anything that trusts unsigned local data
 * must use this, never MOBILE_AUTH_MODE alone.
 */
export function localMobileModeEnabled(env: Record<string, string | undefined> = process.env) {
  if (
    env.MOBILE_API_ENABLED !== "true" ||
    env.MOBILE_AUTH_MODE !== "local" ||
    env.MOBILE_PILOT_ENABLED === "true"
  )
    return false
  try {
    const target = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "")
    return (
      target.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) &&
      !target.username &&
      !target.password &&
      target.pathname === "/" &&
      !target.search &&
      !target.hash &&
      env.MOBILE_AUTH_CALLBACK_URL === "chaarlie-local://auth"
    )
  } catch {
    return false
  }
}

/** Never infer a raw-token fallback from a missing or invalid pilot setting. */
export function mobilePolicy(): MobilePolicy {
  if (process.env.MOBILE_API_ENABLED !== "true") throw new MobileError("not_found", 404)
  if (process.env.MOBILE_AUTH_MODE === "pilot") {
    try {
      return { mode: "pilot", config: readPilotConfig(process.env) }
    } catch {
      throw new MobileError("not_found", 404)
    }
  }
  if (localMobileModeEnabled(process.env)) return { mode: "local" }
  throw new MobileError("not_found", 404)
}

export function requireMobileEmail(email: string, policy = mobilePolicy()) {
  if (policy.mode === "pilot" && !eligibleAccount(policy.config, email))
    throw new MobileError("unauthorized", 401)
}

export async function mobileCredential(
  raw: string,
  purpose: CredentialClaims["purpose"],
  policy = mobilePolicy(),
) {
  if (policy.mode === "local") return null
  try {
    return await openCredential(policy.config, raw, purpose)
  } catch {
    throw new MobileError("unauthorized", 401)
  }
}
