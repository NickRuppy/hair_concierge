import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import test from "node:test"
import ts from "typescript"
import vm from "node:vm"

const require = createRequire(import.meta.url)

type Options = {
  signedIn?: boolean
  stripeRecoveryCode?: string | null
  stripeVerifyError?:
    | unknown
    | ((CheckoutActivationError: new (code: string, message: string) => Error) => unknown)
  recoveredStripeSession?: unknown
  paypalActivation?: unknown
  paypalError?: unknown | ((RecoveryError: new (code: string) => Error) => unknown)
  bypassStripePreflight?: boolean
}

function loadWelcome(options: Options = {}) {
  const calls: string[] = []
  const { CheckoutRecoveryError: RecoveryError } = require(
    path.resolve("src/lib/auth/checkout-activation-outcome.ts"),
  )
  const { classifyCheckoutRecoveryError } = require(
    path.resolve("src/lib/auth/checkout-recovery-classification.ts"),
  )
  class CheckoutActivationError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message)
    }
  }
  const CheckoutRecoveryPanel = () => null
  const WelcomeClient = () => null
  const stripeSession = {
    customer_details: { email: "marie@example.test" },
    metadata: { trial_enrollment_id: "enrollment", trial_cohort: "trial_v1" },
  }
  const mocks: Record<string, unknown> = {
    "next/navigation": {
      unstable_rethrow: () => undefined,
      redirect: () => {
        throw new Error("unexpected redirect")
      },
    },
    "next/server": { after: () => undefined },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    "@/lib/auth/checkout-activation-outcome": { CheckoutRecoveryError: RecoveryError },
    "@/lib/auth/checkout-recovery-classification": { classifyCheckoutRecoveryError },
    "@/components/checkout-recovery-panel": { CheckoutRecoveryPanel },
    "./checkout-recovery-panel": { CheckoutRecoveryPanel },
    "./return-recovery-client": { WelcomeReturnRecovery: () => null },
    "./return-recovery": { paypalWelcomeReturnExpiresAt: () => null },
    "./welcome-client": { WelcomeClient },
    "@/lib/supabase/server": {
      createClient: async () => {
        calls.push("createClient")
        return {
          auth: {
            getUser: async () => ({
              data: { user: options.signedIn ? { id: "user", email: "marie@example.test" } : null },
            }),
          },
        }
      },
    },
    "@/lib/supabase/admin": { createAdminClient: () => ({}) },
    "@/lib/stripe/client": {
      getStripe: () => ({
        checkout: {
          sessions: { retrieve: async () => options.recoveredStripeSession ?? stripeSession },
        },
      }),
    },
    "@/lib/stripe/checkout-activation": {
      CheckoutActivationError,
      verifyCheckoutSessionForActivation: async () => {
        if (options.stripeVerifyError)
          throw typeof options.stripeVerifyError === "function"
            ? options.stripeVerifyError(CheckoutActivationError)
            : options.stripeVerifyError
        return stripeSession
      },
      getStripeTrialReturnRecoveryCode: async () => options.stripeRecoveryCode ?? null,
      ensureCheckoutAccount: async () => {
        calls.push("ensureCheckoutAccount")
        throw new Error("must not activate")
      },
      ensureOneTimeCheckoutAccount: async () => {
        calls.push("ensureOneTimeCheckoutAccount")
        throw new Error("must not activate")
      },
    },
    "@/lib/paypal/checkout-activation": {
      PayPalCheckoutActivationError: class extends Error {},
      ensurePayPalCheckoutAccountForToken: async () => {
        calls.push("ensurePayPalCheckoutAccountForToken")
        if (options.paypalError)
          throw typeof options.paypalError === "function"
            ? options.paypalError(RecoveryError)
            : options.paypalError
        return options.paypalActivation ?? { status: "pending" }
      },
    },
    "@/lib/billing/tier-ids": { getPremiumTierId: async () => "tier" },
    "@/lib/billing/checkout-success-redirect": {
      getCheckoutFirstTimeDestinationOptionsFromAccount: () => ({}),
      getAuthenticatedCheckoutSuccessRedirect: async () => "/routine",
      getCheckoutFirstTimeDestination: async () => "/routine",
      resolvePersonalPlanCheckoutReadiness: async () => ({}),
      resolveCheckoutFirstTimeDestination: async () => {
        calls.push("firstDestination")
        return "/routine"
      },
    },
    "@/lib/paypal/checkout-intents": { findPayPalCheckoutIntentByToken: async () => null },
    "@/lib/quiz/link-to-profile": { linkQuizToProfile: async () => undefined },
    "@/lib/observability/checkout": {
      captureCheckoutException: (error: unknown) =>
        calls.push(`capture:${error instanceof Error ? error.message : "unknown"}`),
    },
    "@/lib/stripe/purchase-analytics": { buildCheckoutPurchaseAnalytics: async () => null },
    "@/lib/paypal/order-activation": {
      recoverPayPalOrderActivation: async () => ({ status: "pending" }),
    },
    "@/lib/reactivation/return-destination": { sanitizeReactivationReturnDestination: () => null },
    "@/lib/personal-plan/release": { getPersonalPlanNewBuyerCohortCutoff: () => null },
    "@/lib/personal-plan/rollout-access": { isPersonalPlanAppV1AllowedForUser: () => false },
    "@/lib/billing/purchases": {
      findOneTimePurchaseEntitlementForUser: async () => null,
      resolveOneTimePurchaseAccessState: async () => null,
    },
  }
  const filename = path.resolve("src/app/welcome/page.tsx")
  const source = readFileSync(filename, "utf8")
  const code = ts.transpileModule(
    options.bypassStripePreflight
      ? source.replace(
          "if (recoveryCode) return <CheckoutRecoveryPanel code={recoveryCode} />",
          "if (false) return <CheckoutRecoveryPanel code={recoveryCode} />",
        )
      : source,
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    },
  ).outputText
  const module = { exports: {} as { default: (props: unknown) => Promise<any> } }
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
    console,
    module,
    require,
    exports: module.exports,
  })(
    (specifier: string) =>
      mocks[specifier] ??
      require(specifier.startsWith("@/") ? path.resolve("src", specifier.slice(2)) : specifier),
    module,
    module.exports,
  )
  return {
    calls,
    RecoveryError,
    CheckoutRecoveryPanel,
    WelcomeClient,
    render: (searchParams: Record<string, string | undefined>) =>
      module.exports.default({ searchParams: Promise.resolve(searchParams) }),
  }
}

