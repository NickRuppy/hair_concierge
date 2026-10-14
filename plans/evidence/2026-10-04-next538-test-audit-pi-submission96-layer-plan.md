# Product Intake submission/matching/lookup layer reassessment

## Decision and exact scope

**Five conditional C cuts, four F repairs identified, 87 R, zero D across 96 current AST sites.** No changes applied or tests run. The executable proposal transfers assertions first, preserves all 96 declarations, then removes five original submissions declarations: **96→96→91**. This is a reassessment of the earlier generic all-R operator ledger, not new whole-file read credit on top of that ledger.

Three complete files: `tests/product-intake-submissions.test.ts`51, `tests/product-intake-matching.test.ts`22, `tests/product-intake-lookup.test.ts`23. They were absent from current `git diff --name-only` at lane selection. No Tooling74, Premium/Option or already-changed504 callback is proposed for editing. Whole callback bodies, fixture objects, nested loops, imports and fake repository read in all three files. The full 96-site R/F/C/D ledger includes exact original title/line/body/SHA and a specific credible regression or weakness per declaration.

Artifacts:

- `/tmp/test-audit-pi-submission96-ledger.md` and `-ledger.json`: exhaustive 96-site verdicts/bodies/hashes.
- `/tmp/test-audit-pi-submission96-candidates.json`: exact five donor and keeper before/after bodies, plus operative-input evidence.
- `/tmp/test-audit-pi-submission96-transfer.diff` and `-cut.diff`: complete prospective test edits.
- `/tmp/test-audit-pi-submission96-manifest.json`: three original test hashes, 14 source/dependency guards, stage paths/hashes and candidates.
- `/tmp/test-audit-pi-submission96-controls.json`: nine actual-source fault proposals, unique current anchors, expected selected keeper assertions and commands. Not executed.
- Snapshots `/tmp/test-audit-pi-submission96-proposal-wbbqw2/{before,transfer,cut}.ts`.

The preparation script is **/tmp-only**, not an authorized main editor: `/tmp/test-audit-pi-submission96-prepare.cjs`. It reads repository bytes, builds and parses all prospective strings, verifies unchanged callbacks and writes only temporary artifacts. A guarded applying editor remains main's responsibility if accepted.

## C1–C5 full union

### C1 — eliminate the historical manual-success replay

Donor submissions:1845 `existing onboarding/chat submitProductIntake behavior is unchanged by the scan-anchor fix`; keeper:543 `matched manual intake links user usage to the existing product without creating a submission`.

Both create an empty fake, source onboarding, identical `manualInput()` parsed through onboarding schema, same USER_ID, same timestamp, same actual submitProductIntake invocation. The newer callback does not exercise chat despite its title. Both assert matched status, product-garnier-mask usage product and exactly one replace_usage_matched call. Existing keeper additionally checks matched product ID, null submission and usage submission, matched status and intake_dedupe catalog mode. Transfer the donor's sole extra assertion `result.source === "onboarding"` to that keeper. No new input/call/fixture.

Credible fault: actual matched return projects source chat. Proposed control changes exactly this owner return; old keeper lacked the source assertion. History: scan MVP96f9e71c added the replay after the original b4fb21f4 consolidation; no separately documented chat input or independent public contract is lost. Test-support/source cleanup: callback only. Risk low; count1.

### C2 — wrong-owner upload error owned by real route

Donor:823 `photo intake rejects image paths that do not belong to the user`; keeper:2047 `route handler returns controlled client error for wrong-user upload paths`.

Exact same user, source onboarding, photo/category mask/frequency weekly_1x/path `tmp/someone-else/front.jpg`, fresh repository. Real createProductIntakePostHandler chooses real onboarding schema and calls real submitProductIntake; actual `assertTemporaryUploadPathBelongsToUser` executes before any repository reads. Donor only asserts the German error regex. Keeper already asserts it in the actual error JSON plus HTTP400 and exact `product_intake_upload_owner_mismatch` code. No transfer is needed. A mock does not supply this error or response.

Credible fault: owner error message changed to Falscher Upload; selected existing route assertion must fail. The response/guard path is itself stronger than direct rejection, not a proxy returning a canned rejection. Both introduced in consolidated intake history b4fb21f4. No exported source removed. Risk low; count1.

### C3 — absent upload failure owned by real route

Donor:868 `photo intake verifies tmp uploads exist before creating submission rows`; keeper:2081 `route handler returns controlled expired response for missing tmp uploads`.

