# Independent email-delivery94 preservation review

**Conditional PASS for default C1–C4 only. No blocking semantic preservation finding.** The optional PP fifth cut remains rejected/held R: this review does not accept losing raw-object `in` sensitivity to an own property with value `undefined`. Both default transfer/cut phases leave that entire file unchanged.

Frozen manifest: `682498b63ba6b141d5a88ce476fa824e0a2e623156d8d1cefb94f24459b627ea`; candidates `c3b510722101c5c2a22b314abbae014b82061869ed8f4eeb18e9ef55d2950812`; controls `5ba306e627bd4580f4d5ad2f6ed36e933566a487cf2b67e670de4734abfe77af`. Root `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`, pinned HEAD `21e0e41fa996ec6a725c258ab3766971f0edb94d` and branch `codex/test-audit-pruning` as in manifest. No proposed source cleanup.

## C1–C3: actual renderer object reaches the existing observation boundary

Read complete current donor `tests/trial-reminders.test.ts`, complete keeper `tests/trial-reminders-delivery.test.ts`, fixtures, helper functions and all callbacks. `annual` and `snapshot` object initializers are byte-identical: provider stripe, accepted trial terms/year/EUR, first6999/renewal9999, same contract ID, authorization and trial end, tax-inclusive. C2's object spread reassigns its contract ID to exactly the existing literal. It creates a fresh ordinary object but no operative field or prototype difference; the real parser/renderer contains no object identity check, mutation or context read distinguishing it.

The existing keeper's fixture returns one `claim`; its `prepare` returns that same claim. Real `dispatchTrialReminders` validates identity, obtains injected verified recipient, then at `trial-reminders-delivery.ts:176` calls actual `buildTrialReminderMessage(fresh.snapshot)`. At178–183 it passes this message to the send boundary. The proposed wrapper only records `input.message` then calls the original `f.deps.send(input)` once. It does not build or substitute expected data. The original cutoff/recipient/email assertions, exact enqueue→claim→recipient→prepare→send→settle call sequence, queued count and normalized receipt assertions remain. One dispatcher invocation and one original fake-send call remain; no additional cases, fixture rows, owner invocations or count-assertion packing.

The complete renderer and parser's operative contract-confirmation branch were read. The parser validates fixed values and seven-day dates and returns the same accepted object; renderer uses explicit Europe/Berlin Intl formatting, trusted URLs, pure escaping and provider first-charge selection. Captured message is the actual renderer result. After send the dispatcher normalizes ACK and invokes the original fake settle, which only records outcome; neither mutates the message. The additional async forwarding layer has no new timer/concurrency input; original awaited order stays asserted.

All **18** original annual assertions transfer verbatim in the order C1(12), C2(4), C3(2) after the keeper's existing three assertions. That includes complete fixed link inventory and HTML absence checks, not only amount/date examples. Expectations remain literal. C2 never supplied hostile input, so its title is broader than demonstrated behavior; preserving the same nonhostile output oracle is sufficient for this specific transfer and is not generalized escaping proof. Monthly/full-price, malformed terms and PayPal next-day callbacks stay byte-exact.

Boundary limitation is material and correctly stated in the proposal: the send collaborator is fake. Production `sendTrialReminder` calls `buildTrialReminderEmail`, which sends its own Liquid template using `messageData`; it does not forward the captured renderer `htmlBody` as provider HTML. The complete transport adapter was read, including its template and payload mapping. Thus this keeper proves the local renderer object reaching dispatcher send, **not** provider-rendered email, inbox delivery or actual SQL ownership. The retained transport/template tests keep their independent meaning. No direct-string-to-unrelated-hard-coded-template substitution is relied on.

## C4: input-independent constant is checked through its real consumer

Read all `customerio-page-view.test.ts` and the complete unchanged supporting `meta-offer-view.test.ts` (11 callbacks), including canonical fixture and keeper. The removed donor's original two assertions require the constant equal `https://chaarlie.de/result` and its string not include `lead-123`.

`page-url.ts:5` exports the constant. Actual `deliverMetaOfferView` at `api/analytics/meta-offer-view/route.ts:109–145` reads eligible lead evidence and builds the conversion with `eventSourceUrl: META_OFFER_EVENT_SOURCE_URL` at125. It does not derive the URL from lead ID. The retained keeper executes this real builder, records the argument to its fake delivery, and compares the whole conversion to an independent literal URL at its existing `deepEqual` line190. Exact equality to that string logically implies no `lead-123`, regardless of the UUID input used by the keeper. No new request/call/row/assertion is needed. Donor input differences do not imply a lost URL-input branch because this actual owner uses an input-independent constant.

