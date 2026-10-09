# Mobile research delivery complete second-layer ledger

34 AST sites across nine complete test files; **R32 / F1 / C1 / D0**. One four-row HTTP table is one AST site. Expected37 runtime registrations incl. one opt-in PostgreSQL skip, unexecuted. Candidate removes one whole callback only:34→34→33 (runtime37→37→36).

The prior mobile value/surface ledgers supplied navigation; their generic R labels and old missing-native-client statement were not treated as current proof. The current checked-in iOS owner was read. This is a bounded delivery-lane second pass, not a full mobile/platform audit.

- **R** `tests/mobile-research-bootstrap.test.ts:7` — delivery capability is optional for older servers and disabled by default
  bootstrapSchema ready input omits capability versus explicit true: false default and true preservation. Cron disabled output has no bootstrap contract, Swift decodes a different implementation; changing Zod default to true escapes both.
- **R** `tests/mobile-research-delivery-route.test.ts:5` — delivery cron requires its secret even when disabled, without opening a client
  Absent Authorization with missing/configured secret must return401 without client construction even disabled. Moving disabled check before auth returns200; authenticated-disabled sibling cannot catch it.
- **R** `tests/mobile-research-delivery-route.test.ts:21` — authenticated disabled cron performs no database or provider work
  Valid bearer plus disabled returns exact200/disabled and never constructs client. Worker disabled test starts after route dependency setup and cannot protect this guard.
- **R** `tests/mobile-research-delivery-route.test.ts:35` — cron storage failure returns a generic retryable response
  Authorized enabled client construction throws private detail: exact503/generic body. Other route cases never enter construction or catch; worker catches storage errors inside a different owner.
- **F** `tests/mobile-research-delivery-worker.test.ts:111` — disabled delivery does not claim, resolve, or contact providers
  F1 retain: disabled=true, empty RPC calls and zero executed sends are real assertions; resolve dependency has no observer, so title claims more than oracle. Add monotonic wrapper counter in same callback as later maintenance or narrow title. No current false-pass execution receipt, no quota.
- **R** `tests/mobile-research-delivery-worker.test.ts:120` — candidate and each channel require a fresh usable assessment
  Candidate plus both channels all not_ready: three actual resolve calls, no materialization/send/begin, candidate retry. The next callback first returns ready and cannot catch omission of candidate resolution or incorrect retry action.
- **R** `tests/mobile-research-delivery-worker.test.ts:142` — candidate materialization does not bypass the second eligibility check
  Initial candidate ready then both channel resolutions not_ready: materialized1 and no sends. All-not_ready keeper never materializes, so reuse of initial eligibility or skipping second checks escapes it.
- **R** `tests/mobile-research-delivery-worker.test.ts:152` — concurrent workers send each independently leased channel only once
  Two overlapping worker calls share fake atomic leases; actual worker must invoke each provider once, queued totals2, per-channel queued and provider receipt. It does not prove SQL concurrency; returning fake states alone cannot satisfy sends/statistics. No other worker case has both successful channels and parallel invocations.
- **R** `tests/mobile-research-delivery-worker.test.ts:173` — ambiguous email remains held on later runs while push can finish
  Email ambiguous exception plus independent successful push, two runs: one actual email attempt, unknown statistics/state, push queued, private detail absent. HTTP408 has different exception classification and no second run or live sibling-channel proof.
- **R** `tests/mobile-research-delivery-worker.test.ts:189` — missing or rebound device suppresses push but email is still delivered
  Initial missing installation: email1/push0 and push suppressed. Rebound test obtains initial installation, later loses it and has no email row; these are different current guards. Title rebound wording is broader than this fixture alone.
- **R** `tests/mobile-research-delivery-worker.test.ts:196` — device rebound during assessment resolution prevents the old owner's push
  Installation lookup succeeds then second lookup null during current resolve: push0 and suppressed. Initial-missing callback never reaches second lookup; removing post-assessment recheck escapes it.