function assertRecoveryPanel(page: any, component: unknown, code: string) {
  assert.equal(page.type, component)
  assert.equal(page.props.code, code)
}

test("persisted Stripe trial denial renders before account writes or destination reads for signed-in and anonymous returns", async () => {
  for (const signedIn of [true, false]) {
    const f = loadWelcome({ signedIn, stripeRecoveryCode: "trial_unavailable" })
    const page = await f.render({ session_id: "cs_trial" })
    assertRecoveryPanel(page, f.CheckoutRecoveryPanel, "trial_unavailable")
    assert.deepEqual(f.calls, [])
  }
})

test("the preflight guard is sensitive to an in-memory bypass", async () => {
  const f = loadWelcome({ stripeRecoveryCode: "trial_unavailable", bypassStripePreflight: true })
  const page = await f.render({ session_id: "cs_trial" })
  assert.notEqual(page.type, f.CheckoutRecoveryPanel)
  assert.deepEqual(f.calls, ["firstDestination", "createClient"])
})

test("Stripe verification failures keep paid one-time returns pending and classify terminal failures", async () => {
  const paid = loadWelcome({
    stripeVerifyError: (CheckoutActivationError: new (code: string, message: string) => Error) =>
      new CheckoutActivationError("checkout_one_time_charge_revoked", "payment needs confirmation"),
    recoveredStripeSession: {
      mode: "payment",
      payment_status: "paid",
      customer_details: { email: "buyer@example.test" },
    },
  })
  const paidPage = await paid.render({ session_id: "cs_paid" })
  assert.equal(paidPage.type, paid.WelcomeClient)
  assert.equal(paidPage.props.mode, "pending")
  assert.equal(paidPage.props.oneTimeReturnState, "revoked")
  assert.equal(paidPage.props.email, "buyer@example.test")

  const structural = loadWelcome({
    stripeVerifyError: (CheckoutActivationError: new (code: string, message: string) => Error) =>
      new CheckoutActivationError("checkout_subscription_inactive", "subscription cannot activate"),
  })
  assertRecoveryPanel(
    await structural.render({ session_id: "cs_structural" }),
    structural.CheckoutRecoveryPanel,
    "trial_reconciliation_required",
  )

  const missing = loadWelcome({
    stripeVerifyError: (CheckoutActivationError: new (code: string, message: string) => Error) =>
      new CheckoutActivationError("resource_missing", "provider object missing"),
  })
  assertRecoveryPanel(
    await missing.render({ session_id: "cs_missing" }),
    missing.CheckoutRecoveryPanel,
    "activation_link_invalid",
  )

  const temporary = loadWelcome({
    stripeVerifyError: new Error("network detail should stay private"),
  })
  const temporaryPage = await temporary.render({ session_id: "cs_network" })
  assertRecoveryPanel(temporaryPage, temporary.CheckoutRecoveryPanel, "activation_temporary")
  assert.equal(JSON.stringify(temporaryPage).includes("network detail"), false)
})

