# Quiz normalization / input taxonomy — complete 106-site ledger

Exact owned scope: 11 files; 106 AST declaration sites and 135 statically expected registrations. R=101, F=5, C=0, D=0. All bytes retained. Baseline/native/browser/mutations UNRUN by this lane.

Each entry is a human semantic judgment from the complete callback/support/fixture plus the stated owner path. Full assertion and call expressions are preserved in `ledger.json`; full original text is in the snapshots. Counts alone are not audit evidence.

## tests/quiz-normalization.test.ts

### R · L13 · "natur stays exclusive in treatment selection"

Interactive natural-treatment exclusivity for empty, natural-to-colored, and chemical-to-natural selection.

Credible regression / gap: Allow natur to coexist with a selected chemical treatment.

Owner: `normalization.ts:126-151`. retain unchanged at this existing boundary.

### R · L19 · "chemical shape treatments combine with color treatments in canonical order"

Four sequential selections retain straightening, color, perm and bleach in canonical order.

Credible regression / gap: Drop shape treatments or preserve tap order instead of canonical order.

Owner: `normalization.ts:126-151`. retain unchanged at this existing boundary.

### R · L28 · "legacy pulltest values are normalized"

Legacy ueberdehnt pull-test mapping within a complete saved answer record.

Credible regression / gap: Stop mapping the legacy stretch value.

Owner: `normalization.ts:154-231`. retain unchanged at this existing boundary.

### R · L43 · "density values are normalized and invalid values are removed"

All three density literals survive normalization; an unknown literal is removed.

Credible regression / gap: Reject low/high density or leak an unknown density.

Owner: `normalization.ts:154-231`. retain unchanged at this existing boundary.

### R · L50 · "hair length values are normalized and invalid values are removed"

Recognized very-long length survives; unknown length disappears on read.

Credible regression / gap: Drop very_long or retain an unknown length.

Owner: `normalization.ts:154-231`. retain unchanged at this existing boundary.

### R · L55 · "legacy scalp values still map to type and condition"

Legacy combined oily/dandruff scalp value becomes type, active gate and condition.

Credible regression / gap: Preserve combined legacy string without projecting all three scalp facts.

Owner: `normalization.ts:154-231`. retain unchanged at this existing boundary.

### R · L70 · "legacy no-issue scalp answers normalize to a negative scalp gate"

Legacy keine condition becomes false issue gate and absent condition.

Credible regression / gap: Treat keine as an active condition.

Owner: `normalization.ts:154-231`. retain unchanged at this existing boundary.

### R · L86 · "stored answers without the new concern or scalp gate fields backfill clean defaults"

Older records lacking concerns and the issue gate read as empty concerns and a false gate.

Credible regression / gap: Require new fields on old records or leave the gate undefined.

Owner: `normalization.ts:154-231`. retain unchanged at this existing boundary.

### R · L100 · "free-text concern notes are trimmed and empty strings are removed"

Nonblank concern free text is trimmed on saved-record read.

Credible regression / gap: Keep leading/trailing whitespace.

Owner: `normalization.ts:95-102`. retain unchanged at this existing boundary.

### R · L109 · "blank free-text concern notes normalize to undefined"

Whitespace-only concern text becomes undefined.

Credible regression / gap: Keep a blank string as a stated concern note.

Owner: `normalization.ts:95-102`. retain unchanged at this existing boundary.

### R · L118 · "legacy free-text concern notes are clamped to the current 50-character limit"

Long stored concern text is trimmed and clamped to 50 characters.

Credible regression / gap: Stop clamping legacy notes or clamp to a different limit.

Owner: `normalization.ts:95-102`. retain unchanged at this existing boundary.

### F · L126 · "shared hair-loss concern is added once after hair damage with reviewed copy"

The first hair-loss entry follows hair damage in both taxonomy and UI options; the complete reviewed UI object is exact. Uniqueness is not observed.

Credible regression / gap: Duplicate the hair-loss entry later in either array: indexOf/findIndex and the first-object assertions stay green.

Owner: `diagnostic-input.ts:3-14; src/components/personal-plan-quiz/quiz-data.ts:286-368`. unchanged; F repairs are deferred with zero credit.

### R · L142 · "canonicalization drops invalid natur conflicts"

Canonicalization repairs conflicting natural treatment and simultaneously preserves the full normalized physical/scalp/concern shape.

Credible regression / gap: Only normalize the treatment while dropping another asserted canonical field.

