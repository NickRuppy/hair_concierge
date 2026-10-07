# Exact read depth and boundaries

All seven owned test files were read completely, including every helper, fake, fixture literal, comment, conditional assertion and loop row. Counts verified with TypeScript AST: 67 sites; acceptance's one templated declaration iterates `corrupt_need_hash` and `stale_publication`, yielding 68 native registrations. Nested helper assertions in `createScannerContextRpc` are read and frozen, not separate registrations.

Complete freshly read production/support files:

- `src/app/registrierung/free-registration-client.tsx` (583 lines), registration page (40), scan page (84), Button (62), Input (24).
- `src/lib/auth/free-registration-recovery.ts` (190), free-registration.ts (414), route-classification.ts (220).
- `src/lib/personal-plan/persistence/free-snapshot-service.ts` (209), free-snapshot-supabase.ts (128), stage1-service.ts (221), index.ts (97); compute-stage1.ts (117).
- `src/lib/freemium/plan-provisioning.ts` (227), plan-provisioning-supabase.ts (324), checkout-return.ts (52), checkout-metadata.ts (29).
- `src/lib/premium-sheet/pricing.ts` (80), stripe/pricing-plans.ts (121), stripe/client.ts (100), stripe/checkout-session-params.ts (135), billing/pricing-catalog.ts (18).
- `src/lib/personal-plan/navigation-access.ts` (365), entitlements/access.ts (176), entitlements/entitlements.ts (59), index.ts and flag.ts (1/9).
- `src/lib/scan/profile-context.ts` (43), scanner-context-supabase.ts (74), scanner-context.ts (571; re-read omitted middle after tool truncation).
- `tests/helpers/scanner-context-rpc.ts` (72), tests/personal-plan/fixtures.ts (27), Stage1/2 lab fixture (27).
- `src/app/api/freemium/purchase/complete/route.ts` (501), `src/lib/paypal/freemium-webhook-provisioning.ts` (236).
- `scripts/ci/run-personal-plan-nested.mjs` (39), `tests/server-only-register.cjs` (10).

Bounded portions of shared owners/callers, explicitly not fresh full-file semantic credit:

- Stripe create-checkout route: complete schema/imports 1–342; complete C1 owner `resolveCheckoutPricingCatalog` and idempotency resolver 449–511; POST entry/retired-one-time/flag/auth 548–660; actual pricing invocation and provider/funnel context 935–1078. File has 2295 lines; unrelated prepared/claim/reactivation/payment-recovery implementations were not reread in full. C1 reads only the complete pure selector; no HTTP/provider equivalence claim uses those unread branches.
- Supabase middleware: 1–248 complete route sets and tested predicates, 535–733 subscription/composite/admission caller branch, 867–915 intake caller. Other auth/partner/discovery/frontier branches stay outside this fresh semantic lane. No middleware declaration is cut.
- Auth confirm: free-context, evidence, binding and provisioning branch 236–390, plus imports/default wiring and symbol navigation. Shared recovery/legacy behavior is retained; no whole-confirm review claimed.
- Stripe webhook: complete dynamic default service factory 341–363 and symbol navigation of provisioning guards/callers. PayPal counterpart read in full. No webhook tests or code cut, no claim about full provider handler semantics.
- Quiz client: complete `resolveQuizCompletionNavigation` 160–190 including storage handoff and real destination call. Full multi-thousand-line component not reread.
- CI: complete quality-node job 148–165 and package test script entries 49–51/73; package/lock and workflow pinned in full. No runner invoked.
- Installed dependencies: React server declaration 114–122; legacy SSR dispatcher 9700–9725 and entry 9855–9870 (`useEffect: noop`); PostgrestBuilder PromiseLike declaration 70–82 and then navigation; Stripe SessionCreateParams redirect/return fields 2263–2272 and redirect enum 2834. These establish shape/SSR scope, not browser events, real SQL or Stripe network behavior.

`local-import-closure.json` independently walks all seven tests plus preload: 231 local modules, 663 edges, 19 external specifiers, zero nonliteral dynamic imports and zero unresolved relative/@ imports. All are frozen under closure-snapshots. This is static parsing and byte pinning, not semantic full-read credit for 231 files. The manifest union has 247 readset pins (including tests, explicit production caller reads, CI/config and dependency source). Runtime installed-package completeness belongs to main's guarded operator preparation.

Prior evidence checked: accounting617 navigation (not semantic credit), durable supported-reachability-challenge Component B (only direct-import inventory for provisioning14), test-owned-scanner-rules (prior retired trigger step removed from retained cutover3), and bounded `/tmp/*ledger*.md`/`*layer-plan*.md` filename search. No complete seven-file semantic ledger recovered. This does not prove nobody read any file previously. Historical memory only informed the caution that flag-off compatibility is not retirement; all current judgments use frozen repository bytes.

No environment files/values, product imports, native/browser execution, SQL/DB/provider/network requests, child test processes or repository/config/Git mutations occurred. Static scripts import TypeScript and Node built-ins only; one built-in AssertionError formats the two proposed diagnostic messages. No parser/typecheck/build/native PASS is inferred beyond reported AST parsing. Parent owns all eventual runtime proofs and coverage accounting.
