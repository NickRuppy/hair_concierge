# Discovery consult/PDF61: complete per-site declaration ledger

READ-ONLY proposal. R=60, F=0, C=1, D=0. All 61 AST registration sites and full helper/fixture bodies read. The two registration tables expand to 7 malformed-body + 4 generator-error tests: anticipated native count 70, not executed. Internal loops do not create sites. No deletion credited.

All exact titles and complete callbacks are in `/tmp/test-audit-discovery-consult-pdf61-declarations.json`; full files for every phase are in `/tmp/test-audit-discovery-consult-pdf61-snapshots/`. No skipped rows, new inputs, owner calls or assertions. All 302 original assertion call sites survive proposed cut.

## R — tests/discovery-consult-brief-api.test.ts:244

`a cross-origin or origin-less request is refused before the admin gate`

Readset/input: evil/null Origin; request counters.

Origin rejection before admin/LLM/storage; moving or deleting origin guard admits cross-site writes.

## R — tests/discovery-consult-brief-api.test.ts:271

`the kill switch hides the endpoint, and the shared admin gate's refusal is passed through`

Readset/input: flag false; admin 401/403.

Endpoint hiding and exact shared-admin refusal; anonymous denial alone does not prove flag branch.

## R — tests/discovery-consult-brief-api.test.ts:303

`an unknown enrollment is a 404 and nothing is generated or written`

Readset/input: missing intake.

Unknown enrollment stops source/generation/storage; default happy fixture never reaches absence.

## R — tests/discovery-consult-brief-api.test.ts:328

``a malformed body is refused before any generation: ${name}``

Readset/input: 7 malformed body rows.

Strict expected_state/force/server-field schema and JSON parse fail closed; each row changes a distinct validation predicate.

## R — tests/discovery-consult-brief-api.test.ts:340

`a first generation on a legacy enrollment (no row) writes a full row with the agent brief`

Readset/input: no existing row; traced generator; recording client.

First-generation full upsert defaults, stamps, source hash, parsed response and previous=null; regeneration starts with existing values and cannot replace these defaults.

## R — tests/discovery-consult-brief-api.test.ts:378

`a regeneration keeps the other fields and moves the stored brief to `previous``

Readset/input: existing full sheet and old previous.

Preserves unrelated fields and truncates revision history to one level; first-generation path has no prior state.

## R — tests/discovery-consult-brief-api.test.ts:407

`R15 end to end: generate, then a manual slice-1 save keeps the revision`

Readset/input: real generate route → real manual PATCH → generate.

Manual sections survive revision preservation/server stamping across both writers; mocked generated output does not manufacture actual save merge.

## R — tests/discovery-consult-brief-api.test.ts:449

`R14: a draft intake is refused (422 draft_intake) before any read or generation`

Readset/input: draft intake.

422 draft admission before reads; finalized and submitted inputs cannot catch accidental draft generation.

## R — tests/discovery-consult-brief-api.test.ts:465

`no freeze: a finalised call still generates`

Readset/input: finalized submitted intake.

Generation remains legal after finalization; adding an inappropriate freeze guard would fail only this route input.

## R — tests/discovery-consult-brief-api.test.ts:478

`a stale expected_state is a 409 with the current state — before any LLM call`

Readset/input: null/hash/generated_at/saved_at mismatches; stored-null case.

Pre-generation optimistic conflict state plus no LLM/write; write-time reread tests have initially matching state and cannot own this.

## R — tests/discovery-consult-brief-api.test.ts:516

`a brief stored before saved_at existed matches an expected_state with saved_at null`

Readset/input: legacy saved_at absent matched by null.

Backwards compatibility for stored pre-stamp briefs; strict PATCH stamp rejection is a separate trust boundary.

## R — tests/discovery-consult-brief-api.test.ts:526

`force overwrites a mismatching brief on purpose and keeps it as `previous``

Readset/input: force=true initial mismatch.

Explicit overwrite preserves current revision and sheet fields; non-force conflict intentionally refuses.

## R — tests/discovery-consult-brief-api.test.ts:551

`a manual save (unchanged generated_at/source_hash) while the LLM ran is a 409 at write time`

Readset/input: manual PATCH inside generator callback; force absent.

Post-LLM reread detects manual edit using server saved_at and returns 409; initial conflict cannot catch interleaving.

## R — tests/discovery-consult-brief-api.test.ts:574

`with force, a manual save made while the LLM ran becomes the revision (never lost)`

Readset/input: manual PATCH inside generator callback; force=true.

Forced overwrite records latest manual edit as previous; initial force test has no intervening edit.

