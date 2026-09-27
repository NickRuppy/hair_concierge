import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createAccountDeletionDeps } from "@/lib/account-deletion/runtime"
import {
  AccountDeletionError,
  getAccountDeletionStatus,
  requestAccountDeletion,
  type AccountDeletionDeps,
} from "@/lib/account-deletion/service"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  MobileError,
  mobileBody,
  mobileJSON,
  mobileRateLimit,
  mobileRoute,
  requireMobileUser,
} from "./auth"

const deleteSchema = z.object({ requestId: z.uuid(), confirm: z.literal("delete") }).strict()

/** Swappable for tests only; production callers always use the real implementations. */
export type MobileAccountDeletionDeps = {
  requireUser?: typeof requireMobileUser
  deletionDeps?: (client: SupabaseClient) => AccountDeletionDeps
  adminClient?: () => SupabaseClient
}

function deletionError(error: unknown): never {
  if (error instanceof AccountDeletionError) {
    if (error.code === "web_billing_cancel_failed")
      throw new MobileError("billing_cancel_failed", 503)
    if (error.code === "admin_account") throw new MobileError("admin_account", 403)
    if (error.code === "request_id_conflict") throw new MobileError("request_id_conflict", 409)
  }
  throw new MobileError("temporarily_unavailable", 503)
}

/**
 * Deletes the caller's account (Task 6 service). The same requestId replays safely; once
 * the data is deleted the auth user is gone, so a lost response is recovered through
 * the unauthenticated status lookup, not a second POST. Deliberately not scanner-gated:
 * a paywalled account must be able to delete itself.
 */
export async function handleAccountDeletePost(
  request: Request,
  deps: MobileAccountDeletionDeps = {},
): Promise<Response> {
  return mobileRoute(async () => {
    const { client, userId, token } = await (deps.requireUser ?? requireMobileUser)(request)
    await mobileRateLimit(client, userId, "mobile-account-delete", 10, 600_000)
    const input = deleteSchema.safeParse(await mobileBody(request, 1024))
    if (!input.success) throw new MobileError("invalid_request", 400)

    const { state } = await requestAccountDeletion(
      { userId, requestId: input.data.requestId },
      (deps.deletionDeps ?? createAccountDeletionDeps)(client),
    ).catch(deletionError)
    // External cleanup may still be pending; the account itself is gone.
    if (state !== "data_deleted" && state !== "external_cleanup_done")
      throw new MobileError("temporarily_unavailable", 503)

    // Best effort, as logout does: the auth user (and its sessions) no longer exist.
    try {
      await client.auth.admin.signOut(token, "local")
    } catch {}
    return mobileJSON({ status: "deleted" })
  })
}

/** Unauthenticated state lookup for a client whose delete response was lost. */
export async function handleAccountDeleteStatus(
  request: Request,
  requestId: string,
  deps: MobileAccountDeletionDeps = {},
): Promise<Response> {
  return mobileRoute(async () => {
    const client = (deps.adminClient ?? createAdminClient)()
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
    await mobileRateLimit(client, ip, "mobile-account-delete-status-ip", 30, 60_000)
    if (!z.uuid().safeParse(requestId).success) throw new MobileError("invalid_request", 400)
    let state
    try {
      state = await getAccountDeletionStatus(requestId, {
        rpc: (name, args) => client.rpc(name, args),
      })
    } catch {
      throw new MobileError("temporarily_unavailable", 503)
    }
    if (state === null) throw new MobileError("not_found", 404)
    return mobileJSON({ state })
  })
}

/** Whether the confirmation must disclose the immediate web cancellation (A1). */
export async function handleAccountDeletePreflight(
  request: Request,
  deps: MobileAccountDeletionDeps = {},
): Promise<Response> {
  return mobileRoute(async () => {
    const { client, userId } = await (deps.requireUser ?? requireMobileUser)(request)
    await mobileRateLimit(client, userId, "mobile-account-delete-preflight", 20, 60_000)
    let subscriptions
    try {
      subscriptions = await (deps.deletionDeps ?? createAccountDeletionDeps)(
        client,
      ).listWebSubscriptions(userId)
    } catch {
      throw new MobileError("temporarily_unavailable", 503)
    }
    return mobileJSON({ webSubscription: subscriptions.length > 0 })
  })
}