Both existing bodies supply same valid photo/category/frequency/user and empty uploadedPaths. Donor path ends guessed.jpg, keeper ends missing.jpg. Actual path owner reads only current tmp/user prefix and absence of `..`; real verifier passes the exact path to dependency; fake uploadedPaths.includes(path) is false for both. No suffix policy or extension branch runs before this rejection. This is operative equivalence, not literal equality.

Route already asserts410, exact expired code and the same Upload nicht gefunden regex. Transfer complete donor suffix: `fake.calls === [verify_image:tmp/${USER_ID}/missing.jpg]`, submissions length0 and usage null, using keeper's existing filename. Do not replace keeper input with donor input. No new call/row. Fault disables actual front false-existence rejection; fake commit then fails for missing source and real route500 must fail expected410. Ordering/no-write assertions are carried verbatim in structure; this fault does not separately prove each trace assertion.

History: both from b4fb21f4 same upload error boundaries. Support/source deletion none. Risk low/moderate because status and no-write proofs must both remain. Count1.

### C4 — ordinary photo success absorbed by hostile-validation success

Donor:666 `photo intake creates a pending submission with image paths and uncertain validation`; keeper:779 `photo intake persists only server-derived uncertain validation state`.

Same source, user, timestamp, photo mode, category/frequency, front.jpg/barcode.jpg paths, absent brand/name, no existing usage. Keeper additionally supplies forged valid statuses/metadata and an exact upload list; donor fake is permissive for all tmp paths. For the two existing paths both fake verifications/commits succeed identically. Production `createPendingSubmission` reads input mode/path/category/frequency/identity; it unconditionally persists uncertain statuses and empty metadata, never trusts provided validation values. `buildIntakeHistory` reads validation-property *presence*, not client values: both parsed front status properties exist, while optional barcode status presence differs. Donor never asserts that barcode history property, so there is no claimed equality of whole parsed objects or whole unobserved histories.

Name the keeper's already-existing awaited result. Transfer donor's pending result/status, result/photo and persisted/photo mode, exact committed front and barcode paths, usage front path and pending usage status. Existing keeper already asserts both uncertain statuses and retains both empty metadata objects, timestamp and front history uncertain status. No extra parser/submit call or input. Literal committed path assertions remain relative to actual submission ID and are not replaced with expected values computed by production.

Actual controls: pending result mode→manual; actual insert front or barcode path→null; actual pending-adapter frontImagePath→null. These target real owner projections. `fake.usage.match_status` is supplied by the fake pending adapter; retaining it preserves the original assertion, **not new SQL enforcement proof**. No attempt to delete a SQL or repository test based on this fake. Both callback histories are b4fb21f4. No source deletion. Risk moderate; count1.

### C5 — parser passthrough observation at existing scan submission boundary

Donor:531 `scan intake schema is a passthrough validator: it trims the identifier value but does not normalize it`; keeper:1794 `scan submission normalizes the scanned identifier once before it is matched and persisted`.

Donor barcode value is `  ABC-123  `; keeper already supplies `  AB-12  `. Both are nonempty strings with outer spaces, uppercase ASCII and embedded hyphen; schema's `trimmedString` runs only typeof string/trim plus z.string().min(1). Neither character count nor letters/numeric values enter a different predicate. Production canonicalizeGtin rejects both as nondigit; it does not manufacture any additional uniqueness claim. The existing actual owner keeper already contains the parser call with its original input. Name this parsed object before the existing submit call and assert its literal value `AB-12`; retain the current independent expectedNormalized literal `ab-12` and stored-identifier assertion. No new parser call, owner call or input. This observes the protected intermediate boundary instead of losing it through an idempotent final normalization.

Actual controls lower-case or strip hyphen only in the real scan identifier schema. Premature lowercasing previously reached the same final ab-12; the new pre-owner literal must fail first. Premature hyphen strip also fails that assertion. Both histories are96f9e71c scan MVP. The word once in keeper title does not establish literal normalization invocation count; the observed contract is preserved raw schema value followed by normalized persisted value. No source deletion. Risk moderate; count1.

## Why the apparent larger matching layer is retained

Lookup is not a transparent matchProductIntake wrapper. `product-lookup.ts:632+` calls matching, then can recover an apparent exact result through `textLookupCandidates`/`findConfidentExactTextCandidate` even if the lower matcher stops returning matched. Therefore lookup169's nonrecommended exact result does **not** on its own replace matching480's direct matched status assertion. Adding a private reason assertion solely to force this hidden implementation path would increase implementation coupling; not proposed. Raw catalog or fixture differences alone did not decide retention.