Owner: `normalization.ts:233-254`. retain unchanged at this existing boundary.

### R · L169 · "goals are passed through when valid (sorted to canonical GOALS order)"

Valid historical goals are ordered by the canonical goal vocabulary.

Credible regression / gap: Return insertion order instead of stable canonical ordering.

Owner: `normalization.ts:104-124`. retain unchanged at this existing boundary.

### R · L179 · "invalid goal values are filtered out"

Mixed unknown and nonstring goals are excluded while recognized values remain.

Credible regression / gap: Coerce a numeric goal or retain an unknown string.

Owner: `normalization.ts:104-124`. retain unchanged at this existing boundary.

### R · L188 · "new quiz goals preserve every unique shared selection"

All eight shared goals survive deduplication and canonical sorting; no obsolete cap.

Credible regression / gap: Reintroduce a five-goal or first-three cap.

Owner: `normalization.ts:104-124`. retain unchanged at this existing boundary.

### R · L214 · "goals drop the conflicting volume/less_volume pair (keeps first occurrence)"

Opposite legacy volume goals retain whichever was selected first, for both input orders.

Credible regression / gap: Always prefer one direction or retain both conflicting values.

Owner: `normalization.ts:104-124`. retain unchanged at this existing boundary.

### R · L223 · "missing or empty goals normalize to undefined"

Missing, empty and entirely invalid goal inputs each normalize to undefined.

Credible regression / gap: Emit an empty array or preserve an invalid-only goal list.

Owner: `normalization.ts:104-124`. retain unchanged at this existing boundary.

### R · L229 · "canonicalization carries goals through in canonical GOALS order"

The canonicalization entry point carries and orders goals through its override path.

Credible regression / gap: Canonicalize physical fields but discard goals after normalization.

Owner: `normalization.ts:233-254`. retain unchanged at this existing boundary.

### R · L245 · "shared quiz values project once into the existing profile vocabulary"

Shared concern and goal vocabulary projects into profile vocabulary, including hair loss and contextual volume direction.

Credible regression / gap: Lose the shared-to-profile mapping or infer a volume direction without the asserted hair facts.

Owner: `normalization.ts:257-336`. retain unchanged at this existing boundary.


## tests/quiz-primary-concern.test.ts

### R · L101 · `resolveStatedPrimaryConcern: ${row.name}`

Eleven raw-input statement cases: absent/empty, one/no/same/stale pick, multiple/valid/missing/stale pick, legacy aliases, nonlegacy and unknown pick.

Credible regression / gap: Reintroduce ranking, trust a stale pick, or lose single-concern inference.

Owner: `primary-concern.ts:18-62`. retain unchanged at this existing boundary.

### R · L106 · "a pick is asked for only with two or more concerns"

Zero and one concern do not need the chooser; two do.

Credible regression / gap: Show a chooser for one concern or bypass it for two.

Owner: `primary-concern.ts:32-34`. retain unchanged at this existing boundary.

### R · L112 · "toLegacyQuizConcern maps aliases and leaves the four non-legacy codes out"

Two aliases map, six legacy values preserve identity, four unsupported values and null map to null.

Credible regression / gap: Invent legacy equivalents for unsupported concerns or drop a real alias.

Owner: `primary-concern.ts:56-62`. retain unchanged at this existing boundary.

### R · L131 · "need lane: the stated pick decides, not a weight ranking"

A stated frizz choice overrides competing breakage, preserving both primaryConcern and surface lane.

Credible regression / gap: Use damage ranking rather than the stated selection.

Owner: `need-lane.ts:92-154`. retain unchanged at this existing boundary.

### R · L143 · "need lane: aliases map into the legacy vocabulary"

Direct need-resolution maps dry_lengths and an explicitly selected frizz_flyaways into legacy primaryConcern.

Credible regression / gap: Resolve a correct lane but return the wrong primaryConcern field.

Owner: `need-lane.ts:92-154`. retain unchanged at this existing boundary.

### R · L165 · `need lane: stated ${nonLegacy} falls back to no primary concern`

Each of four nonlegacy choices yields null legacy primaryConcern and base with empty goals.

Credible regression / gap: Fall back to the competing breakage concern when the stated one has no legacy equivalent.

Owner: `need-lane.ts:92-154`. retain unchanged at this existing boundary.

### R · L177 · "need lane: the explicit stated concern wins over a collapsed legacy projection"

An explicit null statement from raw two-concern data survives a lossy projection down to one legacy concern.

Credible regression / gap: Resolve statement again from projected answers and invent a primary dryness concern.

