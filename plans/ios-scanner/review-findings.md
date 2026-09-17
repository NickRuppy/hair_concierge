# iOS implementation planning audit — 2026-09-10

Status: **not locked / no implementation authorization**. Owning scope, contracts and tasks: [implementation-plan.md](implementation-plan.md), revision 4. Independent review completed; the orchestrator verified and reconciled its findings below. Product decisions, retention disposition and final journey remain pending; this is not a readiness approval.

## Findings reconciled into the draft

| Finding | Evidence | Plan treatment |
|---|---|---|
| Free scanner admission needs a derived context, not just quiz answers. Existing context prefers paid snapshots; basic profile edits do not refresh them. | `src/lib/scan/profile-context.ts`, `src/app/api/profile/route.ts`, `src/lib/personal-plan/persistence/stage1-service.ts` | T2 scanner-owned context with atomic profile publication, shared web/iOS reads; no paid plan/routine mutations. Detailed-user rebase remains D2. |
| Generic unknown verdict conflates missing product evidence with missing/paused user targets. Research can return the same unusable catalog product. | `src/lib/scan/resolve-verdict.ts`, `tests/scan-resolve-verdict.test.ts`, `src/lib/product-intake/submissions.ts` | T3 discriminated outcomes and consistent research admission. D3 simple fallback approved, without follow-up questions; existing not-needed/deferred outcomes remain separate. |
| Current destination-move operation can remove routine entries. | `supabase/migrations/20260904150000_scan_move_saved_product.sql` | T4 native wishlist-only idempotent mutations on shared list rows. Existing web move behavior preserved. |
| Current alternatives omit comparison rows and are capped at three. Web ranks coverage/cautions/authority preference/catalog order before its price tiebreak. | `src/lib/scan/types.ts:42-60`, `src/lib/personal-plan/products/fit-comparison.ts:47,337-366`, `src/lib/personal-plan/products/candidate-ranking.ts:23-44` | T3 native DTO with existing evaluated evidence, approved verdict→price/max5 selection before truncation; unchanged web policy. |
| Submission notifications currently deliver web chat, not independent email/APNs. | `src/lib/product-intake/notifications.ts`, `scripts/product-intake/review-actions.ts` | T5 per-channel durable outbox at public-result readiness, account/device revocation and ambiguous-send recovery. |
| Deletion must reconcile provider renewals and financial-evidence foreign keys before identity removal. | Existing billing migrations, `src/app/datenschutz/page.tsx:260-267` | T6 durable cancellation/deletion journal; E2 exact retention/scrub mapping required before schema implementation. No invented retention periods. |
| Organic quiz still creates the old result artifact and identifies quiz-completion attributes that feed live campaigns 9/10. | `src/funnels/packages.json`, `src/lib/customerio/quiz-sync.ts`, `src/components/quiz/quiz-preparation.tsx`; [live provider check](customerio-live-check.md) | T7 source-scoped acquisition integration and consent mapping. Provider read completed; Nick confirmed shared marketing enrollment for scanner sign-ups, with consent and existing journeys preserved. No scanner-specific exclusion; redesign deferred. |

## Verification actually performed

- Read-only auth/profile, scanner and notification/deletion source audits; results incorporated into T1–T7 and D1–D3/E1–E2.
- Local native HTML adaptation inspected in the browser; direct save → Gemerkt → removal exercised. This uses mocked products and no live camera or persistence.
- Approved result layout retained; final copy is authoritative over historical screenshots; native saving has no Routine destination.
- Screenshots are retained under `evidence/scan-ergebnis/frames/` with a local ignore exception so they can accompany the planning PR.
- No application implementation tests, production configuration changes, sends, billing operations or account deletion performed during this planning pass.

## Independent review and verified disposition

The first invocation failed authentication. Authentication was restored in the separate task; the repository wrapper then completed at `high` effort with a grounding appendix that referenced two omitted blockers. A bounded read-only follow-up in the same Claude lane recovered those two blocker descriptions. Both reports were inspected and their relevant source claims checked locally. The follow-up did not invoke another reviewer. Raw reports remain outside the repository at `/tmp/ios-scanner-plan-review-authenticated.md` and `/tmp/ios-scanner-plan-review-blockers.md`; durable findings are retained here.