## R — tests/discovery-consult-brief-api.test.ts:588

`saved_at is server-owned: a PATCH that tries to set it is refused`

Readset/input: manual PATCH contains saved_at.

Client cannot forge server concurrency stamp; regeneration tests contain no malicious supplied stamp.

## R — tests/discovery-consult-brief-api.test.ts:603

``a generator error (${reason}) is a ${status} with a German message and no write``

Readset/input: 4 generator-error rows: llm_failed/invalid_json/invalid_schema/lint_failed.

Transport status, reason, German copy and lint findings forwarding with zero saves; generator-lint tests alone do not exercise HTTP/storage policy.

## R — tests/discovery-consult-brief-api.test.ts:642

`an unreadable source or a plan that cannot be read is a 503 without generation`

Readset/input: throwing source and two unavailable source statuses.

503 with no generation on read degradation; successful-source generator failures reach another owner branch.

## R — tests/discovery-consult-brief-api.test.ts:672

`a failed write is a 503, never a silent success`

Readset/input: saveCallSheet throws.

Persistence failure must never produce success; read failures occur before write and cannot own this.

## R — tests/discovery-consult-brief-api.test.ts:734

`loadConsultBriefSource assembles exactly what the page's parts give consultBriefSource`

Readset/input: real loadConsultBriefSource with recorded dependency identities.

Loader uses correct user/intake/enrollment keys and same assembly as page; direct pure source has no loader wiring.

## R — tests/discovery-consult-brief-api.test.ts:774

`consultBriefSource: the quiz and the baseline move the hash; the rest of the sheet does not`

Readset/input: ready/missing/unready quiz, baseline variations, irrelevant sheet text.

Source fingerprint reads quiz and baseline but excludes sheet annotations/current brief; raw input hash tests do not exercise source projection.

## R — tests/discovery-consult-brief-api.test.ts:804

`loadConsultBriefSource: a plan that cannot be read is a status; a failed read throws`

Readset/input: unavailable model and thrown lead/sheet reads.

Unavailable model returns status before sheet read; exceptions propagate rather than hash partial source. Other API tests replace this loader.

## R — tests/discovery-consult-input.test.ts:236

`snapshot facts: concerns, scalp concerns, heat tools, wash cadence, hair-loss boundary`

Readset/input: complete snapshot facts.

Exact concern/scalp/heat/current-vs-ideal wash/boundary projection; assembler fixtures already carry these facts and cannot catch snapshot wiring errors.

## R — tests/discovery-consult-input.test.ts:265

`snapshot facts: unreadable = unknown, heat absent = no tools`

Readset/input: null/unreadable snapshot; absent heat.

Unknown vs empty defaults: absence must not fabricate heat tools/boundary facts; complete snapshot cannot reach defaults.

## R — tests/discovery-consult-input.test.ts:288

`Nomi: profile, main problem with recipe excerpt, fired entries, heat, wash change`

Readset/input: deep-frozen Nomi source+baseline4.

Exact profile/recipe/knowledge selection and question-first flags, heat/wash and no mutation; recorded golden source is a different fixture and opaque hash pin cannot replace named domain assertions.

## R — tests/discovery-consult-input.test.ts:336

`seeding flags come from the snapshot profile: texture, scalp oiliness, scalp concerns`

Readset/input: modified texture/scalp/concerns.

Concrete seeded flags and folded dry-lengths knowledge; Nomi lacks oily/curly/frizz/shine predicates.

## R — tests/discovery-consult-input.test.ts:394

`unknown texture and scalp facts derive none of the seeding flags`

Readset/input: null texture/scalp facts.

Unknown facts derive no seeded flags; positive fixture cannot catch default-true inference.

## R — tests/discovery-consult-input.test.ts:422

`products per entry: name, verdict, decisionKey, bucket — plus swap options and research`

Readset/input: Nomi with baseline null, product and research fixture.

Ordered per-entry product buckets, verdicts, aliases, swap options and missing-score/research checklist; happy profile assertions do not inspect this output union.

## R — tests/discovery-consult-input.test.ts:476

`no evidence or confidence grade reaches the text context`

Readset/input: whole assembled context JSON serialization.

Evidence/confidence exclusion across whole context. Same Nomi source appears elsewhere but no keeper currently serializes and checks whole object; no new observer call proposed.

## R — tests/discovery-consult-input.test.ts:483

`hair loss concern or boundary assessment is a G2 trigger`

Readset/input: hair-loss concern OR snapshot boundary separate inputs.

Either source must raise G2 trigger while recipe boundary persists; benign Nomi cannot cover either trigger.

