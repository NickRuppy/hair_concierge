import assert from "node:assert/strict"
import test from "node:test"

import { resolveTrialOfferPricingForResult } from "../src/lib/billing/trial-runtime"
import type { TrialRuntime } from "../src/lib/billing/trial-runtime"
import type { SupabaseClient } from "@supabase/supabase-js"
import { hasConsumedTrialHistory } from "../src/lib/billing/trial-returning-customer"
import { readFileSync } from "node:fs"

const runtime = {
  allowedEmails: ["confirmed@example.test"],
  catalog: {
    annualCouponId: "coupon_trial",
    monthPriceId: "price_trial_month",
    yearPriceId: "price_trial_year",
  },
  enrollmentMode: "restricted",
  identityKeys: [],
  livemode: false,
  stripeAccountId: "acct_trial",
} as unknown as TrialRuntime

test("restricted trial display requires a server-confirmed email while public mode remains anonymous", () => {
  assert.equal(
    resolveTrialOfferPricingForResult({ confirmedEmail: null, hasAccess: false, runtime }),
    null,
  )
  assert.deepEqual(
    resolveTrialOfferPricingForResult({
      confirmedEmail: "confirmed@example.test",
      hasAccess: false,
      runtime,
    }),
    {
      annualFirstAmountMinor: 6999,
      annualRenewalAmountMinor: 9999,
      monthlyAmountMinor: 999,
      trialDays: 7,
    },
  )
  assert.ok(
    resolveTrialOfferPricingForResult({
      confirmedEmail: null,
      hasAccess: false,
      runtime: { ...runtime, enrollmentMode: "public" },
    }),
  )
})

test("used trial or paid membership renders the explicit paid offer rather than another trial", () => {
  assert.equal(
    resolveTrialOfferPricingForResult({
      confirmedEmail: "confirmed@example.test",
      hasAccess: false,
      hasConsumedHistory: true,
      runtime,
    }),
    null,
  )
  const source = readFileSync("src/app/result/[leadId]/page.tsx", "utf8")
  assert.match(
    source,
    /await hasConsumedTrialHistory\(createAdminClient\(\), \{\s*userId: authenticatedAccess\.userId/,
  )
  assert.match(source, /resolveTrialOfferPricingForResult\(\{[\s\S]*?hasConsumedHistory,/)
  assert.match(source, /if \(hasConsumedHistory\) redirect\("\/reactivate"\)/)
})

test("presentation checks rotated account and verified-email claims without retaining raw identity", async () => {
  const filters: Record<string, unknown>[] = []
  let consumedKind: string | null = "verified_email"
  let fail = false
  const admin = {
    from(table: string) {
      assert.equal(table, "trial_identity_claims")
      const where: Record<string, unknown> = {}
      filters.push(where)
      const query = {
        select() {
          return query
        },
        eq(key: string, value: unknown) {
          where[key] = value
          return query
        },
        not(key: string, operator: string, value: unknown) {
          assert.deepEqual([key, operator, value], ["consumed_at", "is", null])
          return query
        },
        async limit(value: number) {
          assert.equal(value, 1)
          return {
            error: fail ? new Error("unavailable") : null,
            data:
              where.kind === consumedKind && where.key_version === 1
                ? [{ consumed_at: "2026-09-01" }]
                : [],
          }
        },
      }
      return query
    },
  } as unknown as SupabaseClient
  const input = {
    userId: "00000000-0000-4000-8000-000000000001",
    verifiedEmail: "Confirmed@Example.test",
    runtime: {
      ...runtime,
      identityKeys: [
        { version: 1, secret: Buffer.alloc(32, 1) },
        { version: 2, secret: Buffer.alloc(32, 2) },
      ],
    },
  }
  assert.equal(await hasConsumedTrialHistory(admin, input), true)
  assert.equal(filters.length, 4)
  assert.ok(
    filters.every(
      (f) => typeof f.claim_digest === "string" && /^[a-f0-9]{64}$/.test(f.claim_digest),
    ),
  )
  consumedKind = "account"
  assert.equal(await hasConsumedTrialHistory(admin, { ...input, verifiedEmail: null }), true)
  consumedKind = null
  assert.equal(await hasConsumedTrialHistory(admin, input), false)
  fail = true
  await assert.rejects(hasConsumedTrialHistory(admin, input), /Trial history unavailable/)
})