Mixed single-hit, multiple same-category, cross-category-only, line-present versus absent, retailer provenance/type, punctuation/diacritics and GS1 spellings reach distinct predicates or expose distinct public matching result fields. Script operator `scripts/product-intake/review.ts:111` consumes candidate reason/confidence and IDs directly; submissions return match envelopes. These are not unused private helper replays. The ledger names the distinguishing fault per site. No test-only production seam deletion established.

Owned-product lookup191 and442 are **not duplicates**: eligibility ownsProduct explicitly branches on Set.has versus array.includes, both public supported input containers. Lookup510 title is wrong: products[6] is Oil Repair Shampoo/category shampoo, not wrong-category. Its real weak same-category generic-token negative is valuable. Mark F for accurate claim/decision on missing wrong-category coverage; do not cut or substitute a new fixture to claim reduction.

## F findings outside the five-cut diff

- submissions1369 cancellation ordering is implemented entirely by the fake; actual wrapper merely forwards user/category/now to cancelProductIntakeUsageForCategory and returns result. Preserve/repair the meaningful exact forwarding contract in the existing declaration; no actual SQL cancellation replay keeper found by bounded symbol search. Do not count a deletion or claim SQL ordering verified.
- submissions1458 and1539 fake findUserProductUsage does not log calls. Claimed forbidden usage reads can happen without failing, although write/submission assertions are meaningful. Existing same cases can instrument that dependency to throw or count exact calls; no new scenario needed. The five-C proposal leaves these four F callbacks unchanged.
- lookup510 title/input mismatch described above.

## Current reachability, history and CI

Real routes `src/app/api/product-intake/onboarding/route.ts` and chat/route.ts instantiate actual post handler; cancel handler delegates usage cancellation. Scanner route and mobile scan-submit service and discovery research invoke submitScanProductIntake. AgentV2 chat pipeline/product-lookup-turn-outcome and operator replay script call lookupProductCandidate. Operator review script calls matcher directly and exposes reasons/confidence. Canonical docs/product-intake-research-ops.md:56–70 still covers chat/onboarding user intake, review, user-usage linkage and notification. No retirement inference is used.

Recent history inspected: b4fb21f4 consolidated intake/continuity/security fixtures;96f9e71c scan MVP added passthrough+normalization+legacy-success replay; a4171b0b GTIN spelling variants;0e3a29ec scan hardening eligibility;7072124b dm enrichment;4f9938dd iOS identity/confirmation. Candidate-specific git-show excerpts confirm their origins. Current callback semantics/owner readsets, not age, justify cuts.

package.json:49 registers all three top-level .test.ts files in `test:node`; .github/workflows/ci.yml quality-node executes that command. No inventory or CI routing removal required because the file remains. Relevant focused command for main (not run):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/product-intake-submissions.test.ts tests/product-intake-matching.test.ts tests/product-intake-lookup.test.ts
```

Selected control commands are in controls.json and must produce exactly one selected intended keeper; main must inspect real assertion failure and restored hashes. Full campaign failure/coverage gates remain unchanged.

## Read and verification limits

Fully read: all three test files, product-matching.ts, product-lookup.ts, schemas.ts, config.ts, route-handlers.ts, upload-paths.ts, image-validation.ts, errors.ts, product-identity/index.ts/normalize.ts/brand-resolution.ts, product-catalog/eligibility.ts. Read submissions.ts through legacy+scan/cancel owner1171; unrelated Personal Plan submission branch1172+ not audited. Repository classifier, usage RPC adapters and upload verification/commit were read as relevant excerpts; entire repository/storage SDK and SQL bodies were not executed or certified. No fabricated claim of complete tree/operator consumer graph; direct discovered callsites plus actual exports were traced for this bounded no-source-deletion proposal. Production dependencies relevant to schema semantics inspected as package/type/source declarations; parser/hashes never execute owners.

Static artifacts verify 96 original declarations, all 51 submissions remain during transfer and46 after cut; other45 unchanged. All prospective TS parses; all untouched callbacks byte-identical. Four changed keeper bodies receive all transfers; fifth keeper already contains C2 union. Fourteen source/dependency hashes and all three test hashes recorded. Source changes0; no test-only helper/import deletion unlocked by these five callbacks. F fixes are not secretly included.

No repository writes, tests/native runs, typecheck/compiler execution, source faults, provider/DB/browser calls, env/secrets loading or counterpart dispatch. Only /tmp artifacts written. Candidates remain conditional until main's independent preservation review and native mutation proof.
