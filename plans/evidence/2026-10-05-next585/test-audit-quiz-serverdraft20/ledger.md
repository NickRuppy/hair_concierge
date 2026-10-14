# Quiz server-draft20 complete per-registration ledger

Dispositions: {'R': 17, 'F': 3, 'C': 0, 'D': 0}. Every registration retained unchanged. No runtime proof.

## F — tests/personal-plan-quiz-server-draft-client.test.ts:98
v4 local drafts carry optional server metadata and reject v3 state

v4 local persistence roundtrip preserves server identity/revision/generation and rejects v3; clear observation is vacuous after rejected v3 input.

Evidence: draft.ts:162-248. No-op removal survives final load(null); preserve earlier metadata/version assertions. #301 changed v3 acceptance to rejection without strengthening clear observation.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:136
resume reconciliation keeps equal local drafts and accepts only demonstrably newer server snapshots

Equal local state wins; absent or mismatched local identity and newer server revision hydrate exact server answers and metadata.

Evidence: server-draft-client.ts:115-156. Unconditionally prefer server overwrites equal local edits; unconditionally prefer local blocks newer/foreign server state.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:202
server draft payload is versioned, partial-safe, and durable-only

Wire payload includes v4 and revision, strips all ephemeral fields, retains partial durable values and opt-in catch-up.

Evidence: server-draft-client.ts:49-79. Accidental email/consent/dailyTime persistence or dropped revision/catch-up flag; session fixtures do not include these extra fields.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:245
resume token URL helpers preserve state, query, and fragments

URL mutation preserves acquisition query/hash and history state across replace/push/remove.

Evidence: server-draft-client.ts:158-197. Replacing query wholesale loses attribution; history overwrite breaks back navigation. Fake history captures exact real helper delivery.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:285
server draft responses normalize flag-off, retryable, stale, and saved states

Status interpreter maps 404/202/409 and exact saved metadata/token receipt.

Evidence: server-draft-client.ts:205-239. Treating 202 as failed or dropping resumeToken; network-error session and created receipt are different inputs.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:315
server draft session disables on 404 and strips stale tokens on 409

Actual session disables on 404, latches stale on 409 and removes bearer URL token in each.

Evidence: server-draft-client.ts:302-314. Ignoring parsed disabled/stale results or leaving stale token in URL. Parser result alone cannot prove lifecycle effects.

## F — tests/personal-plan-quiz-server-draft-client.test.ts:342
server draft session contains network failures and retries with bounded backoff

Network failure containment and first three attempts are checked; asserted retry bound has insufficient observation horizon.

Evidence: server-draft-client.ts:315-327. Changing retryCount < 2 to < 3 schedules fourth attempt at about 1500 ms, after the only 850-ms assertion; no final cap observation.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:362
server draft session publishes draft identity and revision after a successful create

Successful created receipt publishes exact metadata to callback and session accessor.

Evidence: server-draft-client.ts:272-287. Removing onMetadata notification breaks durable local identity linkage; other session tests lack this callback oracle.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:388
pagehide helper skips bfcache restores and keeps non-persisted unload flushing

Persisted pagehide skips flush; genuine unload flushes.

Evidence: server-draft-client.ts:199-203. Negated or constant predicate breaks bfcache lifecycle. Session tests invoke flush directly, not persisted event predicate.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:393
non-persisted pagehide keepalive is the terminal server write for that heap

Keepalive is terminal: post-flush queueSave causes no request; metadata reflects response and stale remains false.

Evidence: server-draft-client.ts:362-408. Allowing subsequent queueSave after completed flush forks revision updates; in-flight ordering tests have different prefixes.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:459
normal autosave first then freshest catch-up keepalive persists without latching stale

In-flight normal response then freshest catch-up receipt yields two exact requests and final revision 3 without stale latch.

