import { readFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import vm from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..")
export const USER_ID = "00000000-0000-4000-8000-000000000001"
export const RESERVATION_ID = "00000000-0000-4000-8000-000000000002"
export const ATTEMPT_ID = "00000000-0000-4000-8000-000000000003"
export const LEAD_ID = "00000000-0000-4000-8000-000000000004"

// Execute the real routes and owned helpers; only provider/network/framework boundaries
// are replaced. SQL transaction semantics have separate isolated database tests.
export function returningCheckoutFixture(
  options: {
    signedOut?: boolean
    customer?: string | null
    access?: "expired" | "active" | "cancelled_current" | "partner" | "former_moderator_partner"
    customerError?: Record<string, unknown>
    createError?: Record<string, unknown>
    priceMode?: boolean
    secretKey?: string
    publishableKey?: string
    bindFailure?: boolean
    grantAccessOnIntentCreation?: boolean
  } = {},
) {
  const now = new Date()
  const profile = {
    id: USER_ID,
    email: "login@example.test",
    stripe_customer_id: options.customer === undefined ? "cus_valid" : options.customer,
    subscription_status: options.access === "active" ? "active" : "canceled",
    current_period_end: new Date(
      now.getTime() +
        (options.access === "active" || options.access === "cancelled_current"
          ? 86400000
          : -86400000 * 10),
    ).toISOString(),
  }
  const state = {
    reservation: null as Record<string, any> | null,
    intent: null as Record<string, any> | null,
    calls: [] as { params: any; options: any }[],
    cookies: [] as unknown[],
    signals: [] as unknown[],
    customerReads: 0,
    acquireCalls: 0,
    acquisitions: [] as Record<string, unknown>[],
    sessions: new Map<string, any>(),
    createError: options.createError,
    bindFailure: options.bindFailure,
  }
  const user = options.signedOut ? null : { id: USER_ID, email: profile.email }
  function query(table: string) {
    let operation = "read",
      values: any,
      single = false
    const filters: ((row: any) => boolean)[] = []
    const q: any = {
      select: () => q,
      eq: (key: string, value: unknown) => {
        filters.push((row) => row[key] === value)
        return q
      },
      ilike: (key: string, value: string) => {
        filters.push((row) => row[key]?.toLowerCase() === value.toLowerCase())
        return q
      },
      is: (key: string, value: unknown) => {
        filters.push(
          (row) =>
            (key.includes("->>")
              ? (row.metadata?.[key.split("->>")[1]] ?? null)
              : (row[key] ?? null)) === value,
        )
        return q
      },
      in: (key: string, values: unknown[]) => {
        filters.push((row) => values.includes(row[key]))
        return q
      },
      order: () => q,
      limit: () => q,
      update: (v: any) => {
        operation = "update"
        values = v
        return q
      },
      insert: (v: any) => {
        operation = "insert"
        values = v
        return q
      },
      single: () => {
        single = true
        return q
      },
      maybeSingle: () => {
        single = true
        return q
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve()
          .then(() => {
            let rows: any[] = []
            if (table === "profiles") rows = [profile]
            if (table === "leads") rows = [{ id: LEAD_ID, email: profile.email }]
            if (table === "manual_access_grants" && options.access?.includes("partner"))
              rows = [
                {
                  id: "grant",
                  user_id: USER_ID,
                  email: profile.email,
                  revoked_at: null,
                  expires_at: null,
                  reason: "partner",
                },
              ]
            if (table === "membership_reactivation_checkout_reservations")
              rows = state.reservation ? [state.reservation] : []
            if (table === "paypal_checkout_intents") {
              if (operation === "insert") {
                if (state.intent) return { data: null, error: { code: "23505" } }
                if (options.grantAccessOnIntentCreation) {
                  profile.subscription_status = "active"
                  profile.current_period_end = new Date(Date.now() + 86400000).toISOString()
                }
                state.intent = {
                  id: "intent",
                  status: "created",
                  provider_subscription_id: null,
                  ...values,
                }
              }
              rows = state.intent ? [state.intent] : []
            }
            rows = rows.filter((row) => filters.every((filter) => filter(row)))
            if (operation === "update") {
              if (
                table === "membership_reactivation_checkout_reservations" &&
                values.provider_reference &&
                state.bindFailure
              )
                return { data: null, error: new Error("fixture bind unavailable") }
              rows.forEach((row) => Object.assign(row, values))
            }
            return { data: single ? (rows[0] ?? null) : rows, error: null }
          })
          .then(resolve, reject),
    }
    return q
  }
  const db = {
    auth: {
      getUser: async () => {
        cookieAdapter?.setAll([
          { name: "refreshed", value: "fixture", options: { httpOnly: true } },
        ])
        return { data: { user }, error: null }
      },
    },
    from: query,
    rpc: async (name: string, args: any) => {
      if (name === "get_personal_plan_one_time_access_state") return { data: "none", error: null }
      if (name === "acquire_membership_reactivation_checkout") {
        state.acquireCalls++
        state.acquisitions.push(structuredClone(args))
        state.reservation ??= {
          id: RESERVATION_ID,
          user_id: args.p_user_id,
          checkout_attempt_id: args.p_checkout_attempt_id,
          interval: args.p_interval,
          return_destination: args.p_return_destination,
          provider: null,
          provider_reference: null,
          status: "open",
          expires_at: new Date(now.getTime() + 86400000).toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
          stripe_checkout_context: null,
        }
        return { data: structuredClone(state.reservation), error: null }
      }
      if (name === "claim_membership_reactivation_paypal_client_creation") {
        const intent = state.intent!
        const row = state.reservation!
        if (
          intent.user_id !== args.p_user_id ||
          intent.reactivation_reservation_id !== row.id ||
          row.provider !== "paypal" ||
          row.provider_reference !== intent.id ||
          intent.metadata.reactivation_client_creation_issued_at
        )
          return { data: false, error: null }
        intent.metadata.reactivation_client_creation_issued_at = new Date().toISOString()
        row.status = "reconciliation_required"
        return { data: true, error: null }
      }
      const row = state.reservation!
      if (
        row.user_id !== args.p_user_id ||
        (row.provider && row.provider !== (args.p_provider ?? "stripe"))
      )
        return { data: null, error: { code: "P0001" } }
      if (name === "claim_membership_reactivation_checkout_provider") {
        row.provider = args.p_provider
        row.status = "provider_selected"
      } else if (name === "prepare_membership_reactivation_stripe_checkout") {
        row.provider = "stripe"
        row.status = "reconciliation_required"
        row.stripe_checkout_context ??= structuredClone(args.p_context)
      } else if (name === "recover_membership_reactivation_stripe_checkout") {
        const context = row.stripe_checkout_context
        context.recovery_params ??= {
          ...context.initial_params,
          customer_email: context.account_email,
        }
        delete context.recovery_params.customer
      } else throw new Error(`Unhandled fixture RPC: ${name}`)
      return { data: structuredClone(row), error: null }
    },
  }
  let cookieAdapter: any
  const stripe = {
    accounts: { retrieve: async () => ({ id: "acct_fixture" }) },
    prices: {
      retrieve: async (id: string) => ({
        id,
        livemode: options.priceMode ?? false,
        active: true,
        type: "recurring",
      }),
    },
    customers: {
      retrieve: async (id: string) => {
        state.customerReads++
        if (options.customerError) throw options.customerError
        return { id, livemode: false }
      },
    },
    checkout: {
      sessions: {
        create: async (params: any, requestOptions: any) => {
          state.calls.push({ params: structuredClone(params), options: requestOptions })
          if (state.createError) throw state.createError
          const key = requestOptions?.idempotencyKey ?? "unkeyed"
          let session = state.sessions.get(key)
          if (!session) {
            session = {
              id: `cs_fixture_${state.sessions.size}`,
              status: "open",
              client_secret: "fixture_only",
              livemode: false,
              metadata: params.metadata,
              expires_at: params.expires_at,
            }
            state.sessions.set(key, session)
          }
          return session
        },
        retrieve: async (id: string) =>
          [...state.sessions.values()].find((session) => session.id === id) ?? {
            id,
            status: "open",
            client_secret: "fixture_only",
            livemode: false,
          },
      },
    },
  }
  const env = {
    STRIPE_SECRET_KEY: options.secretKey ?? "sk_test_fixture",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: options.publishableKey ?? "pk_test_fixture",
    STRIPE_PRICE_ID_MONTHLY: "price_fixture",
    NEXT_PUBLIC_PAYPAL_ENABLED: "true",
  }
  const overrides: Record<string, any> = {
    "next/server": {
      NextResponse: {
        json: (body: any, opts: any = {}) => ({
          status: opts.status ?? 200,
          body,
          cookies: { set() {} },
        }),
      },
      after() {},
    },
    "next/headers": {
      cookies: async () => ({
        getAll: () => [],
        get: () => undefined,
        set: (...args: unknown[]) => state.cookies.push(args),
      }),
    },
    "@supabase/ssr": {
      createServerClient: (_url: unknown, _key: unknown, opts: any) => {
        cookieAdapter = opts.cookies
        return db
      },
    },
    "@supabase/supabase-js": { createClient: () => db },
    "@/lib/supabase/admin": { createAdminClient: () => db },
    "@/lib/observability/checkout": {
      captureCheckoutException: (...args: unknown[]) => state.signals.push(args),
    },
    "@/lib/observability/payment-server": {
      captureServerPaymentFailure: (value: unknown) => state.signals.push(value),
      flushServerPaymentTelemetry: async () => {},
    },
    "@/lib/funnel/server": {
      resolveFunnelCookieContext: async () => null,
      resolveFunnelContextForLead: async () => null,
    },
    "@/lib/funnel/flags": { isPersonalPlanLaunchPricingEnabled: () => false },
    "@/lib/entitlements/flag": { isFreemiumScannerFirstEnabled: () => false },
    "@/lib/stripe/client": {
      getStripe: () => stripe,
      getStripePriceId: () => "price_fixture",
      resolveStripePriceId: () => ({ interval: "month", pricingCatalog: "standard" }),
    },
    "@/lib/paypal/plans": {
      getPayPalPlanId: () => "P-fixture",
      resolvePayPalPlanId: () => ({ interval: "month", pricingCatalog: "standard" }),
    },
  }
  const cache = new Map<string, any>()
  function load(name: string, parent = root): any {
    if (name in overrides) return overrides[name]
    if (name === "server-only") return {}
    if (!name.startsWith("@/") && !name.startsWith(".") && !name.startsWith("/"))
      return require(name)
    let file = name.startsWith("@/")
      ? path.join(root, "src", name.slice(2))
      : path.resolve(parent, name)
    if (!path.extname(file)) file += ".ts"
    if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"))
    if (cache.has(file)) return cache.get(file)
    const exports = {}
    cache.set(file, exports)
    const routeBaseline =
      process.env.RETURNING_CHECKOUT_ROUTE_BASELINE === "true" &&
      /src\/app\/api\/(stripe|paypal)\//.test(file)
    const moduleSource = routeBaseline
      ? execFileSync("git", ["show", `5a3e33f1:${path.relative(root, file)}`], {
          cwd: root,
          encoding: "utf8",
        })
      : readFileSync(file, "utf8")
    const source = ts.transpileModule(moduleSource, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText
    vm.runInNewContext(
      source,
      {
        exports,
        require: (id: string) => load(id, path.dirname(file)),
        process: { env },
        console,
        Error,
        Buffer,
        URL,
        URLSearchParams,
        TextEncoder,
        TextDecoder,
        Date,
        crypto: globalThis.crypto,
        setTimeout,
        clearTimeout,
        structuredClone,
      },
      { filename: file },
    )
    return exports
  }
  return {
    state,
    profile,
    stripe,
    db,
    async post(provider: "stripe" | "paypal" = "stripe", body: Record<string, unknown> = {}) {
      const route = load(
        `@/app/api/${provider}/${provider === "stripe" ? "create-checkout-session" : "create-subscription-intent"}/route`,
      )
      return route.POST({
        json: async () => ({
          interval: "month",
          source: "pricing_page",
          checkoutContext: "membership_reactivation",
          checkoutAttemptId: ATTEMPT_ID,
          returnDestination: "/chat",
          ...body,
        }),
        nextUrl: new URL("https://fixture.invalid/api/checkout"),
      })
    },
  }
}