Owner: `need-lane.ts:92-154; normalization.ts:327-336`. retain unchanged at this existing boundary.

### R · L188 · "narrative: the stated pick drives the intro and the friction row"

With a stated frizz pick and moisture goal, narrative primaryConcern, intro and friction copy all follow her choice.

Credible regression / gap: Render a different concern despite resolving the lane correctly.

Owner: `result-narrative.ts:492-509,619-742,1018-1043`. retain unchanged at this existing boundary.

### R · L200 · "narrative: legacy multi-concern answers without a pick get neutral copy"

Legacy multiple concerns without a pick have null primaryConcern and neutral friction copy despite a selected moisture goal.

Credible regression / gap: Treat one of the competing concerns as stated during rendering.

Owner: `result-narrative.ts:1018-1043`. retain unchanged at this existing boundary.

### R · L212 · "narrative: legacy multi-concern answers without a pick and without goals stay neutral"

The no-pick/no-goal input keeps null concern/goal, neutral intro and headline, neutral friction row and exact low-score scalp tie row.

Credible regression / gap: Infer a goal or change zero-score tie resolution while leaving the other neutral case green.

Owner: `result-narrative.ts:372-415,492-523,619-742,1018-1043`. retain unchanged at this existing boundary.

### R · L250 · `narrative: stated ${concern} has its own copy and does not crash`

All four newer concern codes have their own primaryConcern/before/intro prefix and a nonempty after field.

Credible regression / gap: Drop a newer code in the narrative adapter or substitute legacy copy.

Owner: `result-narrative.ts:106-199,1018-1043`. retain unchanged at this existing boundary.

### R · L267 · "narrative: hair loss keeps the medical boundary and promises no product result"

A single hair-loss concern with no goals retains the medical boundary and excludes product-treatment promises.

Credible regression / gap: Replace after/main-lever text with a hair-regrowth or anti-hair-loss promise.

Owner: `result-narrative.ts:185-199,619-742,999-1015`. retain unchanged at this existing boundary.

### R · L281 · "offer preview lane follows the stated pick from the raw answers"

Actual offer-preview builder receives raw statement before projection: explicit frizz wins, raw unpicked dryness+low_shine remains base.

Credible regression / gap: Re-resolve a primary concern only after lossy projection.

Owner: `offer-preview.ts:245-272`. retain unchanged at this existing boundary.

### R · L302 · "lead schema accepts the new key and still accepts answers without it"

Full lead wrapper accepts a valid primary pick and also legacy payloads without that key.

Credible regression / gap: Strip/reject the new key or make it required at the write wrapper.

Owner: `validators.ts:106-125`. retain unchanged at this existing boundary.

### R · L316 · "lead schema never rejects a stale pick; canonicalisation drops it"

A stale but vocabulary-valid pick parses at write boundary, then canonicalization removes it and omits its JSON key.

Credible regression / gap: Reject a stale pick or persist it after canonicalization.

Owner: `validators.ts:106-125; normalization.ts:233-254`. retain unchanged at this existing boundary.

### R · L326 · "lead schema rejects a pick outside the concern vocabulary"

The quiz write schema rejects an out-of-vocabulary primary pick on an otherwise complete input.

Credible regression / gap: Widen primary_concern from enum to arbitrary string.

Owner: `validators.ts:18-40`. retain unchanged at this existing boundary.

### R · L332 · "canonicalisation keeps a contained pick"

Canonicalization preserves a contained valid pick.

Credible regression / gap: Unconditionally discard primary_concern.

Owner: `normalization.ts:85-93,233-254`. retain unchanged at this existing boundary.

### R · L341 · "stored re-read: old answers without the key and new answers with it both parse"

Old saved answers and new saved answers both parse after read normalization; a current contained pick survives.

Credible regression / gap: Make the stored schema require the key or lose it on read.

Owner: `normalization.ts:154-231; validators.ts:113-118`. retain unchanged at this existing boundary.

### R · L358 · "stored re-read drops a stale pick instead of failing"

A saved stale pick is dropped before stored validation, rather than making the stored record unreadable.

Credible regression / gap: Pass the stale pick through normalization or reject the whole record.

Owner: `normalization.ts:154-231; validators.ts:113-118`. retain unchanged at this existing boundary.

### R · L370 · "profile projection writes the legacy vocabulary like concerns"

Profile primary-concern projection maps explicit dry lengths/hair loss and emits null for unpicked, unmappable and empty inputs.