## R — tests/discovery-consult-input.test.ts:506

`without a quiz the concerns come from the plan snapshot; one concern is the main one`

Readset/input: quiz omitted, singleton lost_shape snapshot.

Fallback uses snapshot concerns/main concern and selects expectation knowledge; all ready-quiz fixtures bypass fallback.

## R — tests/discovery-consult-input.test.ts:523

`a legacy model without the new facts assembles with unknowns, never throws`

Readset/input: legacy empty model/view.

Absence defaults produce minimal context without inventing facts or throwing; no complete fixture substitutes.

## R — tests/discovery-consult-input.test.ts:549

`identical inputs hash the same; key order is irrelevant`

Readset/input: identical input repeat and reversed object keys.

Canonical key-order-insensitive 64-hex fingerprint; change-sensitivity tests do not exercise equivalence.

## R — tests/discovery-consult-input.test.ts:560

`a verdict change, a finished research, a score change each move the hash`

Readset/input: verdict/research/score5/nullscore separate changes.

Each meaningful content change invalidates hash; equality test cannot catch omitted hash fields.

## R — tests/discovery-pdf-page.test.tsx:360

`the kill switch and the admin gate hide the document rather than explain it`

Readset/input: flag/admin401403/enrollment null.

Not-found digest protects document hiding at three distinct entry predicates; renderer-only checks bypass admission.

## R — tests/discovery-pdf-page.test.tsx:386

`the render gate: only a finalised call has a document`

Readset/input: unfinalized/null intake/no source/unavailable/research/guidance cases.

Cockpit redirects for unprintable states, preserving exact redirect digest rather than any throw; happy renderer cannot prove admission.

## R — tests/discovery-pdf-page.test.tsx:434

`research gate (F1/F4): a product the runsheet shows inside its category still sends the PDF back`

Readset/input: research item joined into runsheet category.

Display join must not erase unresolved research from PDF gate; tests of raw unassigned research do not perform the join.

## R — tests/discovery-pdf-page.test.tsx:463

`a brand-only catalog change after finalising trips the drift banner`

Readset/input: Garnier/GARNIER FRUCTIS/Fructis Lab catalog names.

Fingerprint uses printed normalized label: casing/embedded brand unchanged, material brand change drift. Product-line and missing-brand tests exercise different label predicates.

## R — tests/discovery-pdf-page.test.tsx:489

`unreadable recommendation brands send the PDF back to the cockpit`

Readset/input: recommendationBrandsAvailable=false.

Degraded brand lookup refuses printing; brand-present success never reaches this flag.

## R — tests/discovery-pdf-page.test.tsx:497

`a brandless catalog name reads with its brand on the paper`

Readset/input: brandless catalog name+Schwarzkopf brand.

Printed recommendation restores catalog brand; brand-only drift test begins with already-branded name.

## C — tests/discovery-pdf-page.test.tsx:527

`the document is written to the participant, step by step`

Readset/input: default await renderPdf().

C1: move all 22 assertions verbatim to shelf callback after its identical default render; retained union covers participant copy, product labels, exact open count/cadence/CSS.

## R — tests/discovery-pdf-page.test.tsx:570

`the shelf says what happens to every product she brought`

Readset/input: default await renderPdf(); then existing separate pending document render.

C1 keeper: existing shelf outcomes plus independent barcode-pending safety net stay intact; receive donor block on first markup before pending render.

## R — tests/discovery-pdf-page.test.tsx:612

`the date is the one she lived, not the one UTC stored`

Readset/input: 2026-09-22T22:30Z→Berlin23.09.

Civil date at timezone day rollover; default noon date cannot catch UTC slicing.

## R — tests/discovery-pdf-page.test.tsx:628

`a routine that moved since the finalisation says so, and never re-derives in silence`

Readset/input: different/matching/missing finalizedSourceHash.

Warn on drift while rendering, suppress banner only on exact match, retain print:hidden banner; catalog-change tests alone do not reach missing stamp.

## R — tests/discovery-pdf-page.test.tsx:678

`every print:hidden wrapper is a contents box with no responsive display utility`

Readset/input: 3 actual chrome sources, every print:hidden class.

Print wrappers must be contents and lack competing responsive display utilities; page factory renderer omits app/admin layouts and widgets entirely.

## R — tests/discovery-pdf-page.test.tsx:695

`the paper names products with their line, and that label is the fingerprinted one`

Readset/input: HydroCare product line with stale prior hash.

Printed catalog line and hash drift remain coupled; brand tests do not read productLine.

