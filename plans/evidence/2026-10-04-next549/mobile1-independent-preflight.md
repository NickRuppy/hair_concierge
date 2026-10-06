# Independent Mobile1 preservation preflight

Verdict: READY FOR MAIN-ONLY CONTROL PASS. The one C proposal preserves the complete donor contract on the existing fifth-attempt keeper, subject to main's actual fault/restoration and native/coverage proof. No unresolved semantic or frozen-artifact blocker found. No tests, providers, DB engines, owner mutations or repository writes executed by this reviewer.

Reviewed proposal: `/tmp/test-audit-mobile-delivery-{layer-plan.md,ledger.md,candidates.json,manifest.json,controls.json,complete.diff}` and all before/transfer/cut snapshots. Independent static result: `/tmp/mobile1-independent-static.json` —34→34→33 AST sites,28 readset hashes match,3 prospective source controls parse,0 artifact mismatches. One repeated HTTP callback has4 runtime registrations; those existing rows remain untouched. Only the worker test changes.

Exact final worker hashes:
- Before:7bba52ef0ab1d379a5e461b0cf214bf54706713a142097f1fd0f69add27829c8
- Transfer:159ff0c3f90620eca294bd8a59d6c854f52961b02c4e7022e6080119720355e2
- Cut:f3bf04ec6aeab8b80292f8acdfb00889e2a54cd3929d88b00e85fe4caaac41de

## Donor/keeper operative proof

Donor `tests/mobile-research-delivery-worker.test.ts:245`, “an APNs credential fault is tagged for the outbox refund and retried slowly”; keeper at260, “a fifth APNs credential fault reports the refunded retry rather than a terminal failure”. Read complete callback bodies, all surrounding worker tests and complete fixture implementation.

Both fixtures supply only push, identical owner/submission/lease/token/binding/environment/topic, ready resolver, fixed2026-09-18T20:00Z clock and the same retryable APNs receipt with InvalidProviderToken/3600seconds. Each calls actual reconcileMobileResearchDeliveries once. The difference is row.send_attempts0 versus4. Full owner read finds only two operative reads of send_attempts:

1. worker134 uses it in the nullish fallback `result.retrySeconds ?? Math.min(3600,60*2**row.send_attempts)`. The retryable mapping at275–282 supplies explicit3600, so neither fixture evaluates the fallback.
2. worker140–145 checks `result.error !== "push_provider_credentials"` before the terminal attempt threshold. The identical credential error makes this false in both fixtures; neither evaluates the threshold on the successful path. The keeper additionally catches removal of this exception because4+sent1 reaches5.

The actual worker computes credential classification through the imported APNS_PROVIDER_CREDENTIAL_REASONS Set, sets retrySeconds, formats nextAttempt from deps.now(), emits actual RPC arguments, and updates real stats after the fake RPC returns. The fake supplies storage acknowledgments and state transitions; it cannot create the observed error tag or next-attempt timestamp for the worker. The existing result.retry1 assertion subsumes donor retry1; the exact local first-settlement lookup, literal credential tag assertion and Date.parse-minus-now3600*1000 assertion transfer unchanged. Existing terminal0/fake state retry assertions remain. No new owner/provider calls, fixtures, rows or inputs are introduced.

## Dependency-backed contracts retained

Full APNs owner read verifies InvalidProviderToken/ExpiredProviderToken are actual credential reasons; classifyApnsResponse maps them to retryable3600. The retained APNs response callback independently covers both names. These worker tests inject a receipt and do not prove HTTP/JWT/provider delivery; no such proof is claimed.

Full outbox migration read verifies begin-send increments durable attempts under processing/lease/count guards; finish_mobile_research_delivery145–155 refunds credential attempts and exempts them from terminal conversion. The retained real PGlite callback at tests/mobile-research-delivery-outbox.test.ts:166 loads actual migrations, runs seven credential retries and reads pending/attempts0 each time, then proves normal retries exhaust on the fifth. Its complete fixture/callback was inspected. The worker fake does not prove this SQL invariant and is not used to replace it.

Actual route src/app/api/mobile/v1/research-delivery/reconcile/route.ts calls the worker by default after auth/enabled guards; vercel.json includes the scheduled route. Same test:node glob and unconditional CI Node job cover donor and keeper. History81e32e8b introduced delivery source/tests; plans/ios-search-history/plan.md:105 expressly records the fifth-attempt credential observability regression. Keeping that stronger callback is consistent with the recorded regression, not a reason to retire delivery on a feature flag.

## Controls and resolved artifact defect

Initially found an artifact mismatch: stale candidates/manifest described appended tag/delay after fake-state assertion while the snapshot/diff placed them before. In the stale order, corrupting only the emitted tag would fail fake state before reaching the intended tag assertion. Scanner regenerated the final artifacts. Independent recheck confirms manifest hashes and candidate keeperAfter exactly match snapshots, with tag/delay BEFORE fake state. This finding is resolved; do not use older cached hashes/bodies.

The3 proposed owner controls are meaningful:
- Corrupt only emitted p_error_code: internal stats still see credential error and pass retry1/terminal0; new exact RPC tag assertion fails before fake-state assertion.
- Replace retrySeconds calculation with300: actual timestamp delta becomes300000, so transferred3600000 assertion fails; stats/state remain otherwise valid.
- Remove credential exception from persistedAction: fifth attempt is incorrectly counted terminal, caught by existing retry1/terminal0. This proves retained stronger contract, not transferred delay/tag by itself.

All3 exact replacements are unique at pinned owner bytes and parse. Actual intended ERR_ASSERTION lines, baseline/restored-green receipts and byte-exact restores must still be obtained by main. Static parsing is not execution evidence. The unrelated F1 disabled-title/resolve-observer issue remains explicitly retained and outside this one-cut proposal.

Read limits: independent semantic read covered complete worker and fixture/tests, full APNs client, complete outbox migration and exact SQL refund fixture/callback, actual cron route, APNs credential callback, current source references/CI/history. All27 proposed file versions were parsed and all28 declared readset hashes checked; that does not claim a second exhaustive semantic audit of every unchanged mobile/Swift/result-service callback. Those unchanged tests are not deletion justification. No broader production retirement is supported.