Evidence: server-draft-client.ts:289-349,362-408. Drain restarts queued stale data after terminal flush, missing catch-up transport flag, or older receipt overwrites state.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:549
catch-up keepalive first then older normal stale response is ignored

Keepalive accepted first prevents a later older 409 from latching stale; two exact request bodies preserved.

Evidence: server-draft-client.ts:309-314,362-408. Dropping sequence guard clears valid credential after newer write; reverse ordering is not equivalent.

## R — tests/personal-plan-quiz-server-draft-client.test.ts:632
server route and migration wire unload catch-up without weakening browser generation

Parser-to-route opt-in delivery and original SQL function signature/generation/+1 bounded catch-up contract.

Evidence: server-draft.ts:125-136; personal-plan-draft/route.ts:116-122; 20260731124000 migration:65-85. Source syntax is coupled, but whole callback includes independent parser and route wire delivery absent in PGlite tests. Existing SQL forward keeper is not assertion-union-equivalent.

## R — tests/personal-plan-quiz-server-draft.test.ts:36
server quiz drafts accept partial durable answers but reject unknown and ephemeral fields

Strict partial durable schema rejects ephemeral/unknown fields, out-of-range revision, invalid enum/duplicates and unselected recurrence; accepts valid recurrence and exact text boundary.

Evidence: server-draft.ts:27-172. Stripping rather than rejecting foreign keys or accepting >int32 revisions crosses persistence boundary. Client sanitizer has a different permissive contract.

## R — tests/personal-plan-quiz-server-draft.test.ts:128
stored v3 drafts restart cleanly while retaining their server revision seam

Unversioned legacy draft restarts cleanly, v4 retains values, explicit v3 malformed envelope is rejected.

Evidence: server-draft.ts:179-196. Treating explicit old version as unversioned legacy or reusing retired taxonomy. Does not itself observe database revision retention.

## F — tests/personal-plan-quiz-server-draft.test.ts:148
resume credentials have independent 256-bit values and cookies are signed

Preserve credential length/distinctness/hash linkage, cookie roundtrip/options, query key, exchange hash comparison and canonical helper architecture; same-length invalid HMAC is untested.

Evidence: server-draft.ts:198-257; persistence.ts:189-201. Only tamper appends x, so signature-length mismatch short-circuits timingSafeEqual. Bypassing equality still satisfies all existing callback inputs.

## R — tests/personal-plan-quiz-server-draft.test.ts:200
landing recovery degrades to a clean snapshot when its read RPC throws

Landing dependency rejection degrades to null snapshot while retaining exchange need.

Evidence: server-draft.ts:318-340. Uncontained optional read failure aborts landing before analytics/render; injected rejecting dependency tests outer promise catch only, not real RPC delivery.

## R — tests/personal-plan-quiz-server-draft.test.ts:208
draft handlers reject disabled and cross-origin requests before database work

Actual handlers return disabled404/no-store, cross-origin400 and disabled resume307 to fixed landing.

Evidence: personal-plan-draft/route.ts:58-67; resume/route.ts:37-57. Missing exact-true/origin guards changes public response. No explicit DB-call spy: only response/ordering reachability, not independent zero-I/O proof.

## R — tests/personal-plan-quiz-server-draft.test.ts:245
replayed resume fallback preserves a valid stale draft cookie but clears absent or invalid cookies

Replay fallback preserves valid signed stale cookie and expires absent/malformed cookies.

Evidence: resume/route.ts:32-49. Always clearing valid stale cookie allows later request to look like a new create; helper is actual GET fallback.

## R — tests/personal-plan-quiz-server-draft.test.ts:282
migration keeps recovery state private, bounded, and atomically generation-aware

Foundation private storage/grants, hashed unique credential, seven-day bound and locked generation rotation are explicit schema contracts.

Evidence: 20260731124000 migration:1-24,87-104,112-123. Relaxing privilege, uniqueness, expiry or exchange rotation changes public storage/security contract. Forward update PGlite tests do not cover all these foundation clauses.