Credible regression / gap: Write raw quiz vocabulary or infer a legacy concern when none was stated.

Owner: `link-to-profile.ts:93-116`. retain unchanged at this existing boundary.


## tests/quiz-validators.test.ts

### R · L21 · "quiz schema accepts an empty concern array with a negative scalp gate"

Write schema accepts a complete empty-concern record with a negative scalp gate.

Credible regression / gap: Require at least one concern or reject a false scalp gate.

Owner: `validators.ts:18-125`. retain unchanged at this existing boundary.

### R · L29 · "quiz schema requires density as the third physical hair attribute"

Removing only density from the complete valid base is rejected.

Credible regression / gap: Make write density optional.

Owner: `validators.ts:18-40,106-108`. retain unchanged at this existing boundary.

### R · L36 · "quiz schema requires hair length as the fourth physical hair attribute"

Removing only hair length from the complete valid base is rejected.

Credible regression / gap: Make current write hair_length optional like stored reads.

Owner: `validators.ts:18-40,106-118`. retain unchanged at this existing boundary.

### R · L43 · "quiz schema accepts free-text-only concern notes"

Empty concerns plus a nonblank free-text note is a valid write.

Credible regression / gap: Require a structured concern when a note is provided.

Owner: `validators.ts:18-40`. retain unchanged at this existing boundary.

### R · L52 · "quiz schema accepts all nine shared concerns and rejects duplicates or unknowns"

Nine listed shared concern values parse together; duplicate concerns and unknown concern each reject. This is not exhaustive coverage of the later tenth hair-loss literal.

Credible regression / gap: Reject a listed shared concern, allow duplicates, or allow unknown values.

Owner: `validators.ts:18-105`. retain unchanged at this existing boundary.

### R · L73 · "quiz schema requires a scalp condition when the user reports an active issue"

Active scalp issue without a condition rejects on the otherwise valid base.

Credible regression / gap: Remove the active-gate condition requirement.

Owner: `validators.ts:67-88`. retain unchanged at this existing boundary.

### R · L82 · "quiz schema rejects a scalp condition when the scalp gate is negative"

Negative scalp gate with a supplied condition rejects.

Credible regression / gap: Allow mutually inconsistent scalp answers.

Owner: `validators.ts:67-88`. retain unchanged at this existing boundary.

### R · L91 · "quiz schema does not use colored as a concern code"

colored is not an accepted concern vocabulary value.

Credible regression / gap: Confuse a chemical treatment with a concern.

Owner: `validators.ts:18-40`. retain unchanged at this existing boundary.

### R · L100 · "quiz schema accepts multiple non-natural chemical treatment values"

All four nonnatural chemical treatments can be selected together.

Credible regression / gap: Make treatment single-select or reject perm/straightening combinations.

Owner: `validators.ts:18-66`. retain unchanged at this existing boundary.

### R · L109 · "quiz schema rejects natur combined with a chemical shape treatment"

natur plus a chemical shape treatment rejects.

Credible regression / gap: Allow natural and treated states simultaneously on write.

Owner: `validators.ts:52-66`. retain unchanged at this existing boundary.

### R · L118 · "quiz schema accepts 50-character concern notes and rejects longer text"

The exact 50-character boundary accepts, while 51 rejects.

Credible regression / gap: Use an off-by-one text maximum or remove the length check.

Owner: `validators.ts:18-40`. retain unchanged at this existing boundary.

### R · L132 · "quiz schema accepts all eight shared goals and historical stored goal values"

All eight shared goals and valid legacy goals parse; duplicate goals reject.

Credible regression / gap: Keep an obsolete count cap, drop legacy values, or permit duplicate goals.

Owner: `validators.ts:18-105`. retain unchanged at this existing boundary.

### R · L160 · "quiz schema rejects unknown goal values"

Unknown goal values reject on a complete otherwise valid record.

Credible regression / gap: Widen goal vocabulary to arbitrary strings.

Owner: `validators.ts:18-40`. retain unchanged at this existing boundary.

### R · L169 · "quiz schema rejects volume + less_volume together"

Opposing volume and less_volume reject on write.

Credible regression / gap: Remove the mutual-exclusion check.

Owner: `validators.ts:90-103`. retain unchanged at this existing boundary.


## tests/quiz-draft.test.ts

### R · L41 · "quiz draft stores only restorable quiz answers and progress"

Raw serialized draft contains only version, time, step, allowed answers and package metadata; separate lead identity is absent and load round-trips the asserted fields.