This does not prove every possible future lead-dependent algorithm, nor does it certify Meta ingestion. It preserves both original constant predicates and exercises their current conversion delivery boundary. All 11 support callbacks and the entire file are byte-exact; no support-site removal credit. The unused constant import is removed only from the donor test. The production export and other billing consumer remain live.

## Independent exact reconstruction

`/tmp/test-audit-email94-independent.cjs` is an independent read/parse validator, not an editor or owner/test runner. It verifies:

- Default 17 files / 51 snapshots, **94→94→90** declarations; optional PP phases excluded from acceptance.
- Transfer equals only the reviewed keeper replacement plus type-only import. Cut equals transfer minus the four exact donors and unused Meta import. Other full-file bytes reconstruct exactly.
- **89 unrelated callbacks** byte-exact in both phases; all **8 held F** cases unchanged.
- Existing keeper's three assertions followed by the complete ordered **18 verbatim** donor assertions; annual/snapshot initializers identical.
- Supporting Meta file SHA and all11 sites, unchanged full keeper and independent literal expectation.
- All **76 current readset pins** match; source anchors and mutant SHA values match.
- All20 full prospective owner mutants parse; unique anchors belong to the actual declared function or constant, selected pattern matches exactly one registration, and error operator/intended assertion first-frame line match the actual keeper AST in both phases.
- Entire held PP file remains before-byte-identical in transfer/cut; raw undefined-property distinction is preserved.

No product imports, test/native/browser/provider/DB execution, source faults, subprocesses or repository writes. Static parsing is not typecheck or runtime behavior evidence. The 89 untouched callbacks were mapped and byte-verified, not independently semantically re-audited in this bounded candidate review.

## T1 — normalize explicit message oracles before actual owner faults

**Operator-readiness condition, not a semantic cut rejection:** all20 current controls specify `ERR_ASSERTION`, operator and first keeper frame, but their `expected` objects do not include an explicit message predicate. Their textual protocol likewise omits a message check. Parent's required strict message/code/operator/frame protocol therefore is not yet fully expressed for a future operator.

The independent machine receipt includes `proposedExpectedMessageAllSubstrings` per control. These combine the Node assertion-kind message prefix with the literal expected value/regex, or exact changed+expected URLs for deep equality. They are statically inferred expectations, not measured runtime output; apply them to decoded actual `error.message`, not JSON/TAP-escaped serialization. Main must normalize/inspect the future driver and verify actual diagnostic behavior. Do not relax to arbitrary ERR_ASSERTION or any frame in the keeper.

No other control problem found in static reasoning:

- Twelve C1 controls alter just the named subject/plaintext/data/HTML field at the actual renderer return; earlier assertions retain their source values. Replacing the cancellation href can affect later inventory too, but the listed earlier href assertion remains the first intended failure.
- C2 appends script or unresolved trigger markers, changes only first management href, or only trial-end data. Existing earlier amount/cancellation/postal observations remain intact; intended lines99/100/101/111 are plausible.
- C3 changes only messageData.first_charge_date or messageData.subject while header subject/receipt/HTML stay untouched, so lines113/114 are not masked by earlier assertions.
- C4 changes the actual constant to `/result/lead-123`; prior missing-lead checks and delivered status remain satisfied, conversion deepEqual line190 catches it.
- Extra dispatcher-only substitution copies the actual message but replaces subject before the existing send boundary. Direct renderer donors would survive this extra control; transferred subject line86 should catch it. This is additional boundary strength, not evidence for the original donors' sensitivity.

The 18 renderer controls do not create invalid snapshots or throw before returning the message. URL literal casts are only type-level annotations in mutants; expected runtime is an ordinary wrong string, not setup/type failure. All20 are unrun. Main must require clean1→one intended named assertion failure at first keeper frame→byte-exact restore→clean1, reject setup/import/SQL/TypeError/signal/timeout/zero selection/unrelated assertions, and serialize mutations. No operator tool is supplied or approved here.

## Reachability and scope limits

Current reminder reconcile GET (`api/billing/trial-reminders/reconcile/route.ts`) calls the dispatcher behind bearer admission; `vercel.json` schedules that route every five minutes. Real storage adapters are lazy function calls; the tested fixture overrides all of them. Current Meta conversion route directly consumes the URL export; billing's Meta destination also uses it. Pure renderer/parser, URL module, dispatcher, transport adapter and relevant current callers were read; no owner-retirement inference from flags/history.

Historical evidence and broader94 semantic findings remain the author's ledger; this review read candidate-specific paths, not all76 full files or all migrations/vendor sources. The main's wider coverage/native/CI proof is not rerun. Conditional acceptance of these four edits is distinct from actual removal credit or publication readiness. Optional PP fifth remains excluded without exception.