## R — tests/discovery-consult-eval.test.ts:56

`golden profiles assemble through consultBriefSource with valid heat answers`

Readset/input: all4 golden profiles and production heat parser.

Fixture shapes/domain flags/hash pathway stay valid for live eval consumers; not test-only fixture retirement, scripts/eval-consult-brief/run.ts imports same profiles.

## R — tests/discovery-consult-eval.test.ts:70

`the recorded answer is not stale: same prompt version, same input hash — else re-record`

Readset/input: recorded raw metadata vs actual golden source hash/version.

Generated artifact freshness; valid generator output on stale input is not equivalent proof.

## R — tests/discovery-consult-eval.test.ts:78

`the recorded real answer passes the generator's parse, schema and lint path`

Readset/input: recorded raw injected only as completion; actual generator.

End-to-end parse/schema/lint/postprocessing and deterministic boundary/source hash; eval helper independently processes raw and cannot replace generator control flow.

## R — tests/discovery-consult-eval.test.ts:99

`the eval's checks find nothing in the recorded answer (JSON mode: a bare object)`

Readset/input: recorded raw through actual eval checker.

Eval has additional product, language, lever and boundary checks; generator successful result does not prove eval accepts its known fixture.

## R — tests/discovery-consult-eval.test.ts:105

`the eval's checks catch broken answers`

Readset/input: broken raw JSON/schema/points/brand/foreign-product/language matrix.

Eval-specific detection branches with named expected finding; pure lint misses independent language and product heuristics.

## R — tests/discovery-consult-eval.test.ts:200

`with a hair-loss trigger, a loss sentence naming a product is flagged`

Readset/input: curly hair-loss input+loss sentence names known product.

Eval medical product-sentence check depends on trigger; benign raw fixture cannot catch disabling it.

## R — tests/discovery-consult-eval.test.ts:208

`a prompt-contract bump makes every stored brief stale (Codex review, v4)`

Readset/input: default promptversion/current versus oldv3.

Output contract version invalidates stored hash independently of input changes; metadata freshness pins one version only.

## R — tests/discovery-pdf-images.test.tsx:172

`the composition carries each printed product's packshot — and only where it prints`

Readset/input: 5 printed products+nonapplicable slots.

Composition places image fields only where printed; renderer normalizes absent fields to null, so output visibility cannot replace presence/absence contract.

## R — tests/discovery-pdf-images.test.tsx:191

`no images → the exact hash of the composition without the image input (legacy-stable)`

Readset/input: omitted image map versus empty map.

Legacy exact hash stability and omitted optional fields; has-image renderer never observes canonical omission.

## R — tests/discovery-pdf-images.test.tsx:202

`a printed image moves the fingerprint; an image nobody prints does not`

Readset/input: printed URL changed versus unused ID.

Only semantically printed image changes invalidate fingerprint; base image presence does not prove hash sensitivity or exclusion.

## R — tests/discovery-pdf-images.test.tsx:216

`only http(s) packshots are printable`

Readset/input: https/http/javascript/null/malformed identities.

Safe printable URL protocol filtering; images fixture with valid URLs cannot catch admitting script URLs.

## R — tests/discovery-pdf-images.test.tsx:245

`the PDF shows the packshot next to every product: routine, shelf and „Brauchst du nicht mehr“`

Readset/input: real document of image-bearing composition.

Five image output instances including kept product twice; decorative alt/fixed box/object containment markup. Composer tests cannot catch renderer dropping image.

## R — tests/discovery-pdf-images.test.tsx:265

`a product without a packshot gets a quiet placeholder, never a broken image`

Readset/input: same composition without images.

No broken img and six placeholders; valid-image test cannot catch empty-source img branch.

## R — tests/discovery-pdf-usage.test.tsx:80

`F6: a kept conditioner used as a mask reads „als Haarmaske benutzt“ at its step and on the shelf`

Readset/input: conditioner typed as mask usage plus pending leave-in.

Usage wording appears in routine+shelf+pending product and view projection; default PDF has no explicit productType/usage mismatch.

## R — tests/discovery-pdf-usage.test.tsx:102

`F6: a legacy (tile) document prints no usage note at all`

Readset/input: legacy no productType.

No usage note and null view field while retaining product name; positive usage fixture cannot catch fabricated legacy label.

## R — tests/discovery-pdf-usage.test.tsx:109

`a product with an open usage never vanishes from the paper — it is a follow-up`

Readset/input: category null/name_research.

Open usage remains visible as follow-up, rather than dropped/vanished; known-category pending barcode reaches another unassigned reason.