Credible regression / gap: Spread the whole input/lead into browser storage.

Owner: `draft.ts:87-143`. retain unchanged at this existing boundary.

### R · L76 · "quiz draft resumes post-lead quiz states from lead capture instead of storing PII"

Saving post-lead step 10 with complete answers stores resumable step 9 and excludes lead identity.

Credible regression / gap: Resume a client draft at an access/result screen requiring a server lead.

Owner: `draft.ts:50-56,87-103`. retain unchanged at this existing boundary.

### R · L93 · "stored post-lead quiz draft steps resume from lead capture"

Three existing stored post-lead steps (10/11/14) read as step 9 with the complete answer fixture.

Credible regression / gap: Preserve post-lead progress rather than restart lead capture.

Owner: `draft.ts:50-56,105-143`. retain unchanged at this existing boundary.

### R · L114 · "stored quiz drafts can resume at the hair length question"

A legacy draft already on hair-length step 15 preserves that step and prior answers.

Credible regression / gap: Move an in-progress hair-length question backward or drop existing facts.

Owner: `draft.ts:50-56,105-143`. retain unchanged at this existing boundary.

### R · L141 · "legacy quiz drafts after density resume at hair length when hair length is missing"

Ten later legacy steps missing hair length rewind to question 15.

Credible regression / gap: Trust later historical progress despite the missing required question.

Owner: `draft.ts:13-16,50-56,105-143`. retain unchanged at this existing boundary.

### R · L165 · "stored quiz draft answers are normalized before restore"

Restore normalizes legacy values, strips unsupported fields and resolves malformed/conflicting arrays.

Credible regression / gap: Rehydrate untrusted saved answers without normalization.

Owner: `draft.ts:58-69,105-143`. retain unchanged at this existing boundary.

### R · L196 · "expired quiz drafts are ignored and removed"

An expired saved draft returns null and its storage entry is removed.

Credible regression / gap: Return expired data or leave it repeatedly discoverable.

Owner: `draft.ts:124-126,145-151`. retain unchanged at this existing boundary.

### R · L213 · "invalid quiz draft steps are ignored and removed"

An impossible saved step returns null and removes the malformed entry.

Credible regression / gap: Accept an unknown screen or leave a bad record in storage.

Owner: `draft.ts:71-84,117-122`. retain unchanged at this existing boundary.

### R · L230 · "clearing a quiz draft removes the browser entry"

Explicit clear removes the existing browser entry.

Credible regression / gap: Turn clear into a no-op.

Owner: `draft.ts:145-151`. retain unchanged at this existing boundary.

### R · L239 · "quiz store saves the completed page draft when advancing"

Actual store goNext persists step 3 with completed answers and null package but no name/email/lead ID.

Credible regression / gap: Persist the old step or leak store lead state while advancing.

Owner: `store.ts:64-79; draft.ts:87-103`. retain unchanged at this existing boundary.

### R · L266 · "quiz store applies verified partner identity and consent mode atomically"

Verified partner identity atomically sets mode, consent substep and lead identity; reset returns mode/substep to regular/name.

Credible regression / gap: Apply identity without locking the journey, or keep the lock after reset.

Owner: `store.ts:106-111,150-155`. retain unchanged at this existing boundary.

### R · L295 · "quiz drafts record the funnel package the progress belongs to"

Raw save writes schema version 2, exact insert step 16 and scan package; load reads the same step/package.

Credible regression / gap: Write v1 or omit package metadata while the store still restores under its current package.

Owner: `draft.ts:87-143`. retain unchanged at this existing boundary.

### R · L319 · "legacy version 1 quiz drafts still restore"

A raw version-1 record without package metadata remains readable with null package and exact facts.

Credible regression / gap: Drop backward compatibility or synthesize the wrong stored package.

Owner: `draft.ts:7-10,71-84,105-143`. retain unchanged at this existing boundary.

### R · L342 · "insert drafts without a hair length still resume at the hair length question"

Both later insert steps 17/18 with missing hair length rewind to 15.

Credible regression / gap: Exclude inserts from missing-length recovery.

Owner: `draft.ts:13-16,50-56`. retain unchanged at this existing boundary.

### R · L393 · "a scan draft on an insert restores to the insert inside the scan package"

Real store restore under scan retains insert 16 and current scan package.

Credible regression / gap: Normalize every insert away even when the current package owns it.

Owner: `store.ts:133-149; screen-order.ts:144-165`. retain unchanged at this existing boundary.

