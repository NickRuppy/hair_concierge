import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getPayPalAppId, paypalRequest } from "./client"
import type { PayPalSubscription } from "./subscription-shapes"
import { parsePayPalTrialTransactions, type PayPalTrialTransaction } from "./trial-runtime"
import { reconcilePayPalTrialManagement } from "./trial-management"
import { reconcilePayPalTrialPaidRecovery } from "./trial-paid-recovery"
type Candidate = {
  agreement_id: string
  lease_token: string
  kind: "initial" | "management" | "paid_recovery"
  reference_id: string
  app_id: string
  plan_id: string
  custom_id: string
  created_at: string
}
type Deps = {
  supabase: SupabaseClient
  attestApp?: typeof getPayPalAppId
  retrieve?: (id: string) => Promise<PayPalSubscription>
  cancel?: (id: string) => Promise<void>
  transactions?: (id: string, from: string) => Promise<PayPalTrialTransaction[]>
  reconcileAccepted?: (candidate: Candidate, userId: string | null) => Promise<boolean>
}
async function rpc(d: Deps, name: string, args: Record<string, unknown>) {
  const { data, error } = await d.supabase.rpc(name, args)
  if (error) throw new Error("PayPal pending approval expiry persistence failed")
  return data
}
const requestTimeout = () => AbortSignal.timeout(5000)
const retrieveDefault = (id: string) =>
  paypalRequest<PayPalSubscription>(
    `/v1/billing/subscriptions/${encodeURIComponent(id)}?fields=plan`,
    { signal: requestTimeout() },
  )
const cancelDefault = (id: string) =>
  paypalRequest<void>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    signal: requestTimeout(),
    body: JSON.stringify({ reason: "Unapproved checkout expired before scheduled collection" }),
  })
async function transactionsDefault(id: string, from: string) {
  const q = new URLSearchParams({
    start_time: new Date(Math.floor(Date.parse(from) / 1000) * 1000 - 1000).toISOString(),
    end_time: new Date().toISOString(),
  })
  const r = await paypalRequest<{
    transactions?: PayPalTrialTransaction[]
    total_items?: number
    total_pages?: number
  }>(`/v1/billing/subscriptions/${encodeURIComponent(id)}/transactions?${q}`, {
    signal: requestTimeout(),
  })
  return parsePayPalTrialTransactions(r)
}
function bound(s: PayPalSubscription, c: Candidate) {
  if (s.id !== c.agreement_id || s.plan_id !== c.plan_id || s.custom_id !== c.custom_id)
    throw new Error("PayPal expiry candidate binding mismatch")
}
/** Uses stored approval expiry plus a two-cron-tick guard before original collection; never abandons an accepted/paid contract. */
export async function reconcilePayPalTrialCandidateExpiry(d: Deps) {
  const claimed = await rpc(d, "claim_paypal_trial_candidate_expiry", { p_limit: 5 })
  if (!Array.isArray(claimed)) throw new Error("PayPal expiry candidates unavailable")
  const outcomes = await Promise.all(
    claimed.map(async (value: unknown) => {
      const c = value as Candidate
      let result: "canceled_no_payment" | "accepted" | "reconciliation_required" =
        "reconciliation_required"
      try {
        if (
          !c ||
          !["initial", "management", "paid_recovery"].includes(c.kind) ||
          !c.agreement_id ||
          !c.lease_token ||
          !c.app_id ||
          !c.plan_id ||
          !c.custom_id ||
          !Number.isFinite(Date.parse(c.created_at))
        )
          throw new Error("Invalid PayPal expiry candidate")
        if ((await (d.attestApp ?? getPayPalAppId)()) !== c.app_id)
          throw new Error("PayPal expiry app mismatch")
        const retrieve = d.retrieve ?? retrieveDefault,
          local = () =>
            rpc(d, "read_paypal_trial_candidate_expiry_state", {
              p_agreement_id: c.agreement_id,
              p_lease_token: c.lease_token,
            })
        let s = await retrieve(c.agreement_id)
        bound(s, c)
        let state = await local()
        if (state?.committed) result = "accepted"
        else {
          // A payer approval racing the expiry read owns normal authorization/payment reconciliation.
          if (s.status === "APPROVAL_PENDING") {
            s = await retrieve(c.agreement_id)
            bound(s, c)
            state = await local()
          }
          if (state?.committed) result = "accepted"
          else if (["ACTIVE", "APPROVED"].includes(s.status ?? "") && !state?.invalidated) {
            let accepted = false
            if (d.reconcileAccepted) accepted = await d.reconcileAccepted(c, state?.userId ?? null)
            else if (state?.userId && c.kind !== "initial") {
              const input = { operationId: c.reference_id, authenticatedUserId: state.userId }
              const r =
                c.kind === "management"
                  ? await reconcilePayPalTrialManagement(input, { supabase: d.supabase })
                  : await reconcilePayPalTrialPaidRecovery(input, { supabase: d.supabase })
              accepted = r.status === "committed"
            }
            // Initial ACTIVE requires its canonical verified ACTIVATED event. GET/status_update_time cannot invent that clock.
            result = accepted ? "accepted" : "reconciliation_required"
          } else if (
            ["APPROVAL_PENDING", "CANCELLED", "EXPIRED"].includes(s.status ?? "") ||
            state?.invalidated
          ) {
            if (!["CANCELLED", "EXPIRED"].includes(s.status ?? "")) {
              try {
                await (d.cancel ?? cancelDefault)(c.agreement_id)
              } catch {}
              s = await retrieve(c.agreement_id)
              bound(s, c)
            }
            const tx = await (d.transactions ?? transactionsDefault)(c.agreement_id, c.created_at)
            if (
              ["CANCELLED", "EXPIRED"].includes(s.status ?? "") &&
              tx.every((t) => ["FAILED", "DENIED", "DECLINED"].includes(t.status ?? ""))
            )
              result = "canceled_no_payment"
          }
        }
      } catch {
        /* Keep a durable retry and expose the unresolved count. */
      }
      const complete = await rpc(d, "complete_paypal_trial_candidate_expiry", {
        p_agreement_id: c.agreement_id,
        p_lease_token: c.lease_token,
        p_result: result,
      })
      if (complete !== true) throw new Error("PayPal expiry receipt not persisted")
      return result
    }),
  )
  return {
    claimed: outcomes.length,
    canceled: outcomes.filter((x) => x === "canceled_no_payment").length,
    accepted: outcomes.filter((x) => x === "accepted").length,
    pending: outcomes.filter((x) => x === "reconciliation_required").length,
  }
}
