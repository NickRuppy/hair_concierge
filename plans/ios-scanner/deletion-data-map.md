# Shared-account deletion: data disposition draft

Planning evidence, 2026-09-10. E2 remains open for the financial-evidence field set and approved identity-disconnection rules. This document describes current schema constraints, not new legal retention requirements. No customer records, billing operations or schema writes were performed.

| Data | Proposed disposition / verified blocker | Source |
|---|---|---|
| Account profile/contact, hair answers, conversations/messages, memory, usage, wishlist, private submissions, derived plans/routines | Delete personal application data. Existing profile/auth cascades cover many rows; verify all private children, queued jobs and external objects explicitly. Published catalog facts may survive only without personal submission data. | `supabase/migrations/00001_initial_schema.sql:33-65,101-124`; `20260408130000_add_user_memory.sql:10-45`; `20260408090000_onboarding_v2.sql:38-52`; `20260612130000_product_intake_submissions.sql:195`; `20260808062602_personal_plan_stage1_3_foundation.sql:4-124`; `20260808062603_personal_plan_routine_backend.sql:4-55` |
| One-time purchase, immediate-performance consent, fulfilment evidence | Retain only the approved evidence subset, disconnect direct account/lead linkage where permitted. Today purchase.user_id and consent.user_id RESTRICT deletion; consent also forbids changing accepted identity/evidence fields. Requires deliberate retention migration/RPC, not arbitrary nulling or deleting evidence. | `20260731120000_billing_one_time_purchases.sql:1-21`; `20260731121000_personal_plan_one_time_checkout_consents.sql:1-45,72-92,124-125`; `20260731125000_one_time_payment_recovery_state.sql:43-73,278-316` |
| Subscription billing rows | Cancel/reconcile future renewals first. Current rows cascade on profile deletion, so preserve any required evidence in a reviewed retention representation before removal. The published invoice duration alone does not identify which subscription columns must survive. | `20260527_add_billing_subscriptions.sql:1-18`; `src/app/datenschutz/page.tsx:260-267` |
| Payment support | Policy: resolved cases 90 days, open cases until clarified. Current user/lead FKs have no deletion action and block identity deletion. **Confirmed by Nick on 2026-09-11:** an open case does not delay deletion of hair/profile/list data; retain only necessary case information and limited contact for resolution. Marketing and scan notifications stop; necessary case/deletion emails may continue. Store this independently of the deleted app account. Existing exactly-one user/lead constraint and identity-based email lookup must change together; an FK-only nulling change would fail validation. | `20260810082837_payment_support_cases.sql:2-60`; `scripts/billing/payment-support-cases.ts:11-14,596-605`; `src/app/datenschutz/page.tsx:264-267` |
| Partner invitations, field-test links, leads and funnels | Preflight conditional links. Claimed partner user and related source records have RESTRICT dependencies. Select retention/disconnection or settlement rule for these sources; never delete a source solely to bypass immutable evidence constraints. | `20260901120000_partner_access.sql:1-94`; `20260731121000_personal_plan_one_time_checkout_consents.sql:3-5`; `20260731122000_paypal_one_time_order_intents.sql:4-7` |
| Customer.io identity, storage, future APNs registrations/outbox | Explicit integration inventory and verified cleanup/suppression. Account switching/logout removes device association; deletion stops all marketing/scan sends; the approved exception allows only necessary outstanding-case and deletion-completion communications through a restricted retained contact. Financial provider evidence and private app identity are separate inventories. | Owning implementations in `src/lib/customerio/`, proposed T5/T6; no existing general deletion orchestrator |

## Required sequence

1. Verify user intent and journal the operation, required provider references and phase state without retaining unnecessary hair/profile contents.
2. Cancel every future web renewal and reconcile uncertain provider responses while the billing association is intact.
3. Preflight RESTRICT/no-action dependencies and apply the reviewed retention transformation. Failure is recoverable; never label it completed.
4. Remove private app data and external account/device associations, with retries and evidence for each integration. An open support case alone never delays this data phase. Suppress delayed marketing/scan jobs immediately when deletion is requested; allow only explicitly purpose-bound outstanding-case/deletion communications using the minimal retained contact.
5. Revoke sessions, delete auth identity after dependent records are safely handled, and verify deletion plus required retained records' allowed identifiers.

## What remains to resolve

- Exact invoice/payment/consent/fulfilment fields and durations under the existing policy, including whether provider identifiers or a narrowly scoped evidence identity are necessary. No blanket 10-year retention for all billing/support data.
- Permitted transformation for immutable evidence and linked leads/partner invitations; an audit trail for this transformation must not recreate the erased personal profile.
- Support-case product behavior is confirmed: minimal case/contact retention without keeping the app account or private hair data alive; only necessary case/deletion emails continue. Specify the exact minimal field/contact representation and expiry using the existing support policy, and verify its isolated delivery path. Unresolved provider renewal cancellation is a separate technical pending state.
- External systems' deletion/suppression and backups must be accounted for before claiming complete erasure.

The cascade set and technical blockers are verified. These remaining evidence-retention choices cannot be settled merely by following the current FK behavior. E2 must be reconciled before the deletion schema is treated as implementation-ready.


## Public-policy reconciliation — 2026-09-11

The [live footer audit](footer-pages-audit.md) confirms the published durations but does not establish a universal ten-year invoice duty for Haarmony LLC. Determine applicable record classes/regimes before implementing expiry; the draft public copy is not a substitute for that evidence. Minimal support contact, app-data erasure and purpose-bound case/deletion email behavior are confirmed. The retention field map and external-system/backups disposition remain unresolved.