test("PayPal recovery duplicate uses a terminal panel while legacy duplicate retains its existing client mode", async () => {
  const recovered = loadWelcome({
    paypalActivation: { status: "duplicate", recoveryCode: "trial_checkout_conflict" },
  })
  assertRecoveryPanel(
    await recovered.render({ provider: "paypal", token: "token" }),
    recovered.CheckoutRecoveryPanel,
    "trial_checkout_conflict",
  )
  const legacy = loadWelcome({ paypalActivation: { status: "duplicate" } })
  const page = await legacy.render({ provider: "paypal", token: "token" })
  assert.equal(page.type, legacy.WelcomeClient)
  assert.equal(page.props.mode, "duplicate")
})

test("invalid PayPal token and failures render safe terminal panels without raw provider errors", async () => {
  const invalid = loadWelcome()
  assertRecoveryPanel(
    await invalid.render({ provider: "paypal" }),
    invalid.CheckoutRecoveryPanel,
    "activation_link_invalid",
  )

  const temporary = loadWelcome({ paypalError: new Error("provider secret: do not expose") })
  const temporaryPage = await temporary.render({ provider: "paypal", token: "token" })
  assertRecoveryPanel(temporaryPage, temporary.CheckoutRecoveryPanel, "activation_temporary")
  assert.equal(JSON.stringify(temporaryPage).includes("provider secret"), false)

  const typed = loadWelcome({
    paypalError: (RecoveryError: new (code: string) => Error) =>
      new RecoveryError("trial_reconciliation_required"),
  })
  assertRecoveryPanel(
    await typed.render({ provider: "paypal", token: "token" }),
    typed.CheckoutRecoveryPanel,
    "trial_reconciliation_required",
  )
})

test("incomplete and unpaid Stripe returns allow finishing the same checkout", async () => {
  for (const code of ["checkout_session_incomplete", "checkout_session_unpaid"]) {
    const f = loadWelcome({
      stripeVerifyError: (ErrorType: new (code: string, message: string) => Error) =>
        new ErrorType(code, "private details"),
    })
    assertRecoveryPanel(
      await f.render({ session_id: "cs_pending" }),
      f.CheckoutRecoveryPanel,
      "checkout_incomplete",
    )
    assert.ok(!f.calls.includes("ensureCheckoutAccount"))
  }
})