- **R** `tests/mobile-research-delivery-worker.test.ts:210` — unconfirmed email suppresses only email
  Unconfirmed auth user suppresses only email while push sends1; missing installation inverts channel guard and cannot catch email-confirmation omission.
- **R** `tests/mobile-research-delivery-worker.test.ts:223` — `email HTTP ${status} settles ${expected}`
  Four existing HTTP rows400terminal/408unknown/429retry/503unknown plus private error-body exclusion exercise actual classifier. Distinct status branches; retaining all rows and one AST declaration. Generic ambiguity does not cover status classification.
- **R** `tests/mobile-research-delivery-worker.test.ts:234` — lost prepare lease never contacts the provider
  Both begin-send RPCs return false after preparation: no executed provider calls. SQL test checks its own CAS result but cannot detect worker ignoring false and sending anyway.
- **C** `tests/mobile-research-delivery-worker.test.ts:245` — an APNs credential fault is tagged for the outbox refund and retried slowly
  C1 transfer exact p_error_code and next-attempt delay into existing fifth-credential callback; result.retry1 already present. send_attempts0 versus4 is outside operative readset for credential settlement with explicit delay, except keeper additionally protects terminal-count exception.
- **R** `tests/mobile-research-delivery-worker.test.ts:260` — a fifth APNs credential fault reports the refunded retry rather than a terminal failure
  C1 keeper: fifth credential retry retains retry1/terminal0/fake state retry and receives donor RPC error tag and3600s delay. Actual stats must respect refund exception; fake state is not independent SQL refund proof. Real outbox retry test remains.
- **R** `tests/mobile-research-delivery-worker.test.ts:274` — fifth definitive refusal reports the terminal state persisted by the outbox
  Fifth email429 refusal: actual worker terminal1/retry0 and fake state terminal. Credential keeper deliberately excludes this threshold; SQL cap alone cannot catch worker reporting wrong stats after successful RPC.
- **R** `tests/mobile-research-delivery-worker.test.ts:285` — lost accepted receipt settlement leaves sending held and never resends
  Accepted email receipt then settlement DB error across two runs: errors1, held sending, one send. Actual JS must not resubmit during persistence catch; fake state supplies subsequent claim exclusion, so SQL no-reclaim proof stays separately retained.
- **R** `tests/mobile-research-delivery-worker.test.ts:299` — APNs ambiguity is held; invalid token revocation uses the sent owner-bound token
  Push unknown receipt versus invalid_token: unknownstate and exact owner/install/token/binding-version revoke args with terminalstate. Provider classifier cannot catch worker dropping bindingVersion or invalidating a different owner; SQL test cannot catch wrong arguments delivered by worker.
- **R** `tests/mobile-research-delivery-outbox.test.ts:62` — one candidate atomically produces independent email and current-device push
  Real migration materialization success then repeated same lease false, exact email/null and push/current installation rows, authenticated SELECT denied. Worker fake materialize returns true and never executes SQL; not redundant.
- **R** `tests/mobile-research-delivery-outbox.test.ts:104` — unknown result is held; pre-send expired processing can be reclaimed
  Real outbox transition proof: fresh claim exclusion, queued-before-begin rejection, expired pre-send push lease replacement, stale begin false, current email begin true, unknown remains unclaimable/stored. Worker fake bypasses expiry and legal-transition logic.
- **R** `tests/mobile-research-delivery-outbox.test.ts:166` — provider-credential retries never exhaust a device's only push; device refusals still do
  Actual SQL seven credential retries keep pending/attempts0; four normal retry attempts accumulate then fifth terminal. Worker fixture manually implements a cap and never stores/refunds counts; preserve database invariant here.
- **R** `tests/mobile-research-delivery-outbox.test.ts:212` — account deletion removes candidate, device and channel receipts
  Actual profile deletion cascades candidate/device/channel rows to0 after materialization. Intent migration callback checks candidate only and never creates device/outbox; cannot catch missing channel/device cascades.
