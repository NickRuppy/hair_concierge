# Mobile research delivery: one conditional consolidation

Repository: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`; HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d`, dirty campaign tree pinned in the manifest. This read-only slice follows the user-authorized pruning objective; it does not change product policy or claim the global target is complete. Main owns execution and integration. No repository file, source fault, native runner, provider, external system, environment secret or DB was touched.

## Chosen direction

**34 current AST sites, R32/F1/C1/D0.** Propose one whole declaration removal only, after transferring two assertions and their local settlement lookup to the existing fifth-attempt callback. No files or source seams retire. Expected phases **34 → 34 → 33 AST**; the HTTP table remains one declaration/four runtime registrations, so expected registrations are37→37→36, including the PostgreSQL opt-in declaration which ordinarily skips. These are static counts, not runner results.

C1 donor `tests/mobile-research-delivery-worker.test.ts:245` “an APNs credential fault is tagged for the outbox refund and retried slowly” becomes redundant after its exact settlement assertions reach the existing keeper at260 “a fifth APNs credential fault reports the refunded retry rather than a terminal failure”. Both full bodies are in candidates.json. No new fixture, dependency invocation, provider call, table row or assertion-generated expected value is introduced. Keeper continues using its existing one `reconcileMobileResearchDeliveries` invocation.

| Donor observation | Existing/new keeper observation |
| --- | --- |
| result.retry =1 | Already exact1 |
| first finish_mobile_research_delivery p_error_code =push_provider_credentials | Exact lookup and literal copied, before existing fake-state assertion |
| Date.parse(p_next_attempt_at) − fixed deps.now() =3600*1000 | Exact expression/literal copied |
| One push row; ready result; current token; InvalidProviderToken; explicit retry3600 | Same existing keeper inputs; send_attempts4 instead of0 |

This is operative equivalence, not a claim that all attempt counts are interchangeable. In `research-delivery-worker.ts:132–154`, explicit `result.retrySeconds` short-circuits the exponential fallback containing `row.send_attempts`; the exact credential error short-circuits the terminal-threshold conjunction. The APNs mapping at280–287 is identical for both rows and does not read attempts. The fifth-attempt fixture additionally tests the real worker’s exceptional statistics branch. Removing that exception is a meaningful regression caught by the keeper and not by the donor. Existing false/terminal/queued assertions remain untouched.

## Actual ownership and independent proof

- `vercel.json:6` schedules the actual reconcile route every five minutes. Its GET (`src/app/api/mobile/v1/research-delivery/reconcile/route.ts:35`) reads configured capability and supplies the real client factory; handler invokes actual worker by default at25. Feature gating is not retirement evidence.
- Worker `defaultDependencies` at58–85 wires real `resolveMobileResearchResult`, configured message-ID email building/sending, and APNs client/allowlist. The candidate tests override preparation and resolver, so they protect orchestration/settlement, not default environment/SDK delivery.
- `research-email.ts:54` is **live**, called by worker68. It is not a test-only wrapper. The shared transactional sender builds actual provider request/receipt/error classification. No export closure is unlocked.
- `scan-submit-service.ts:52–57,81,141` durably requests research delivery for owner-bound confirmed submissions. Intent SQL triggers enqueue only marked eligible approved/matched rows; outbox SQL materializes email/current devices, leases work, transitions sending before delivery, and retains ambiguous results.
- SQL keeper `mobile-research-delivery-outbox.test.ts:166` independently executes all original migrations: seven credential retries preserve pending/attempts0 and ordinary retries exhaust on fifth. **The worker fake does not prove SQL refund, atomic claim or persistence.** This real SQL keeper stays intact.
- `mobile-apns-client.test.ts:77` independently covers HTTP403 InvalidProviderToken and ExpiredProviderToken → retryable3600. Exact provider message/body/signing tests at26 and56 remain. No new cuts outside the nine-file cohort.
- Result service is live at authenticated scanner-access/rate-limited `scan/research-result/[submissionId]/route.ts:7–19` and at worker eligibility checks. It reloads owner-scoped submission, current shared profile, and current native scanner outcome. Service tests inject its loaders and cannot establish its default `.eq(user_id)` query. No such proof is claimed or removed.
- Bridge page emits both current pilot/release scheme links; `ios/Chaarlie/App/ResearchDelivery.swift:6–34` validates opaque HTTPS/scheme IDs, `AppModel.swift:350–395` guards admission/current generation, and `MobileClient.swift:258–262` resolves and validates current server assessment/not_needed. No anonymous-404, unpublished-flag or missing-client inference is used.

## Rejected larger cuts