| Reviewer finding | Orchestrator disposition |
|---|---|
| Free users lack a paid need-version; free scanner cannot simply call the existing web resolver. | **Confirmed current dependency; already owned by T2/T3.** Revision 3 makes the native bearer facade, independent completed-profile gate and scanner-only store explicit. Never grant billing/plan entitlement or call the paid Stage-1 persistence service. |
| Changing the shared context loader would itself make web scanner access free. | **Rejected as stated.** `src/lib/supabase/middleware.ts:28-43,350-484` separately gates `/scan`, `/api/scan`, `/profile`, `/api/profile` and returns subscription-required/redirect for unentitled users. Shared data does not bypass that gate. Added explicit preservation and negative tests for web paid access. Native is free under the existing approved scope. |
| Free/paid context precedence needs specification. | **Accepted.** D2 was subsequently confirmed by Nick; contract 3 now specifies current compatible refined→initial→derived initial source selection, explicit-edit revision authority, and compatibility checks before later paid publications can supersede it. No stale paid source silently overwrites current shared answers. |
| Alternatives need rows and native max5 without modifying the web constant. | **Accepted technical clarification.** Existing comparison evidence must be exposed before the slim mapper; choose from the full eligible pool using native policy/limit before truncating. Keep shared default limit3 and web comparator. |
| Native verdict→price differs from web coverage/caution/catalog/price order and needs an owner choice. | **Resolved from existing reviewed design plus iOS-only scope**, not reviewer preference. `design-spec.md` explicitly specifies green before yellow, then ascending price, max5. Revision 3 records that native presentation difference while preserving each candidate's authority evaluation and all web ranking defaults. Carry it into the final walkthrough; no global ranking change is authorized. |
| Auth described as link-only; profile writes described as basics-only; several source anchors imprecise. | **Corrected.** Web supports password/reset/OTP-based magic link; the current login email displays only the link. Local hook already passes code. PUT `/api/profile` writes full validated hair-profile fields, without refreshing derived need snapshots. Ranking, cap, OTP settings and callback error anchors corrected. |

The original review verdict was “do not ship to subagents yet.” The corrections above reconcile its technical findings, but do not convert pending E2 or final evidence/journey sign-off into approval.

## Remaining handoff gates

1. D1: **confirmed** — iOS 18+ minimum.
2. D2: **confirmed** — preserve applicable detailed answers, refresh shared scanner assessments after profile edits, and leave routines unchanged; implementation recomputes stale assumed defaults with provenance.
3. D3: **confirmed** — short unavailable-assessment reason and continued scanning; no follow-up questions for v1. Final integrated evidence review remains pending; keep known not-needed outcomes distinct.
4. E1: **confirmed** — scanner sign-ups join the existing shared email flow under current consent/eligibility rules. Existing campaign state remains intact; broader email/retargeting redesign deferred. Verify actual consent/subscription mapping during implementation.
5. E2: **support behavior confirmed on 2026-09-11** — delete app personal data without waiting for an open case, retain minimal case/contact and allow necessary case/deletion emails only. Financial/consent/partner field disposition in [deletion-data-map.md](deletion-data-map.md) still needs reconciliation before deletion schema implementation.
6. Final integrated native evidence and full journey explicitly confirmed by Nick; decision coverage then updated to confirmed with no undiscussed consequential assumptions affecting the handoff. Counterpart review and local finding disposition have completed; substantive later plan changes may require focused re-review.


## Footer evidence follow-up — 2026-09-11

[Live audit L1–L8](footer-pages-audit.md) reconciles current public pages with the planned native behavior. The cached May AGB snapshot was rejected in favor of a fresh August production response. Existing policy durations are evidence, not proof of legal applicability or active erasure jobs. E2 is still open. Optional marketing consent is verified in source; advertised DOI enforcement is not yet verified end to end. T7 now owns reviewed privacy/AGB integration; German copy and layout evidence are drafted, with unresolved facts visibly marked. No public wording or provider behavior changed.


## Scoped deferral — 2026-09-11

Nick explicitly parked the [co-founder questions](cofounder-questions.md). Revision 6 replaces the previous global E2 kickoff block with a scoped dependency: continue independent planning and separately confirmed implementation slices, excluding unresolved retention/consent/procurement/legal behavior. Full release still requires resolution and complete journey sign-off. This is a scope partition, not a reviewer approval or acceptance of proposed retention periods.
