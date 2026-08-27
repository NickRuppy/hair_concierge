export type ResetDisposition = "delete" | "reset_profile" | "revoke_exact" | "retain_zero"

export type ResetTable = {
  readonly table: string
  readonly disposition: ResetDisposition
  readonly reason: string
  readonly selectorSql: string
  readonly deleteSql?: string
}

export const REQUIRED_PROFILE_RETAIN_COLUMNS = ["id", "email", "is_admin", "created_at"] as const
export const REQUIRED_AUTH_USERS_COLUMNS = ["id", "email", "raw_app_meta_data"] as const
export const REQUIRED_AUTH_APP_METADATA_KEYS_ALLOWLIST = [
  "access_kind",
  "field_test_flow",
  "personal_plan_test",
  "personal_plan_test_campaign_id",
  "personal_plan_test_member_id",
  "quiz_lead_id",
  "lead_id",
  "onboarding_state",
] as const
export const REQUIRED_AUTH_USER_METADATA_KEYS_ALLOWLIST = ["manual_access_reason"] as const
export const EXCLUDED_OWNER_VIEWS = [
  "public.billing_subscriptions_classified",
  "public.billing_subscriptions_current",
] as const

const userId = "v_user_id"
const email = "v_email"

export const RESET_TABLES: readonly ResetTable[] = [
  {
    table: "public.personal_plan_test_members",
    disposition: "retain_zero",
    reason:
      "the new email-bound campaign roster must not exist before this one-off legacy reset; any row is a rollout-order blocker",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.customerio_profile_sync_outbox",
    disposition: "delete",
    reason: "old profile sync jobs can project stale quiz/profile data after reset",
    selectorSql: `lead_id = ANY(v_owned_lead_ids)`,
  },
  {
    table: "public.personal_plan_result_returns",
    disposition: "delete",
    reason: "old result-return credentials can rehydrate the previous Personal Plan result",
    selectorSql: `lead_id = ANY(v_owned_lead_ids)`,
  },
  {
    table: "public.personal_plan_quiz_drafts",
    disposition: "delete",
    reason: "old resume credentials and browser generations must not survive the fresh start",
    selectorSql: `funnel_session_id = ANY(v_owned_funnel_session_ids)`,
  },
  {
    table: "public.personal_plan_test_enrollments",
    disposition: "delete",
    reason:
      "old complimentary enrollments are app state and are replaced only by the new invitation flow",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.regular_quiz_test_enrollments",
    disposition: "delete",
    reason:
      "legacy regular-quiz enrollment state must be cleared before funnel and lead state are removed",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.checkout_activation_claims",
    disposition: "delete",
    reason: "old post-checkout auth activation credentials must not reopen a legacy setup path",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.scan_wishlist",
    disposition: "delete",
    reason: "scan saved-product state belongs to the previous app experience",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.scan_resolve_events",
    disposition: "delete",
    reason: "scan attempt history is active runtime evidence for the previous app experience",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.routine_log_products",
    disposition: "delete",
    reason: "tracker product rows are child state of routine logs",
    selectorSql: `routine_log_id = ANY(v_owned_routine_log_ids)`,
  },
  {
    table: "public.routine_logs",
    disposition: "delete",
    reason: "tracker day history must be removed for a fresh application baseline",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.tracker_nudge_dismissals",
    disposition: "delete",
    reason: "tracker dismissals are previous app state",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.dismissed_suggestions",
    disposition: "delete",
    reason: "dismissed guidance must not bias the new flow",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_ui_lifecycle_marks",
    disposition: "delete",
    reason: "Personal Plan UI lifecycle markers can resume the former product flow",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.messages",
    disposition: "delete",
    reason: "chat messages belong to the previous application history",
    selectorSql: `conversation_id = ANY(v_owned_conversation_ids)`,
  },
  {
    table: "public.conversation_turn_traces",
    disposition: "delete",
    reason:
      "chat-processing traces can retain prior messages and tool context after the chat thread is removed",
    selectorSql: `user_id = ${userId} OR conversation_id = ANY(v_owned_conversation_ids)`,
  },
  {
    table: "public.conversation_states",
    disposition: "delete",
    reason: "conversation state can replay old pending offers, slots, and routine context",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.conversations",
    disposition: "delete",
    reason: "chat threads are previous app state",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.beta_feedback",
    disposition: "delete",
    reason: "feedback attached to the former application state must not survive the full reset",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.product_submissions",
    disposition: "delete",
    reason: "product intake submissions can carry legacy product/routine associations",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.user_product_usage",
    disposition: "delete",
    reason: "legacy owned-product rows are previous app state",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_routine_source_change_outbox",
    disposition: "delete",
    reason: "queued routine refreshes can write old data after reset",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_routine_proposals",
    disposition: "delete",
    reason: "stage-4 proposal state belongs to the previous plan",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_routine_versions",
    disposition: "delete",
    reason: "stage-4 routine versions belong to the previous plan",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_portfolio_versions",
    disposition: "delete",
    reason: "stage-3 portfolio versions belong to the previous plan",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_product_drafts",
    disposition: "delete",
    reason: "stage-3 drafts belong to the previous plan",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_refinement_drafts",
    disposition: "delete",
    reason: "stage-2 refinement drafts belong to the previous plan",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_need_versions",
    disposition: "delete",
    reason: "stage-1 and stage-2 need versions are immutable old-plan state",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plans",
    disposition: "delete",
    reason: "the unique per-user plan aggregate must be removed before the new Personal Plan flow",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.user_products",
    disposition: "delete",
    reason: "Personal Plan owned-product identities belong to the previous app state",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.personal_plan_prepared_artifacts",
    disposition: "delete",
    reason: "prepared artifacts can reattach old diagnostics and offer state",
    selectorSql: `user_id = ${userId} OR lead_id = ANY(v_owned_lead_ids)`,
  },
  {
    table: "public.funnel_events",
    disposition: "delete",
    reason: "old funnel events can drive non-commercial sync and result recovery joins",
    selectorSql: `funnel_session_id = ANY(v_owned_funnel_session_ids) OR lead_id = ANY(v_owned_lead_ids)`,
  },
  {
    table: "public.funnel_sessions",
    disposition: "delete",
    reason: "old funnel sessions must not retain quiz/result/checkout routing state",
    selectorSql: `id = ANY(v_owned_funnel_session_ids)`,
  },
  {
    table: "public.leads",
    disposition: "delete",
    reason: "old exact-email quiz leads must not rehydrate answers through email fallback",
    selectorSql: `id = ANY(v_owned_lead_ids)`,
  },
  {
    table: "public.hair_profiles",
    disposition: "delete",
    reason:
      "hair profile answers, derived fields, and conversation_memory return to no-profile baseline",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.manual_access_grants",
    disposition: "revoke_exact",
    reason:
      "only the separately approved June complimentary grants are revoked; unrelated access is not inferred",
    selectorSql: `id = ANY(v_manual_grant_ids) AND (user_id = ${userId} OR lower(email) = ${email}) AND revoked_at IS NULL`,
  },
  {
    table: "public.profiles",
    disposition: "reset_profile",
    reason:
      "preserve account identity row while resetting every non-retained app-owned column to the fresh-account baseline",
    selectorSql: `id = ${userId} AND lower(email) = ${email}`,
  },
  {
    table: "public.billing_one_time_purchases",
    disposition: "retain_zero",
    reason:
      "billing evidence is preserved; any matching row is an account/provider reconciliation blocker",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.billing_subscriptions",
    disposition: "retain_zero",
    reason: "subscription billing evidence must be reconciled outside reset tooling",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.billing_subscription_plan_changes",
    disposition: "retain_zero",
    reason: "subscription plan-change audit rows must be reconciled outside reset tooling",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.billing_analytics_outbox",
    disposition: "retain_zero",
    reason:
      "billing analytics events are audit evidence and must never be deleted by reset tooling",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.membership_reactivation_checkout_reservations",
    disposition: "retain_zero",
    reason:
      "membership checkout reservations are billing state and must be reconciled outside reset tooling",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.payment_support_cases",
    disposition: "retain_zero",
    reason: "payment support cases are audit evidence and must never be deleted by reset tooling",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.paypal_checkout_intents",
    disposition: "retain_zero",
    reason:
      "PayPal checkout intents are payment evidence and must be reconciled outside reset tooling",
    selectorSql: `user_id = ${userId} OR lower(email) = ${email}`,
  },
  {
    table: "public.paypal_order_intents",
    disposition: "retain_zero",
    reason:
      "PayPal order intents are payment evidence and must be reconciled outside reset tooling",
    selectorSql: `user_id = ${userId} OR lower(email) = ${email}`,
  },
  {
    table: "public.billing_subscriptions_backup_20260822",
    disposition: "retain_zero",
    reason:
      "historical billing backup rows are immutable audit evidence and must never be deleted by reset tooling",
    selectorSql: `user_id = ${userId}`,
  },
  {
    table: "public.profiles_backup_20260822",
    disposition: "retain_zero",
    reason:
      "historical profile backup rows are immutable audit evidence and must never be deleted by reset tooling",
    selectorSql: `id = ${userId} OR lower(email) = ${email}`,
  },
  {
    table: "public.personal_plan_one_time_checkout_consents",
    disposition: "retain_zero",
    reason: "consent evidence is billing/audit state; any matching row blocks this reset plan",
    selectorSql: `user_id = ${userId} OR lead_id = ANY(v_owned_lead_ids)`,
  },
  {
    table: "public.personal_plan_one_time_fulfillment_jobs",
    disposition: "retain_zero",
    reason:
      "fulfillment jobs are billing/audit delivery state and must be reconciled, not deleted by reset tooling",
    selectorSql: `purchase_id IN (SELECT id FROM public.billing_one_time_purchases WHERE user_id = ${userId})
      OR consent_id IN (
        SELECT id FROM public.personal_plan_one_time_checkout_consents
        WHERE user_id = ${userId} OR lead_id = ANY(v_owned_lead_ids)
      )`,
  },
]

export function resetInventoryTableNames(): string[] {
  return RESET_TABLES.map((entry) => entry.table)
}

export function mutableInventoryTableNames(): string[] {
  return RESET_TABLES.filter((entry) => entry.disposition !== "retain_zero").map(
    (entry) => entry.table,
  )
}

export function requiredExpectedCountTables(): string[] {
  return resetInventoryTableNames()
}