### R · L410 · "a scan draft on an insert restores to the preceding question when the quiz is organic"

A saved scan insert 17 under organic restores to preceding scalp step 6, current null package, and scalp answer.

Credible regression / gap: Reuse stored package authority or land on an insert unavailable to organic.

Owner: `store.ts:133-149; screen-order.ts:144-165`. retain unchanged at this existing boundary.

### R · L421 · "an organic draft keeps its step when the quiz runs the scan package"

An organic saved step 8 under scan remains step 8 with the current scan package.

Credible regression / gap: Restart progress merely because attribution changed.

Owner: `store.ts:133-149; screen-order.ts:144-165`. retain unchanged at this existing boundary.

### R · L431 · "a legacy draft restores its answers under the current funnel package"

A legacy record restores facts and step 12 under the current scan package.

Credible regression / gap: Prefer absent historical package metadata over the current server-established package.

Owner: `store.ts:133-149; draft.ts:126-143`. retain unchanged at this existing boundary.


## tests/quiz-screen-order.test.ts

### R · L65 · "the organic screen order is byte-identical to the constants it replaced"

Null/default/unknown packages retain exact organic screen, step, motion and regular/locked history orders.

Credible regression / gap: Activate scan inserts for unknown packages or change organic ordering.

Owner: `screen-order.ts:8-110`. retain unchanged at this existing boundary.

### R · L83 · "the scan package inserts three screens after density, scalp and goals"

Scan screen/step/motion orders place all three inserts at their exact existing positions.

Credible regression / gap: Misplace or omit an insert in a public ordering API.

Owner: `screen-order.ts:30-92`. retain unchanged at this existing boundary.

### R · L89 · "the scan history order expands lead capture and keeps the partner filter"

Scan regular history contains each named lead substep and all exact screens; locked history has one lead screen and the exact step sequence.

Credible regression / gap: Duplicate identity screens or drop an insert during locked-mode history construction.

Owner: `screen-order.ts:54-110`. retain unchanged at this existing boundary.

### R · L127 · "browser history positions strictly increase along the scan screen order"

Browser-history positions increase through scan order, including explicit density-to-insert ordering.

Credible regression / gap: Use numeric step IDs instead of package order for history position.

Owner: `browser-history.ts:13-24; screen-order.ts:94-110`. retain unchanged at this existing boundary.

### R · L151 · "the question sequence is untouched by the inserts"

Original question numbers and total question order remain exact; inserts are not questions.

Credible regression / gap: Count an inserted marketing screen as a diagnostic question.

Owner: `questions.ts:4-18; screen-order.ts:112-124`. retain unchanged at this existing boundary.

### R · L179 · "progress on an insert stays on the state of the preceding question"

Each insert inherits the previous question progress; all ordinary/lead steps remain identity-mapped across packages.

Credible regression / gap: Advance the progress bar on an insert or regress regular step progress.

Owner: `screen-order.ts:126-142`. retain unchanged at this existing boundary.

### R · L193 · "a step that the current package does not run falls back to the preceding question"

Foreign insert steps normalize to preceding compatible questions; existing package members stay unchanged and all results belong to the selected order.

Credible regression / gap: Map a foreign step to an unavailable screen or reset compatible progress.

Owner: `screen-order.ts:144-165`. retain unchanged at this existing boundary.

### R · L219 · "the scan store walks forward through the inserts"

Actual Zustand forward transitions cross each insertion boundary and lead transition.

Credible regression / gap: Keep pure order correct but use the wrong order or offset in goNext.

Owner: `store.ts:36-39,64-79`. retain unchanged at this existing boundary.

### R · L237 · "the scan store walks back through the inserts"

Actual Zustand backward transitions cross each insertion boundary.

Credible regression / gap: Implement goBack with forward order arithmetic or skip an insert.

Owner: `store.ts:42-45,80`. retain unchanged at this existing boundary.

### R · L255 · "an organic store never produces an insert screen"

Actual organic store traversal never reaches inserts and still reaches core/lead/result steps.

Credible regression / gap: Let the store use scan order for ordinary attribution.

Owner: `store.ts:36-39,64-79`. retain unchanged at this existing boundary.

### R · L278 · "changing the package key normalizes an incompatible current step"

Changing package while on scan insert 17 immediately normalizes to organic step 6.

Credible regression / gap: Update attribution without reconciling incompatible current progress.

Owner: `store.ts:122-128`. retain unchanged at this existing boundary.

