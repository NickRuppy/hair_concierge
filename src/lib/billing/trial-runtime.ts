import "server-only"

import type { TrialIdentityClaimKey } from "./trial-identity-claims"
import {
  createTrialOfferSnapshot,
  toTrialOfferPricing,
  type TrialStripeCatalog,
} from "./trial-offer"

export type TrialRuntime = Readonly<{
  stripeAccountId: string
  livemode: boolean
  identityKeys: readonly TrialIdentityClaimKey[]
  catalog: TrialStripeCatalog
  enrollmentMode: "disabled" | "restricted" | "public"
  allowedEmails: readonly string[]
}>

export type TrialRuntimeEnvironment = Readonly<Record<string, string | undefined>>

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function configurationError(): never {
  throw new Error("Trial runtime configuration invalid")
}

function parseIdentityKeys(value: string | undefined): readonly TrialIdentityClaimKey[] {
  if (value === undefined) configurationError()
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    configurationError()
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 8) configurationError()

  const versions = new Set<number>()
  const keys: TrialIdentityClaimKey[] = []
  for (const item of parsed) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).length !== 2 ||
      !Object.hasOwn(item, "version") ||
      !Object.hasOwn(item, "secretHex")
    ) {
      configurationError()
    }
    const { version, secretHex } = item as { version: unknown; secretHex: unknown }
    if (
      typeof version !== "number" ||
      !Number.isSafeInteger(version) ||
      version < 1 ||
      version > 999_999_999 ||
      versions.has(version) ||
      typeof secretHex !== "string" ||
      !/^[0-9a-fA-F]{64,256}$/.test(secretHex) ||
      secretHex.length % 2 !== 0
    ) {
      configurationError()
    }
    versions.add(version)
    keys.push({ version, secret: Buffer.from(secretHex, "hex") })
  }
  return Object.freeze(keys)
}

function parseCatalog(env: TrialRuntimeEnvironment): TrialStripeCatalog {
  const monthPriceId = env.TRIAL_STRIPE_PRICE_MONTHLY
  const yearPriceId = env.TRIAL_STRIPE_PRICE_ANNUAL
  const coupon = env.TRIAL_STRIPE_ANNUAL_COUPON
  if (monthPriceId === undefined || yearPriceId === undefined || coupon === undefined) {
    return configurationError()
  }
  const catalog: TrialStripeCatalog = {
    monthPriceId,
    yearPriceId,
    annualCouponId: coupon === "" ? null : coupon,
  }
  try {
    createTrialOfferSnapshot("month", catalog)
  } catch {
    configurationError()
  }
  return Object.freeze(catalog)
}

function parseMode(value: string | undefined): TrialRuntime["enrollmentMode"] {
  if (value === undefined || value === "disabled") return "disabled"
  if (value === "restricted" || value === "public") return value
  return configurationError()
}

function parseAllowedEmails(
  mode: TrialRuntime["enrollmentMode"],
  value: string | undefined,
): readonly string[] {
  if (mode !== "restricted") return Object.freeze([])
  if (value === undefined) configurationError()
  const emails = value.split(",").map((email) => email.trim().toLowerCase())
  if (
    emails.length === 0 ||
    emails.some((email) => !EMAIL.test(email)) ||
    new Set(emails).size !== emails.length
  ) {
    configurationError()
  }
  return Object.freeze(emails)
}

/**
 * Reads server-only trial configuration. `disabled` prevents new enrollment but
 * deliberately retains the verified provider and identity settings needed to
 * reconcile callbacks for accepted agreements during a prospective rollback.
 */
export function readTrialRuntime(env: TrialRuntimeEnvironment = process.env): TrialRuntime | null {
  const approved = env.TRIAL_IDENTITY_PROCESSING_APPROVED
  if (approved === undefined || approved === "false") return null
  if (approved !== "true") configurationError()

  const stripeAccountId = env.TRIAL_STRIPE_ACCOUNT_ID
  if (!stripeAccountId || !/^acct_\w+$/.test(stripeAccountId)) configurationError()
  const livemode = env.TRIAL_STRIPE_LIVEMODE
  if (livemode !== "true" && livemode !== "false") configurationError()

  const enrollmentMode = parseMode(env.TRIAL_ENROLLMENT_MODE)
  return Object.freeze({
    stripeAccountId,
    livemode: livemode === "true",
    identityKeys: parseIdentityKeys(env.TRIAL_IDENTITY_HMAC_KEYS),
    catalog: parseCatalog(env),
    enrollmentMode,
    allowedEmails: parseAllowedEmails(enrollmentMode, env.TRIAL_QA_EMAILS),
  })
}

export function isTrialEnrollmentAllowed(
  runtime: TrialRuntime | null,
  serverVerifiedEmail: string,
): boolean {
  if (!runtime || runtime.enrollmentMode === "disabled") return false
  if (runtime.enrollmentMode === "public") return true
  return runtime.allowedEmails.includes(serverVerifiedEmail.trim().toLowerCase())
}

export function resolveTrialOfferPricingForResult(input: {
  confirmedEmail: string | null
  hasAccess: boolean
  hasConsumedHistory?: boolean
  runtime: TrialRuntime | null
}) {
  if (
    input.hasAccess ||
    input.hasConsumedHistory ||
    !input.runtime ||
    !isTrialEnrollmentAllowed(input.runtime, input.confirmedEmail ?? "")
  )
    return null
  return toTrialOfferPricing({
    month: createTrialOfferSnapshot("month", input.runtime.catalog),
    year: createTrialOfferSnapshot("year", input.runtime.catalog),
  })
}