- **R** `tests/mobile-research-delivery-outbox.test.ts:235` — push lookup is service-only and invalidation preserves a rotated token
  Service-only lookup/invalidate plus rotated token, same-token refreshed binding version, stale invalidations false and current invalidation true/null. Worker exact-RPC test cannot catch SQL predicate omissions or grants.
- **R** `tests/mobile-research-delivery-migration.test.ts:39` — mobile intent enqueues once in either status/intent ordering, not old web scans
  Actual SQL both intent-before-approval and approval-before-intent plus repeats produce exact two candidates; historical webOnly remains unmarked. Outbox fixture starts already approved, Postgres only overlapping ordering and no web-only negative.
- **R** `tests/mobile-research-delivery-migration.test.ts:79` — intent is owner-checked and candidate survives unrelated history deletion
  Foreign owner intent false; marked candidate survives deletion of a synthetic unrelated history table then actual profile cascade removes it. Does not exercise production clear-history RPC. Outbox cascade overlaps only last assertion; full union includes owner isolation not there.
- **R** `tests/mobile-research-delivery-migration.test.ts:119` — service-only claim is lease guarded and client roles cannot write intent
  Authenticated intent/RLS denied; service claim yields owner submission once, wrong finish lease false, valid finish true. Postgres counts two concurrent claims but does not cover permissions or stale finish.
- **R** `tests/mobile-research-delivery-postgres.test.ts:33` — real PostgreSQL concurrent mobile intent and approval enqueue exactly once
  Opt-in real PostgreSQL concurrent intent/approval and two-session candidate claim produce exactlyone candidate and sorted[0,1]. PGlite serial callbacks and fake JS leases cannot prove this concurrency. It is skipped without explicit flag in ordinary native CI.
- **R** `tests/mobile-research-link-page.test.ts:16` — research email landing page opens both current pilot and public iPhone apps
  Actual async link-page element tree returns exact ordered pilot/public scheme URLs and both Info.plist strings. Email only delivers HTTPS bridge; native parser cannot prove web page emits both links. No browser, OS launch or nested component rendering claimed.
- **R** `tests/mobile-research-email.test.ts:8` — research email links to the neutral iPhone-first page, not web scanner results
  Actual email builder recipient/messageID/fixed opaque URL, tracking/autocreatefalse, HTML htmlencode directive, no result/verdict/profile/name payload, rendered HTML CTA/link and plain iPhone copy/link. Liquid is a narrow test double; actual provider rendering/default configured messageID not proved. Worker injects preparation, cannot replace.
- **R** `tests/mobile-research-email.test.ts:36` — research link requires an opaque UUID and a trusted HTTPS origin
  Valid helper URL plus malformedUUID/insecureorigin/foreignorigin throws. Email positive covers only first input. No other callback contains all invalid inputs; moving them would add calls prohibited by scope.
- **R** `tests/mobile-research-result-service.test.ts:31` — only the owning, marked mobile submission yields a freshly resolved assessment
  Actual result service passes owner/submission/barcode to injected loaders/resolver, fresh resolve count1 and accepts assessment/not_needed. Does not execute default ownership SQL; stronger worker injects entire resolver and cannot replace input dispatch/freshness branches.
- **R** `tests/mobile-research-result-service.test.ts:67` — unowned, unmarked and unapproved submissions never resolve or leak a result
  Null submission not_found; five changed source-marker/status/barcode/product guards not_ready and resolve count0. Worker only receives not_ready, cannot detect service incorrectly admitting these inputs. This callback uses injected owner-filtered absence, not real owner query.
- **R** `tests/mobile-research-result-service.test.ts:114` — withdrawn, mismapped and profile-incomplete results remain ineligible
  Profile incomplete and four resolved outcomes (wrong-product assessment, submission_required, authority_unavailable, deferred) remain not_ready. Worker fake readiness cannot catch mismapped catalog product or failed authority being declared ready.