### F · L288 · "insert screens are excluded from the per-step quiz_step_viewed event"

Runtime predicate excludes inserts and includes ordinary steps; source snippets additionally couple actual page wiring to local identifier spelling.

Credible regression / gap: Rename shouldTrackQuizStepViewed at import/use without changing behavior and the grep fails; conversely a disconnected matching source fragment can remain green.

Owner: `screen-order.ts:167-169; src/app/quiz/page.tsx:319-324`. unchanged; F repairs are deferred with zero credit.


## tests/quiz-preparation.test.ts

### F · L25 · "preparation prefetches the result route only from the commitment handler"

The intended contract is no speculative offer render before commitment. Current check counts literal router.prefetch and compares source positions between prop names.

Credible regression / gap: A router identifier-only rename fails; prefetch between the textual props but in a different expression may pass without proving tap ownership.

Owner: `src/components/quiz/quiz-preparation.tsx:261-268`. unchanged; F repairs are deferred with zero credit.

### R · L40 · "preparation waits for a lead and the client auth session"

Readiness remains false without a lead or during auth loading.

Credible regression / gap: Reveal before a lead/auth session exists.

Owner: `src/components/quiz/quiz-preparation.tsx:70-85`. retain unchanged at this existing boundary.

### R · L63 · "anonymous and already-entitled sessions are ready without an extra access request"

Anonymous and profile-entitled states need no extra check key before readiness. It asserts gate policy, not actual fetch count.

Credible regression / gap: Block anonymous or already-entitled visitors waiting for a needless check.

Owner: `src/components/quiz/quiz-preparation.tsx:70-85`. retain unchanged at this existing boundary.

### R · L86 · "signed-in sessions without profile access wait for the matching server check"

Signed-in no-access state exposes exact user:lead check key and remains unready for missing/mismatched receipt, ready only for matching receipt.

Credible regression / gap: Reuse another lead access-check completion.

Owner: `src/components/quiz/quiz-preparation.tsx:70-85`. retain unchanged at this existing boundary.

### R · L101 · "a stalled access check settles after a bounded timeout"

With a never-settling injected fetch, one millisecond before the configured timeout does not abort/settle; at the boundary it aborts and settles once.

Credible regression / gap: Abort/settle early or never settle a stalled check.

Owner: `src/components/quiz/quiz-preparation.tsx:29-67`. retain unchanged at this existing boundary.

### R · L125 · "access-check cleanup aborts work without marking it settled"

Explicit cleanup aborts but never reports readiness after the timeout.

Credible regression / gap: Treat unmount cancellation as successful access settlement.

Owner: `src/components/quiz/quiz-preparation.tsx:29-67`. retain unchanged at this existing boundary.

### R · L147 · "result artifact delivery starts once after preparation settles"

Artifact trigger predicate rejects unsettled and already-triggered same-lead states and permits settled fresh-lead state. Actual fetch delivery/exactly-once across mounts is outside these assertions.

Credible regression / gap: Trigger early or ignore previouslyTriggeredLeadId in the policy.

Owner: `src/components/quiz/quiz-preparation.tsx:88-98,199-219`. retain unchanged at this existing boundary.

### R · L174 · "missing-lead recovery returns to the earliest incomplete lead field"

Missing name recovers to name; a present name recovers to email.

Credible regression / gap: Always send recovery to email or discard a completed name.

Owner: `src/components/quiz/quiz-preparation.tsx:111-113`. retain unchanged at this existing boundary.

### R · L179 · "preparation threads retake mode and return destination into the canonical result"

Result path preserves encoded lead, retake mode and safe return destination; missing lead returns null.

Credible regression / gap: Drop retake destination or construct an unencoded lead path.

Owner: `src/components/quiz/quiz-preparation.tsx:121-135; result-navigation.ts:31-48`. retain unchanged at this existing boundary.


## tests/quiz-need-lane.test.ts

### R · L98 · `need lane: ${fixture.name}`

Fourteen cases isolate colored-only, treatment/corroboration, stretch/snap, concern/goal, scalp and negative base rules.

Credible regression / gap: Use treatment or stretch alone as enough for a repair lane, or change a tested rule/precedence.

Owner: `need-lane.ts:92-154`. retain unchanged at this existing boundary.

### R · L103 · "bond repair wins when overlapping mask and surface signals are present"

Bleach plus explicit damage beats simultaneously present protein/moisture/surface signals.

Credible regression / gap: Evaluate a weaker mask or surface branch before bond repair.

