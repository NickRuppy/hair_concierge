import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import vm from "node:vm"
import path from "node:path"
import ts from "typescript"
import { buildTrialMembershipState } from "../src/lib/billing/trial-membership"

const require = createRequire(import.meta.url)
const userId = "11111111-1111-4111-8111-111111111111"
const enrollment = {
  id: "22222222-2222-4222-8222-222222222222",
  user_id: userId,
  admission_status: "active",
  authorization_succeeded_at: "2026-01-01T12:00:00Z",
  original_trial_end_at: "2026-01-08T12:00:00Z",
  first_payment_succeeded_at: null,
  paid_through_at: null,
  renewal_grace_ends_at: null,
  renewal_payment_failed: false,
  cancel_at_period_end: false,
  access_revoked: false,
  accepted_offer: {
    cohort: "trial_v1",
    offerVersion: "trial_launch_v1",
    interval: "year",
    currency: "EUR",
    trialDays: 7,
    firstAmountMinor: 6999,
    renewalAmountMinor: 9999,
    taxBehavior: "inclusive",
    stripePriceId: "price_accepted",
    stripeCouponId: "coupon_accepted",
  },
}

function fixture(
  options: {
    trial?: unknown
    lookupError?: boolean
    contract?: unknown
    contractError?: boolean
    active?: boolean
    accessError?: boolean
    signedOut?: boolean
  } = {},
) {
  const calls: string[] = []
  const filters: unknown[] = []
  const orderings: unknown[] = []
  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: options.signedOut ? null : { id: userId, email: "marie@example.test" } },
      }),
    },
    from(table: string) {
      calls.push(table)
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => ({
          data:
            table === "profiles"
              ? { full_name: "Marie Beispiel" }
              : { hair_texture: "wavy", thickness: "fine", goals: ["shine"] },
          error: null,
        }),
      }
      return q
    },
  }
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name)
      assert.equal(name, "read_trial_effective_contract")
      assert.deepEqual(args, { p_enrollment_id: enrollment.id })
      return {
        data: options.contract ?? {
          accepted_offer: (options.trial as typeof enrollment).accepted_offer,
          provider: "stripe",
          provider_agreement_id: "sub_original",
          revision: 0,
        },
        error: options.contractError ? new Error("contract unavailable") : null,
      }
    },
    from(table: string) {
      calls.push(table)
      assert.equal(table, "trial_enrollments")
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          filters.push([key, value])
          return q
        },
        order: (key: string, options: unknown) => {
          orderings.push([key, options])
          return q
        },
        limit: () => q,
        maybeSingle: async () => ({
          data: options.trial ?? null,
          error: options.lookupError ? new Error("lookup unavailable") : null,
        }),
      }
      return q
    },
  }
  const component = () => null
  const mocks: Record<string, unknown> = {
    "next/navigation": {
      redirect: (location: string) => {
        throw new Error(`REDIRECT:${location}`)
      },
    },
    "@/lib/supabase/server": { createClient: async () => supabase },
    "@/lib/supabase/admin": { createAdminClient: () => admin },
    "@/lib/billing/subscriptions": {
      hasCurrentAppAccess: async () => {
        if (options.accessError) throw new Error("access unavailable")
        return options.active ?? false
      },
    },
    "@/components/reactivation/membership-reactivation-page": {
      MembershipReactivationPage: component,
      TrialMembershipReactivationPage: component,
    },
    "@/lib/funnel/flags": { isPersonalPlanLaunchPricingEnabled: () => false },
  }
  const filename = path.resolve("src/app/reactivate/page.tsx")
  const code = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText
  const module = {
    exports: {} as { default: (props: unknown) => Promise<{ props: Record<string, unknown> }> },
  }
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename })(
    (specifier: string) =>
      mocks[specifier] ??
      require(specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2)) : specifier),
    module,
    module.exports,
  )
  return {
    calls,
    filters,
    orderings,
    render: () =>
      module.exports.default({
        searchParams: Promise.resolve({ interval: "year", next: "/routine?view=week" }),
      }),
  }
}

test("expired trial branches before private profile reads and receives immutable management facts", async () => {
  const f = fixture({ trial: enrollment })
  const page = await f.render()
  assert.equal(f.calls.includes("hair_profiles"), false)
  assert.equal(f.calls.includes("profiles"), false)
  assert.deepEqual(f.filters, [["user_id", userId]])
  assert.deepEqual(f.orderings, [
    ["authorization_succeeded_at", { ascending: false, nullsFirst: false }],
    ["created_at", { ascending: false }],
  ])
  assert.deepEqual(page.props.initialState, {
    ...buildTrialMembershipState(enrollment, userId, new Date()),
    managementRevision: 0,
  })
  assert.deepEqual(f.calls, ["trial_enrollments", "read_trial_effective_contract"])
  assert.equal(page.props.routinePreview, undefined)
  assert.equal(page.props.showCheckout, undefined)
})

test("expired trial uses the current verified offer revision while retaining the original trial deadline", async () => {
  const currentOffer = {
    ...enrollment.accepted_offer,
    interval: "month",
    firstAmountMinor: 999,
    renewalAmountMinor: 999,
    stripePriceId: "price_month_accepted",
    stripeCouponId: null,
  }
  const f = fixture({
    trial: enrollment,
    contract: {
      accepted_offer: currentOffer,
      provider: "stripe",
      provider_agreement_id: "sub_restored",
      revision: 2,
    },
  })
  const page = await f.render()
  assert.deepEqual(page.props.initialState, {
    ...buildTrialMembershipState(
      { ...enrollment, accepted_offer: currentOffer },
      userId,
      new Date(),
    ),
    managementRevision: 2,
  })
  assert.deepEqual(f.calls, ["trial_enrollments", "read_trial_effective_contract"])
})

test("unknown enrollment and access failures never expose a private preview or paid checkout", async () => {
  for (const options of [
    { lookupError: true },
    { trial: { ...enrollment, accepted_offer: {} } },
    { trial: { ...enrollment, admission_status: "reserved" } },
    { trial: enrollment, contractError: true },
    { trial: enrollment, contract: {} },
    { accessError: true },
  ]) {
    const f = fixture(options)
    const page = await f.render()
    assert.equal(f.calls.includes("hair_profiles"), false)
    assert.equal(f.calls.includes("profiles"), false)
    assert.deepEqual(page.props.initialState, { kind: "uncertain" })
    assert.equal(page.props.routinePreview, undefined)
    assert.equal(page.props.showCheckout, undefined)
  }
})

test("legacy expired users retain profile preview and selected paid reactivation", async () => {
  const f = fixture()
  const page = await f.render()
  assert.equal(page.props.firstName, "Marie")
  assert.equal(page.props.initialInterval, "year")
  assert.equal(page.props.returnDestination, "/routine?view=week")
  assert.equal(page.props.showCheckout, true)
  assert.ok(page.props.routinePreview)
  assert.equal(page.props.initialState, undefined)
  assert.ok(f.calls.indexOf("trial_enrollments") < f.calls.indexOf("hair_profiles"))
})

test("active and signed-out redirects run before trial or private-data queries", async () => {
  for (const options of [{ active: true }, { signedOut: true }]) {
    const f = fixture(options)
    await assert.rejects(f.render(), /REDIRECT:/)
    assert.deepEqual(f.calls, [])
  }
})
