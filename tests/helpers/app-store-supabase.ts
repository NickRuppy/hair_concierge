/**
 * In-memory Supabase REST transport for the App Store routes. The two upsert RPCs are
 * a line-by-line model of app_store_upsert_transaction / _subscription_status
 * (newer-wins, immutable identity, bind-once per-subscription ownership); the real SQL
 * is exercised by app-store-store-postgres.test.ts. Everything else in the route runs
 * production code through supabase-js.
 */

type Row = Record<string, unknown>

export const appStoreEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:55321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "synthetic-anon",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service",
}

export function withEnv(vars: Record<string, string | undefined>) {
  const saved = Object.fromEntries(Object.keys(vars).map((key) => [key, process.env[key]]))
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

export function createAppStoreSupabase(options: { profiles?: string[]; authUser?: Row } = {}) {
  const transactions = new Map<string, Row>()
  const statuses = new Map<string, Row>()
  const profiles = new Set(options.profiles ?? [])
  const rpcCalls: { name: string; args: Row }[] = []
  const state = { failWrites: 0 }

  const time = (value: unknown) => Date.parse(String(value))
  function owner(original: unknown) {
    for (const row of [...transactions.values(), ...statuses.values()])
      if (row.original_transaction_id === original && row.user_id) return row.user_id as string
    return null
  }

  function upsertTransaction(p: Row) {
    const existing = transactions.get(p.p_transaction_id as string)
    if (existing && existing.original_transaction_id !== p.p_original_transaction_id)
      return { outcome: "identity_mismatch", owner: existing.user_id }
    if (existing && existing.environment !== p.p_environment)
      return { outcome: "environment_mismatch", owner: existing.user_id }
    let bound = owner(p.p_original_transaction_id)
    let outcome: string | undefined =
      p.p_user_id && bound && bound !== p.p_user_id ? "owned_by_other_account" : undefined
    bound ??= (p.p_user_id as string | null) ?? null
    const fields = {
      original_transaction_id: p.p_original_transaction_id,
      app_account_token: p.p_app_account_token,
      product_id: p.p_product_id,
      environment: p.p_environment,
      purchase_date: p.p_purchase_date,
      expires_date: p.p_expires_date,
      offer_type: p.p_offer_type,
      is_trial: p.p_is_trial ?? false,
      revocation_date: p.p_revocation_date,
      revocation_reason: p.p_revocation_reason,
      signed_date: p.p_signed_date,
    }
    if (!existing) {
      transactions.set(p.p_transaction_id as string, {
        transaction_id: p.p_transaction_id,
        user_id: bound,
        ...fields,
      })
      outcome ??= "applied"
    } else if (time(p.p_signed_date) >= time(existing.signed_date)) {
      Object.assign(existing, fields, { user_id: existing.user_id ?? bound })
      outcome ??= "applied"
    } else {
      if (existing.user_id === null && bound) existing.user_id = bound
      outcome ??= "stale"
    }
    return { outcome, owner: transactions.get(p.p_transaction_id as string)!.user_id }
  }

  function upsertStatus(p: Row) {
    const key = p.p_original_transaction_id as string
    const existing = statuses.get(key)
    if (existing && existing.environment !== p.p_environment)
      return { outcome: "environment_mismatch", owner: existing.user_id }
    let bound = owner(key)
    let outcome: string | undefined =
      p.p_user_id && bound && bound !== p.p_user_id ? "owned_by_other_account" : undefined
    bound ??= (p.p_user_id as string | null) ?? null
    const fields = {
      environment: p.p_environment,
      auto_renew_status: p.p_auto_renew_status,
      auto_renew_product_id: p.p_auto_renew_product_id,
      in_billing_retry: p.p_in_billing_retry,
      grace_period_expires_date: p.p_grace_period_expires_date,
      expiration_intent: p.p_expiration_intent,
      signed_date: p.p_signed_date,
      last_notification_type: p.p_last_notification_type,
    }
    if (!existing) {
      statuses.set(key, { original_transaction_id: key, user_id: bound, ...fields })
      outcome ??= "applied"
    } else if (time(p.p_signed_date) >= time(existing.signed_date)) {
      Object.assign(existing, fields, { user_id: existing.user_id ?? bound })
      outcome ??= "applied"
    } else {
      if (existing.user_id === null && bound) existing.user_id = bound
      outcome ??= "stale"
    }
    return { outcome, owner: statuses.get(key)!.user_id }
  }

  const originalFetch = globalThis.fetch
  async function fakeFetch(input: RequestInfo | URL, init?: RequestInit) {
    const url = new URL(String(input instanceof Request ? input.url : input))
    const path = url.pathname
    if (path === "/auth/v1/user" && options.authUser) return Response.json(options.authUser)
    if (path === "/rest/v1/rpc/check_rate_limit") return Response.json(true)
    if (path === "/rest/v1/rpc/get_personal_plan_one_time_access_state")
      return Response.json("none")
    if (path.startsWith("/rest/v1/rpc/app_store_upsert_")) {
      const name = path.slice("/rest/v1/rpc/".length)
      const args = JSON.parse(String(init?.body)) as Row
      rpcCalls.push({ name, args })
      if (state.failWrites > 0) {
        state.failWrites -= 1
        return Response.json({ message: "connection reset" }, { status: 503 })
      }
      return Response.json(
        name === "app_store_upsert_transaction" ? upsertTransaction(args) : upsertStatus(args),
      )
    }
    if (path === "/rest/v1/profiles") {
      const id = url.searchParams.get("id")?.replace(/^eq\./, "")
      return Response.json(id && profiles.has(id) ? [{ id }] : [])
    }
    if (path === "/rest/v1/app_store_transactions") {
      const user = url.searchParams.get("user_id")?.replace(/^eq\./, "")
      return Response.json(
        [...transactions.values()]
          .filter((row) => row.user_id === user)
          .sort((a, b) => time(b.expires_date) - time(a.expires_date)),
      )
    }
    if (path === "/rest/v1/app_store_subscription_status") {
      const raw = url.searchParams.get("original_transaction_id") ?? ""
      const wanted = raw
        .replace(/^in\.\(/, "")
        .replace(/\)$/, "")
        .split(",")
        .map((value) => value.replace(/^"|"$/g, ""))
      return Response.json(
        [...statuses.values()].filter((row) =>
          wanted.includes(row.original_transaction_id as string),
        ),
      )
    }
    if (path.startsWith("/auth/")) throw new Error(`unexpected auth endpoint ${path}`)
    // Web entitlement reads (billing, grants, roster, legacy profile): no web access.
    return Response.json([])
  }

  return {
    transactions,
    statuses,
    profiles,
    rpcCalls,
    state,
    /** Account deletion: both tables reference profiles ON DELETE CASCADE. */
    deleteProfile(id: string) {
      profiles.delete(id)
      for (const table of [transactions, statuses])
        for (const [key, row] of table) if (row.user_id === id) table.delete(key)
    },
    install() {
      globalThis.fetch = fakeFetch as typeof fetch
      return () => {
        globalThis.fetch = originalFetch
      }
    },
  }
}