Worker/SQL duplicates are superficial: fixtures implement claim exclusivity and fake finish state, while tests still independently observe actual worker provider invocations, classifications, stats and RPC arguments. SQL alone cannot catch worker ignoring a lost lease, passing wrong owner/binding, leaking provider details, or reporting a terminal attempt as retry. Conversely fake state cannot catch absent CAS, wrong privileges, stale binding invalidation, lost receipt constraints or missing cascades. Keep both boundaries with these limits.

The missing-installation and rebound-during-resolution inputs hit first and second lookups respectively; neither covers both guards. All-not-ready and ready-candidate-then-not-ready-channel hit distinct eligibility stages. Foreign intent, before/after ordering and account cascade partially overlap but do not have an existing keeper with their whole input/assertion union. The trusted-origin URL callback includes malformed/insecure/foreign inputs absent from the email positive. The generic email template/HTTP transport cannot replace the mobile-specific neutral-link/privacy/copy bytes. No new calls are authorized to manufacture a union.

The real PostgreSQL callback at33 covers two sessions and concurrent intent/approval, unlike the serial PGlite suite. Its `MOBILE_RESEARCH_POSTGRES_TEST=1` opt-in is not enabled by current CI; ordinary native green therefore does not prove concurrency. The canonical historical plan expressly preserves automatic push/email delivery as scope; no obsolete subsystem closure is supported.

## Held F1 (zero quota, not included in snapshots)

Worker111 claims no resolve call while disabled but observes only the RPC call list and executed send counters. The fixture resolver returns ready without an observer. Retain the callback; a future bounded repair can wrap its existing resolver with a monotonic counter and assert zero, or narrow the claim. No actual old-green/new-red fault proof was run and this proposal does not claim that F is repaired. Also bound the missing-device title: it alone tests initial absence; the separate rebound callback carries the later-race proof.

## History, CI and checks for main

`git log` shows source/tests introduced in current reachable commit `81e32e8b` (search/history/delivery #586), not the old unmerged hash quoted in a prior ledger. The historical `plans/ios-search-history/plan.md` completion note explicitly describes repairing fifth-attempt APNs credential observability. The later `66b03bcc` paywall commit changes bootstrap/access admission; it does not retire delivery. Historical recorded deployment/flag status is not a current live-state assertion.

`package.json:49` includes all nine top-level `.test.ts` files; `.github/workflows/ci.yml:147–158` executes that native lane. No CI selection change is needed. Main can run the same native command before, transferred and after with the nine explicit files from manifest:

```
node --import ./tests/server-only-register.cjs --import tsx --test tests/mobile-research-bootstrap.test.ts tests/mobile-research-delivery-route.test.ts tests/mobile-research-delivery-worker.test.ts tests/mobile-research-delivery-outbox.test.ts tests/mobile-research-delivery-migration.test.ts tests/mobile-research-delivery-postgres.test.ts tests/mobile-research-link-page.test.ts tests/mobile-research-email.test.ts tests/mobile-research-result-service.test.ts
```

Do not automatically enable Docker/PostgreSQL or send providers for this proposal. Three exact source-fault recipes in controls.json select the existing keeper and require a clean before, intended assertion red, byte-exact source restore and clean after: corrupt delivered refund tag while retaining internal stats; shorten actual scheduled delay; count fifth credential retry as terminal. All three prospective TS mutations parse statically. **None was executed.** No claim is made about other provider status branches from these controls.

## Immutable proposal receipt and read limits

Artifacts share `/tmp/test-audit-mobile-delivery-`: ledger.md; judgments.json/full bodies; candidates.json; complete.diff; manifest.json; snapshots/{before,transfer,cut}; controls.json; static-receipt.json. Only worker test differs. All27 prospective file versions parse, all28 pinned source/dependency/config readsets match, 31 untargeted top-level callback texts and the nested HTTP table/support are byte-identical. Counts34/34/33 verified by TypeScript AST navigation only. No compile/typecheck/native execution occurred. No main-only writer was emitted; main can adopt the exact guarded snapshots only after its own review and proof.

Full reads: all nine test files/fixtures/parameter rows; complete worker/result/email owners, all three actual SQL migrations, cron/bridge/bootstrap/result routes, APNs client, Customer.io transactional sender, push installation service, contracts, scan-submit, profile-service, scan-service, mobile access and Swift ResearchDelivery owner. Scoped reads: auth wrapper/response and bearer comparison, native AppModel/MobileClient call paths, current CI/package/cron, historical plan and commit metadata, APNs overlapping callback bodies at26/56/77/125/140 and Customer.io callbacks81/101/117. PGlite installed type definitions for query/exec establish these issue SQL; no database engine source audit, provider behavior re-verification, Swift test-suite full audit, whole scanner/recommendation-domain audit or recursive review of all profile/scanner transitive libraries is claimed. Those untouched domains are not deletion justification.