Owner: `need-lane.ts:113-152`. retain unchanged at this existing boundary.


## tests/quiz-result-routing.test.ts

### R · L12 · "no-access quiz results redirect to the canonical result route"

Unentitled settled legacy result constructs the encoded canonical completion result URL.

Credible regression / gap: Use raw lead characters or omit completion attribution.

Owner: `src/components/quiz/quiz-results.tsx:42-54`. retain unchanged at this existing boundary.

### R · L24 · "result redirect waits for a lead and completed access checks"

Missing lead, auth pending, or signed-in subscription check pending each suppress redirect.

Credible regression / gap: Navigate on incomplete authority or missing identity.

Owner: `src/components/quiz/quiz-results.tsx:42-54`. retain unchanged at this existing boundary.

### R · L54 · "active subscribers keep the direct routine path"

An entitled session does not take the result redirect path.

Credible regression / gap: Redirect a direct-routine session back into the commercial result flow.

Owner: `src/components/quiz/quiz-results.tsx:42-54`. retain unchanged at this existing boundary.

### F · L66 · "result email links retain offer focus and receive a dedicated entry context"

Intended email focus and result_email attribution are guarded only through exact local declarations/prop identifier expressions.

Credible regression / gap: Rename focus/personalPlanFocusTarget/entry while preserving behavior and the grep fails; actual rendered target/entry is unobserved.

Owner: `src/app/result/[leadId]/page.tsx:322-376,570-580`. unchanged; F repairs are deferred with zero credit.


## tests/quiz-email-return-selection.test.ts

### R · L18 · "email matching is normalized and chooses the newest completed record across quiz kinds"

Normalized mixed-case email selects the newest saved record across legacy and personal-plan kinds.

Credible regression / gap: Compare email case-sensitively or prefer quiz kind over creation time.

Owner: `email-return-credential.ts:85-119`. retain unchanged at this existing boundary.

### R · L35 · "selection breaks equal submission timestamps by id and rejects drafts or unsupported records"

Equal timestamps use descending ID; newer null/empty answers, unsupported kind and another email are ineligible.

Credible regression / gap: Ignore an eligibility gate or change deterministic tie-break direction.

Owner: `email-return-credential.ts:89-119`. retain unchanged at this existing boundary.

### F · L72 · "a supplied lead id remains bound even if a newer lead later exists"

Two pure selections choose different newest leads; an earlier returned object retains its ID. This never issues or resolves a persisted capability.

Credible regression / gap: Change redemption to choose the newest lead instead of source_lead_id: all assertions remain green.

Owner: `email-return-credential.ts:100-119,179-223,281-317`. unchanged; F repairs are deferred with zero credit.


## tests/quiz-email-return-choice.test.ts

### R · L11 · "Continue binds the exact saved lead to a fresh email session, without quiz completion"

Actual Continue handler emits one landing event with exact source lead/package/choice, returns exact result destination, signs matching session ID, and clears edit cookie.

Credible regression / gap: Bind a different lead or dispatch quiz-completed, use a different signed session, or keep an edit capability.

Owner: `src/app/api/quiz/email-return/choose/route.ts:62-159`. retain unchanged at this existing boundary.

### R · L69 · "Edit creates an unbound session and returns only prefilled quiz answers"

Actual Edit handler records null lead, filters invalid length from saved facts, returns only prefill and copies source capability into edit cookie.

Credible regression / gap: Bind the old lead to an edit session or leak invalid saved facts/identity into response.

Owner: `src/app/api/quiz/email-return/choose/route.ts:94-159; email-return-prefill.ts:7-14`. retain unchanged at this existing boundary.


## tests/quiz-email-return-edit.test.ts

### R · L18 · "Edit context returns token-bound identity only for the email-return funnel session"

Actual context response projects only name/email/consent from injected verified identity; parser normalizes email, consent inheritance requires matching email and no prior rejection.

Credible regression / gap: Leak source IDs/timestamp or inherit consent for another/rejected email. Identity verification itself is stubbed, not proven.

Owner: `src/app/api/quiz/email-return/context/route.ts:36-76; email-return-edit.ts:7-41`. retain unchanged at this existing boundary.

### R · L49 · "Edit context withholds identity before an email-return choice session exists"

Missing email-return funnel context returns invalid and performs zero identity reads despite matching cookie values.

Credible regression / gap: Read or return identity before a choice session exists.

Owner: `src/app/api/quiz/email-return/context/route.ts:48-58`. retain unchanged at this existing boundary.

