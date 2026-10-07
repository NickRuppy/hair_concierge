# Mobile contract architecture audit — read-only

Baseline `21e0e41fa996ec6a725c258ab3766971f0edb94d`. No repository edits, runners, providers, or native-device calls.

## Reachability finding

There is no checked-in `apps/mobile` client in this checkout. That is **not** evidence that this is dead code: the repository owns the production native API boundary at `src/app/api/mobile/v1/**`, protected by `src/lib/mobile/auth.ts:310` `mobileRoute`, the proxy’s explicit mobile handling (`src/proxy.ts:47`), and middleware routing (`src/lib/supabase/middleware.ts:451`). Availability is exact-true gated by `src/lib/mobile/pilot.ts:23,47`; the iOS operational contract documents the same `MOBILE_API_ENABLED` / `MOBILE_PILOT_ENABLED` deployment gates in `docs/ios-app-store-subscriptions.md:76-92`.

## Scope and disposition

Inventory has **52 `tests/mobile*` files / 246 declarations**. I complete-read the contract architecture and all declaration inventories, with owner/entry-point trace. **D 0; C 0; F 1; R 245.** No claimed desktop/native overlap is redundant: shared presentation/identity helpers are deliberately parity-tested from the native API boundary, whereas web tests exercise their web consumer.

| Declaration group / count | Owner / live entry point | Disposition |
| --- | --- | --- |
| Access, auth, credentials, route admission, pilot lifecycle/mail, registration/auth/routes/completion/store/credentials/email | `/api/mobile/v1/auth/**`, bootstrap/profile routes, `mobileRoute`, `requireMobileUser`, pilot gate. | **R.** Token rotation, signature/callback state, route protection, enrollment admission and credential privacy are protocol/security cases; no browser/Desktop test exercises the native bearer/callback contract. |
| Profile completion/edit/service/migrations/publication | `/api/mobile/v1/profile` and `/profile/edit`, mobile profile service/RPC/provenance. | **R.** Exact source revision, ABA/CAS, paid-state preservation, owner-only RPC/RLS and lifecycle publication are separate persistence authority checks. |
| History, push installation, APNs client | `/scan/history/**`, `/push/registration`, `src/lib/mobile/history-*`, `push-installations`, APNs client. | **R.** Atomic dedupe/rebind, user ownership, client-grant denial, and token rotation are native-storage/device protocol obligations. PostgreSQL concurrency tests are independent of service mocks. |
| Scan authority/contracts/DM parity/presentation/search identity/submit | `/api/mobile/v1/scan/**`, `src/lib/mobile/scan-service.ts`, `result-presentation.ts`. | **R.** The parity declarations deliberately prove the shared desktop/mobile projection produces a native-safe card while native submission/search routes validate ownership and presentation. A shared helper alone cannot replace endpoint validation or mobile serialization. |
| Research bootstrap/delivery/outbox/worker/result/email/link | `/scan/research-result/[submissionId]`, outbox/worker and iOS deep-link/email bridge. | **R.** Independent channels, lease/reclaim, candidate/device deletion, provider retry and owner-only lookup are operational delivery correctness, not UI copies. |
| Account deletion route | mobile account-delete endpoints and `src/lib/mobile/account-deletion.ts`; same exact operational gate is documented in `docs/ios-app-store-subscriptions.md:80`. | **R.** Destructive lifecycle, preflight/authorization and retry semantics require their own tests. |
| Catalog fixture, onboarding questions, profile completion projection | Native bootstrap payload built from shared vocabulary and catalog fixtures. | **R.** Tests prevent private/personally identifying answers from entering offline metadata and preserve complete native payload values. |
| `mobile-sidebar-close.spec.ts`, `mobile-ux.spec.ts` | Responsive web shell/browser surfaces, not the native API. | **R.** These test mobile viewport focus/close and UX behavior; no native protocol suite replaces browser interaction coverage. |
| `mobile-quiz-hover-styles.test.ts:5` | `src/app/globals.css`, `/quiz` UI. | **F (retain).** It is an implementation-sensitive CSS ordering check, but no existing browser test proves hover styling is absent on touch-only pointers. It should transfer to a narrow pointer-capability browser assertion if that infrastructure is added; do not delete without it. |

## No source closure

Every mobile server library has a live `/api/mobile/v1` entry or migration/documented runtime gate. The missing checked-in client means only that native app code is hosted elsewhere; it does not unlock source deletion or justify pruning protocol tests. The full root Node suite picks these files through `package.json:test:node`; native focused verification uses `node --import ./tests/server-only-register.cjs --import tsx --test <exact mobile files>`. No test was run.
