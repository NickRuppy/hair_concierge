# Quiz same-branch layer audit — proposed11, not executed

Current baseline: five complete assigned files,101 AST declaration sites; R90/C6/D5/F0. Three complete keeper/context files add26 sites (127 full bodies total). Table row counts are not declaration counts. No added cases or inputs. Six transfers preserve the current declarations before11 cuts. No source deletion is justified: owners all have real callers.

## Scope and product graph

/quiz remains active: page imports real question, concerns, store/draft and scan views, and renders current question map and steps16–18. Draft initialization loads actual browser storage, normalizes current-package screen, seeds history and invokes real store restore; goNext saves actual answers/current package. Tests use passive MemoryStorage, not a mock reimplementing draft behavior. The concerns harness supplies React hooks and dispatches real QuizConcernsQuestion event callbacks over actual Zustand; it is not browser/focus proof. The renderer keeper renders real ScanInsert*View→Frame→Photo→ScanExampleCard and next/image. Product paths are fixed constants independent of quiz answers. Offer hero also consumes problem-card rows.

Scan package remains placeholder in packages.json and canonical scan-regal brief explicitly supports a separately gated activation flow. Not retired and no current flag value/provider state checked. No package or feature removal proposed. Normalizer also has current lead route, lead capture, result, profile, discovery, reactivation, Customer.io and scanner-context readers. Primary reconciliation is used by both quizzes and store; generic membership is not a per-token enum.

Full source read: normalization, primary-concern, validators, draft, store, screen-order, scan-insert-examples, QuizConcernsQuestion, QuizQuestion, /quiz page, the three insert views and frame/photo/card, scan hero. Need-lane read for retained primary tests. Profile link, narrative/offer route consumers, other normalizer callers are bounded read/search context rather than whole subsystem audits. Zod installed _superRefine implementation inspected: actual callback issues feed parser, no fixture-owned validation. Native CI .github/workflows/ci.yml:158 runs npm test:node top-level glob covering all8files. Live scan journey only excerpted; it needs provider state/secrets and is NOT any proposed primary keeper.

History read: cb6fb1b3 taxonomy diff; 8e25f145 goal-order rationale and test diff; b1993a03 hair-length draft diff; f8c28328 package/version restore diff; d7400ea8 packshot/model+renderer diff; f452cb04 stated-primary introduction; logs feb9284c and 09799e22 identify subsequent settle/animation changes. No actual prod usage inferred from age.

Prior generic R ledger and prior C12 were used as navigation, not retention authority. C12 remains absent; no double counting. This report does not claim whole-repository semantic review or any run results.

## Candidates and exact union

### D1 D — tests/quiz-normalization.test.ts:19

**colored and bleached can be combined**

Input/union: Donor []→gefaerbt→blondiert; keeper []→chemisch_geglaettet→gefaerbt→dauerwelle→blondiert. Both names in donor occur in keeper; all non-natur additions take the same membership/add/sort branch. No token-specific combination rule exists. Keeper requires the ordered four-token union, which includes the donor pair.

Remaining keepers: `tests/quiz-normalization.test.ts:26` — chemical shape treatments combine with color treatments in canonical order.

Fault: Replacing selection with the latest value or dropping either color token fails the existing four-token exact array.

Transfer: None: every asserted contract already has an independent retained oracle.

History: cb6fb1b3 added the richer combination case when chemical taxonomy expanded; original pair had been present before it.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-normalization.test.ts`.

### D2 D — tests/quiz-normalization.test.ts:35

**chemical shape treatments remain exclusive with natur**

Input/union: Donor natur→chemisch_geglaettet and [dauerwelle,chemisch_geglaettet]→natur. Keeper natur→gefaerbt and [gefaerbt,blondiert]→natur reaches identical two exclusivity branches; keeper :26 independently admits every chemical token. Code only distinguishes value===natur from every other admitted token; previous non-natur token spellings are never branched on.

Remaining keepers: `tests/quiz-normalization.test.ts:13` — natur stays exclusive in treatment selection; `tests/quiz-normalization.test.ts:26` — chemical shape treatments combine with color treatments in canonical order.

Fault: Leaving natur in non-natural selections or failing to clear prior selections when selecting natur is detected at :13. Chemical token rejection/order remains detected at :26.

Transfer: None: every asserted contract already has an independent retained oracle.

History: cb6fb1b3 added chemical-specific replay with taxonomy extension; current algorithm remains generic after the allowlist.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-normalization.test.ts`.

### D3 D — tests/quiz-normalization.test.ts:195

**two goal lists with the same items in different order normalize equal**

Input/union: Donor compares two outputs for permutations of shine/volume/moisture. No conflict, duplicate, invalid, or special-value branch. Existing exact-output keeper :185 sorts volume/shine/less_frizz; :210 pins shared selection order; :251 sorts moisture/less_frizz through canonicalization. Ordering is the single QUIZ_GOAL_VALUES.filter over seen membership, not a vocabulary-dependent sort.

Remaining keepers: `tests/quiz-normalization.test.ts:185` — goals are passed through when valid (sorted to canonical GOALS order); `tests/quiz-normalization.test.ts:210` — new quiz goals preserve every unique shared selection; `tests/quiz-normalization.test.ts:251` — canonicalization carries goals through in canonical GOALS order.

Fault: Returning input/Set insertion order fails :185 and :251; constant empty output fails independent literals but would falsely pass the donor self-comparison.

Transfer: None: every asserted contract already has an independent retained oracle.

History: 8e25f145 introduced canonical ordering for findReusableLead equality and these tests together. The real ordering requirement remains; only weaker duplicate order proof is removed.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-normalization.test.ts`.

### D4 D — tests/quiz-validators.test.ts:178

**quiz schema rejects duplicate goals**

Input/union: Donor createBaseAnswers()+goals [volume,volume]; existing callback same base+[moisture,moisture]. Both are valid enum members, min length satisfied, no volume/less_volume pair, and same Set.size !== length branch. Existing keeper also accepts eight goals and historical values, reducing false-denial ambiguity.

Remaining keepers: `tests/quiz-validators.test.ts:132` — quiz schema accepts all eight shared goals and historical stored goal values.

Fault: Removing general duplicate-goal refinement permits both literal duplicates; keeper assert.throws fails.

Transfer: None: every asserted contract already has an independent retained oracle.

History: 8e25f145 added volume duplicate guard; the newer expanded-goal keeper already carries duplicate moisture rejection. Shared and historical vocabulary membership remains independently covered.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-validators.test.ts`.

### D5 D — tests/quiz-draft.test.ts:165

**quiz drafts after hair length keep their original step when hair length is present**

Input/union: Both directly seed version 1, current savedAt, step 4, structure wavy, thickness normal, hair_length medium and load the actual draft. Donor additionally has density medium but asserts only step4 and hair_length. getRestorableStep reads hair_length/step only; normalizer projects density independently. Keeper deepEqual includes hair_length medium and asserts step4 plus null package.

Remaining keepers: `tests/quiz-draft.test.ts:350` — legacy version 1 quiz drafts still restore.

Fault: Unconditionally redirecting post-density drafts to step15 or dropping hair_length fails retained version-1 keeper. Density normalization is independently retained at normalization :59.

Transfer: None: every asserted contract already has an independent retained oracle.

History: b1993a03 introduced length recovery and donor; f8c28328 introduced richer version-1 compatibility keeper. Neither version nor input-step class is lost.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-draft.test.ts`.

### C5 C — tests/quiz-scan-insert-examples.test.ts:344

**insert 18 joins every deviation into one line**

Input/union: Identical input {thickness:fine,treatment:[blondiert]}, same getScanInsertExample(18) call through actual ScanInsertHomeView→ScanInsertFrame→ScanExampleCard. Donor requires equality; existing keeper currently checks the contiguous string Pflegegewicht: reichhaltig statt leicht · Repair-Pflege: mittel statt hoch.

Remaining keepers: `tests/quiz-scan-inserts.test.tsx:105` — the home insert turns the user's own bathroom into the first shelf.

Fault: Dropping, reordering or changing separator of either deviation fails the existing rendered home assertion.

Transfer: In existing home renderer callback, require the exact deviation as one rendered paragraph text, preserving existing checks and exact same fine+blondiert input. Use real parsed HTML, not a model expected value.

History: d7400ea8 changed BOTH helper donor and rendered keeper to this same fine+bleached example in the packshot change.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-scan-insert-examples.test.ts tests/quiz-scan-inserts.test.tsx`.

### C6 C — tests/quiz-scan-insert-examples.test.ts:405

**every insert's example product carries a packshot**

Input/union: Donor each step16/17/18 with {}; keeper same steps with thickness normal/scalp_type trocken. Each build returns one fixed product constant regardless of answers. Keeper currently has path-substring regex; the required transfer pins the identical three complete canonical image paths from real next/image output. Neither input influences product.imageSrc.

Remaining keepers: `tests/quiz-scan-inserts.test.tsx:137` — every example card shows the product's own packshot, not a glyph.

Fault: Each individual fixed image path regression fails the matching retained render iteration; missing packshot also fails.

Transfer: In existing three-step packshot loop, require decoded actual img src to equal /images/funnels/scan/+existing literal file. Preserve existing regex and old-glyph checks; same three inputs. Suffix mutation must fail.

History: d7400ea8 introduced both packshot tests together. Strengthen the actual renderer oracle to exact decoded src paths before removal; existing regex alone misses suffix changes.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-scan-insert-examples.test.ts tests/quiz-scan-inserts.test.tsx`.

### C1 C — tests/quiz-primary-concern.test.ts:113

**reconcilePrimaryConcern keeps a contained pick and drops a stale one**

Input/union: Donor includes low_shine in [breakage,low_shine], excludes low_shine from [breakage], and passes undefined. Existing real UI/store keepers include breakage, remove breakage, and initially select [low_shine,breakage] with primary undefined. Reconcile is generic<T extends string>: only undefined and Array.includes matter; no enum/token/array-length branch. Add selected===undefined in existing :138 after sheet opens.

Remaining keepers: `tests/quiz-main-problem-sheet.test.tsx:138` — two concerns: Weiter opens the sheet with only her selected concerns; `tests/quiz-main-problem-sheet.test.tsx:211` — back-edit: deselecting the pick clears it and the sheet asks again; `tests/quiz-main-problem-sheet.test.tsx:231` — back-edit keeping the pick highlights it, so confirming is one tap; `tests/quiz-main-problem-sheet.test.tsx:258` — the store drops a pick the new concern selection no longer contains.

Fault: Always dropping a contained pick fails :231/:258; returning a stale pick fails :211/:258; auto-selecting first concern for undefined fails strengthened :138.

Transfer: Add assert.equal(sheet.props.selected, undefined) to existing :138; keep all existing options, navigation and persistence assertions.

History: f452cb04 introduced stated-main-problem helper and actual UI/store suite together; feb9284c later strengthened settling behavior. All zero/single/multi sheet policy and settling tests stay.

Cleanup: Remove only unused reconcilePrimaryConcern import from primary-concern test. Keep production export: both quizzes and store call it. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-primary-concern.test.ts tests/quiz-main-problem-sheet.test.tsx`.

### C2 C — tests/quiz-draft.test.ts:342

**an organic quiz draft carries no funnel package**

Input/union: Donor save step3/answers{structure:wavy}, omitted package then load; existing actual store starts step2, sets wavy, goNext writes step3/same answers/current null package, then actual load. Lead name/email only test privacy and are not read into saved answers. load package projection checks typeof string: both saved null values enter identical non-string→null branch. Add load result funnelPackageKey===null. Original donor does NOT prove serialized presence of default null: missing serialized key also normalizes to null.

Remaining keepers: `tests/quiz-draft.test.ts:263` — quiz store saves the completed page draft when advancing.

Fault: Changing load non-string package fallback to scan_v1 fails strengthened store load assertion. Stored version1 and non-null scan package remain separate keepers.

Transfer: Add assert.equal(draft?.funnelPackageKey, null) beside existing step3 assertion. Do not alter setup, reset, lead inputs or any saved fixture.

History: f8c28328 introduced v2 package recording, organic donor and compatibility tests. Earlier actual store persistence callback remains stronger entry boundary.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-draft.test.ts`.

### C3 C — tests/quiz-scan-insert-examples.test.ts:137

**insert 17 carries the mild scalp shampoo the screen is about**

Input/union: Exactly same input {scalp_type:trocken,has_scalp_issue:false,thickness:normal}. Existing actual solution renderer receives same getScanInsertExample(17) card. Transfer all four product literals: Balea Kopfhaut Sensitive Shampoo; Shampoo; ca. 1,25 €; /images/funnels/scan/example-balea-kopfhaut-sensitive.webp.

Remaining keepers: `tests/quiz-scan-inserts.test.tsx:91` — the solution insert's positive card judges the scalp and names the match.

Fault: Changing any fixed product name/category/price/path fails strengthened rendered positive-card keeper; existing headline and exact scalp match assertions remain.

Transfer: Read actual rendered paragraphs and image src values with installed JSDOM; assert exact name paragraph, exact category/price paragraph and decoded canonical image path. Preserve existing regex checks. No data/model helper imported into expected values.

History: d7400ea8 added this metadata donor with real catalog packshot substitution; the exact positive rendered case pre-existed and was updated in same commit.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-scan-insert-examples.test.ts tests/quiz-scan-inserts.test.tsx`.

### C4 C — tests/quiz-scan-insert-examples.test.ts:221

**inserts 16 and 18 carry no scalp row, so they keep the hair verdict**

Input/union: Donor loops steps16/18 with {thickness:coarse}, asserting verdict ok, headline Passt zu deinem Haar and deviation Alles im Ziel. Existing :52 already has exact coarse input and headline/deviation; add card.verdict===status to its existing literal status loop. Existing :254 already has exact coarse step18 input and all three outputs. Despite title, donor asserts no row labels/absence.

Remaining keepers: `tests/quiz-scan-insert-examples.test.ts:52` — insert 16 weighs the fixed thick product against every thickness; `tests/quiz-scan-insert-examples.test.ts:254` — insert 18 weighs the mask against thickness, direction and repair need.

Fault: A problem-card success verdict of warn while headline/deviation stay correct is caught by new assertion; existing home keeper already catches same error for step18.

Transfer: Add assert.equal(card.verdict, status, thickness) in existing :52 loop; no row/input changes.

History: c986b3f7 aligned scalp/hair verdict copy; d7400ea8 keeps coarse success while changing fixed mask. This union preserves both actual builders, not just a shared helper.

Cleanup: No production seam deletion. Risk: Conditional until native baseline, transfer and source-control proofs pass. No owner policy or fixture/input changes.

Validation (main only, not run): `node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-scan-insert-examples.test.ts`.

## Complete assigned declaration ledger

|File:line|Verdict|Name|Specific oracle/fault or candidate|
|---|---|---|---|
|tests/quiz-normalization.test.ts:13|R|natur stays exclusive in treatment selection|Natur selection replacement has clear-vs-delete behavior; failure to remove color or natur is detected.|
|tests/quiz-normalization.test.ts:19|D|colored and bleached can be combined|D1: Replacing selection with the latest value or dropping either color token fails the existing four-token exact array.|
|tests/quiz-normalization.test.ts:26|R|chemical shape treatments combine with color treatments in canonical order|Combined new chemical vocabulary and canonical order; removing dauerwelle or chemisch from admitted values fails.|
|tests/quiz-normalization.test.ts:35|D|chemical shape treatments remain exclusive with natur|D2: Leaving natur in non-natural selections or failing to clear prior selections when selecting natur is detected at :13. Chemical token rejection/order remains detected at :26.|
|tests/quiz-normalization.test.ts:44|R|legacy pulltest values are normalized|Legacy ueberdehnt alias: removing compatibility returns undefined/wrong pull test.|
|tests/quiz-normalization.test.ts:59|R|density values are normalized and invalid values are removed|All density enum values and unknown rejection; an omitted low/medium/high mapping or retained unknown fails.|
|tests/quiz-normalization.test.ts:66|R|hair length values are normalized and invalid values are removed|very_long admission and unknown removal; independent hair-length vocabulary.|
|tests/quiz-normalization.test.ts:71|R|legacy scalp values still map to type and condition|Legacy combined oily/flakes splits into type, gate and condition; gate or alias loss fails.|
|tests/quiz-normalization.test.ts:86|R|legacy no-issue scalp answers normalize to a negative scalp gate|Legacy keine explicitly overrides an active complaint; conversion to undefined/true fails.|
|tests/quiz-normalization.test.ts:102|R|stored answers without the new concern or scalp gate fields backfill clean defaults|Old answers lacking fields backfill false gate and empty concerns; losing defaults fails.|
|tests/quiz-normalization.test.ts:116|R|free-text concern notes are trimmed and empty strings are removed|Trim populated free text without truncating valid note; preserving edge whitespace fails.|
|tests/quiz-normalization.test.ts:125|R|blank free-text concern notes normalize to undefined|Whitespace-only note must disappear; treating blank as populated fails.|
|tests/quiz-normalization.test.ts:134|R|legacy free-text concern notes are clamped to the current 50-character limit|Historical oversized note clamps to50, distinct from input schema rejection.|
|tests/quiz-normalization.test.ts:142|R|shared hair-loss concern is added once after hair damage with reviewed copy|Reviewed hair-loss option/order and exact copy/icons; a missing/duplicated option or medical-copy drift fails.|
|tests/quiz-normalization.test.ts:158|R|canonicalization drops invalid natur conflicts|Canonical writer removes natur conflict and negative-gate stale condition and sorts concerns; invalid persisted combination survives if broken.|
|tests/quiz-normalization.test.ts:185|R|goals are passed through when valid (sorted to canonical GOALS order)|Exact canonical order independent of input order; using insertion order fails.|
|tests/quiz-normalization.test.ts:195|D|two goal lists with the same items in different order normalize equal|D3: Returning input/Set insertion order fails :185 and :251; constant empty output fails independent literals but would falsely pass the donor self-comparison.|
|tests/quiz-normalization.test.ts:201|R|invalid goal values are filtered out|String-invalid and non-string goal filtering; accepting unknown or number fails.|
|tests/quiz-normalization.test.ts:210|R|new quiz goals preserve every unique shared selection|All eight shared choices survive; reintroducing old cap or dropping a token fails.|
|tests/quiz-normalization.test.ts:236|R|goals drop the conflicting volume/less_volume pair (keeps first occurrence)|First-seen volume conflict resolution; keeping both or last-wins fails.|
|tests/quiz-normalization.test.ts:245|R|missing or empty goals normalize to undefined|Missing/non-array-path, empty valid input and all-invalid output collapse to undefined; leaking [] fails.|
|tests/quiz-normalization.test.ts:251|R|canonicalization carries goals through in canonical GOALS order|Writer canonicalizes goals too; bypassing goals in canonicalize fails independently of raw reader.|
|tests/quiz-normalization.test.ts:267|R|shared quiz values project once into the existing profile vocabulary|Legacy concern/goal projection drops non-mappable values and maps aliases with coarse/high/coily context; writing shared codes into old profile fails.|
|tests/quiz-primary-concern.test.ts:102|R|`resolveStatedPrimaryConcern: ${row.name}`|Eleven explicit stated-pick resolution rows cover missing, single, stale, aliases, nonlegacy, unknown and multi no-pick; weight ranking or stale preference fails.|
|tests/quiz-primary-concern.test.ts:107|R|a pick is asked for only with two or more concerns|Zero is an independent UI admission boundary absent in fully read real UI keepers; one/two threshold covered but no free-text-only actual keeper selected.|
|tests/quiz-primary-concern.test.ts:113|C|reconcilePrimaryConcern keeps a contained pick and drops a stale one|C1: Always dropping a contained pick fails :231/:258; returning a stale pick fails :211/:258; auto-selecting first concern for undefined fails strengthened :138.|
|tests/quiz-primary-concern.test.ts:119|R|toLegacyQuizConcern maps aliases and leaves the four non-legacy codes out|All legacy codes identity plus two aliases/four nonlegacy/null; altering profile vocabulary compatibility fails.|
|tests/quiz-primary-concern.test.ts:138|R|need lane: the stated pick decides, not a weight ranking|Stated frizz must beat breakage weight in need lane; returning inferred higher risk fails.|
|tests/quiz-primary-concern.test.ts:150|R|need lane: aliases map into the legacy vocabulary|Aliases must drive existing dryness/frizz lanes; dropping raw alias mapping fails.|
|tests/quiz-primary-concern.test.ts:172|R|`need lane: stated ${nonLegacy} falls back to no primary concern`|Four newer concern picks must remain no legacy primary/base lane; inventing legacy mappings fails.|
|tests/quiz-primary-concern.test.ts:184|R|need lane: the explicit stated concern wins over a collapsed legacy projection|Raw two concerns must not collapse to a false single legacy concern; evaluating after projection fails.|
|tests/quiz-primary-concern.test.ts:195|R|narrative: the stated pick drives the intro and the friction row|Stated frizz reaches narrative intro/row order; retaining weight-driven copy fails.|
|tests/quiz-primary-concern.test.ts:207|R|narrative: legacy multi-concern answers without a pick get neutral copy|Multi no pick with explicit goal gets neutral concern wording; claiming stated problem fails.|
|tests/quiz-primary-concern.test.ts:219|R|narrative: legacy multi-concern answers without a pick and without goals stay neutral|Multi no pick and no goals has exact neutral intro/hero and scalp row; accidental fallback priority fails.|
|tests/quiz-primary-concern.test.ts:257|R|`narrative: stated ${concern} has its own copy and does not crash`|Four nonlegacy narrative copy cases have distinct reviewed mappings; omissions or wrong label fail.|
|tests/quiz-primary-concern.test.ts:274|R|narrative: hair loss keeps the medical boundary and promises no product result|Hair-loss branch maintains doctor boundary and excludes growth/product promises; unsafe copy fails.|
|tests/quiz-primary-concern.test.ts:288|R|offer preview lane follows the stated pick from the raw answers|Offer assembly preserves raw stated-pick resolution and projection ambiguity; passing projected-only answers fails.|
|tests/quiz-primary-concern.test.ts:309|R|lead schema accepts the new key and still accepts answers without it|Lead transport accepts optional new field and compatible old body; required primary or strip fails.|
|tests/quiz-primary-concern.test.ts:323|R|lead schema never rejects a stale pick; canonicalisation drops it|Stale valid-enum pick must be transport-accepted then absent from canonical JSON; rejecting old records or persisting stale choice fails.|
|tests/quiz-primary-concern.test.ts:333|R|lead schema rejects a pick outside the concern vocabulary|Unknown primary enum rejected independently of containment; allowing dandruff fails.|
|tests/quiz-primary-concern.test.ts:339|R|canonicalisation keeps a contained pick|Canonicalization retains a contained pick; stripping primary in writer fails.|
|tests/quiz-primary-concern.test.ts:348|R|stored re-read: old answers without the key and new answers with it both parse|Stored historical/current answers parse and preserve current pick; making new key mandatory or forgetting read mapping fails.|
|tests/quiz-primary-concern.test.ts:365|R|stored re-read drops a stale pick instead of failing|Stored stale choice gets dropped without failing old record read; stricter schema or stale propagation fails.|
|tests/quiz-primary-concern.test.ts:377|R|profile projection writes the legacy vocabulary like concerns|Profile writer maps dry alias/hair loss and null/nonlegacy distinctly; writing unsupported concern code fails.|
|tests/quiz-validators.test.ts:21|R|quiz schema accepts an empty concern array with a negative scalp gate|Negative scalp gate plus empty concerns accepted; reintroducing required concern choice fails.|
|tests/quiz-validators.test.ts:29|R|quiz schema requires density as the third physical hair attribute|Missing density rejected; making this physical field optional fails.|
|tests/quiz-validators.test.ts:36|R|quiz schema requires hair length as the fourth physical hair attribute|Missing hair_length rejected for new submissions; legacy stored schema remains separately tolerant.|
|tests/quiz-validators.test.ts:43|R|quiz schema accepts free-text-only concern notes|Free-text-only concerns accepted; requiring selected concern despite note fails.|
|tests/quiz-validators.test.ts:52|R|quiz schema accepts all nine shared concerns and rejects duplicates or unknowns|Nine shared vocabulary admission plus duplicate and unknown rejection; lost enum or dedupe failure detected.|
|tests/quiz-validators.test.ts:73|R|quiz schema requires a scalp condition when the user reports an active issue|True scalp gate requires condition; incomplete active complaint admitted if rule missing.|
|tests/quiz-validators.test.ts:82|R|quiz schema rejects a scalp condition when the scalp gate is negative|False scalp gate rejects stale condition; contradictory new submission accepted if rule missing.|
|tests/quiz-validators.test.ts:91|R|quiz schema does not use colored as a concern code|colored is specifically excluded from concern taxonomy, not just generic unknown: adding that historical treatment token would otherwise be missed.|
|tests/quiz-validators.test.ts:100|R|quiz schema accepts multiple non-natural chemical treatment values|Both non-natural shape treatments can be submitted together; enum or false exclusivity denial fails.|
|tests/quiz-validators.test.ts:109|R|quiz schema rejects natur combined with a chemical shape treatment|Natur+shape is invalid at API schema, distinct from UI cleanup; removing refine rule fails.|
|tests/quiz-validators.test.ts:118|R|quiz schema accepts 50-character concern notes and rejects longer text|Exact50/51 free-text validation boundary; obsolete120 limit or off-by-one fails.|
|tests/quiz-validators.test.ts:132|R|quiz schema accepts all eight shared goals and historical stored goal values|Eight shared plus historical goals allowed and duplicate moisture rejected; cap/compatibility/dedup changes fail.|
|tests/quiz-validators.test.ts:160|R|quiz schema rejects unknown goal values|Unknown goal rejects despite valid volume; loosening enum validation fails.|
|tests/quiz-validators.test.ts:169|R|quiz schema rejects volume + less_volume together|Volume and less_volume mutually exclusive despite unique tokens; duplicate rule alone cannot catch it.|
|tests/quiz-validators.test.ts:178|D|quiz schema rejects duplicate goals|D4: Removing general duplicate-goal refinement permits both literal duplicates; keeper assert.throws fails.|
|tests/quiz-draft.test.ts:41|R|quiz draft stores only restorable quiz answers and progress|Persist only answer/progress fields with v2 and no name/email/leadId; spreading whole input leaks PII.|
|tests/quiz-draft.test.ts:76|R|quiz draft resumes post-lead quiz states from lead capture instead of storing PII|Write step10 as resumable9 then read; raw historic version1 read test does not execute this current writer conversion.|
|tests/quiz-draft.test.ts:93|R|stored post-lead quiz draft steps resume from lead capture|Historic10/11/14 individually map9 with length present; losing one legacy step constant fails.|
|tests/quiz-draft.test.ts:114|R|stored quiz drafts can resume at the hair length question|Missing length at step15 is a valid resumable screen; redirecting/rejecting it fails.|
|tests/quiz-draft.test.ts:141|R|legacy quiz drafts after density resume at hair length when hair length is missing|Ten distinct stored post-density step identities redirect15 without length; removing a set member fails.|
|tests/quiz-draft.test.ts:165|D|quiz drafts after hair length keep their original step when hair length is present|D5: Unconditionally redirecting post-density drafts to step15 or dropping hair_length fails retained version-1 keeper. Density normalization is independently retained at normalization :59.|
|tests/quiz-draft.test.ts:189|R|stored quiz draft answers are normalized before restore|Mixed corrupt goals/unknown concern/natur conflict/unexpected field cleaned on actual storage read; unnormalized restore fails.|
|tests/quiz-draft.test.ts:220|R|expired quiz drafts are ignored and removed|Expired stored record ignored and removed; returning expired or leaving key fails.|
|tests/quiz-draft.test.ts:237|R|invalid quiz draft steps are ignored and removed|Unknown numeric step rejected and removed; valid-step filter loss fails.|
|tests/quiz-draft.test.ts:254|R|clearing a quiz draft removes the browser entry|Explicit clear removes existing saved key; a no-op clear fails.|
|tests/quiz-draft.test.ts:263|R|quiz store saves the completed page draft when advancing|Store advancement actually writes correct screen/answers and omits live lead PII; a missing save or wrong state snapshot fails. C2 adds organic package oracle.|
|tests/quiz-draft.test.ts:289|R|quiz store applies verified partner identity and consent mode atomically|Verified partner identity changes all identity/mode/substep fields atomically and reset clears identity; partial state merge fails.|
|tests/quiz-draft.test.ts:318|R|quiz drafts record the funnel package the progress belongs to|V2 scan package and step16 are recorded in raw serialized storage and loaded; package omission or version drift fails.|
|tests/quiz-draft.test.ts:342|C|an organic quiz draft carries no funnel package|C2: Changing load non-string package fallback to scan_v1 fails strengthened store load assertion. Stored version1 and non-null scan package remain separate keepers.|
|tests/quiz-draft.test.ts:350|R|legacy version 1 quiz drafts still restore|Version1 record reads with exact answers/step4/null package; dropping supported version1 fails.|
|tests/quiz-draft.test.ts:373|R|insert drafts without a hair length still resume at the hair length question|Steps17/18 still need missing-length recovery; treating all inserts before length fails.|
|tests/quiz-draft.test.ts:424|R|a scan draft on an insert restores to the insert inside the scan package|Actual store restores scan insert16 under current scan package; foreign normalization must not apply.|
|tests/quiz-draft.test.ts:441|R|a scan draft on an insert restores to the preceding question when the quiz is organic|Stored scan17 under current organic returns preceding6 and current null package; trusting stored attribution skips/enters wrong screen.|
|tests/quiz-draft.test.ts:452|R|an organic draft keeps its step when the quiz runs the scan package|Organic step8 remains8 under current scan package; remapping by numerical index skips answers.|
|tests/quiz-draft.test.ts:462|R|a legacy draft restores its answers under the current funnel package|Version1 answers restore under CURRENT scan package; overwriting current attribution with missing stored value fails.|
|tests/quiz-scan-insert-examples.test.ts:24|R|insert 16 stays partial: cleansing and thickness, no scalp row|Step16 exact partial row inventory and product literals with fine input; adding premature scalp row or wrong fixed product/targets fails.|
|tests/quiz-scan-insert-examples.test.ts:52|R|insert 16 weighs the fixed thick product against every thickness|All three thickness distances give exact target/status/headline/deviation; one-step versus two-step classification broken fails. C4 adds verdict.|
|tests/quiz-scan-insert-examples.test.ts:75|R|insert 16 falls back to the default thickness before the question is answered|Empty answers use fine default; explicit fine input cannot guard fallback deletion.|
|tests/quiz-scan-insert-examples.test.ts:85|R|insert 17 reads the scalp type when the user reported no complaint|Three scalp types and exact product range/status distinct dictionary rows; wrong dry/balanced/oily mapping fails.|
|tests/quiz-scan-insert-examples.test.ts:104|R|insert 17 reads the reported complaint over the scalp type|Three complaints win over type with exact targets and coverage; missing complaint alias fails.|
|tests/quiz-scan-insert-examples.test.ts:126|R|insert 17 ignores a complaint the user took back|False gate ignores stale complaint; treating any stored condition as active fails.|
|tests/quiz-scan-insert-examples.test.ts:137|C|insert 17 carries the mild scalp shampoo the screen is about|C3: Changing any fixed product name/category/price/path fails strengthened rendered positive-card keeper; existing headline and exact scalp match assertions remain.|
|tests/quiz-scan-insert-examples.test.ts:149|R|insert 17 asks for a clarifying wash when the scalp runs oily|Oily cleanser target and simultaneous bad scalp produce exact row labels/combined deviation; cleanser selector or worst-status order fails.|
|tests/quiz-scan-insert-examples.test.ts:176|R|insert 17 passes on the scalp and says so, naming the matched criterion|Full positive solution card requires ok verdict and every row ok, distinct internal row-status contract feeding future deviation; renderer only observes text and does not render rows.|
|tests/quiz-scan-insert-examples.test.ts:194|R|insert 17's matched line quotes the scalp answer, not the product's range|Dry and irritated matched lines use the user target rather than product range; swapping productValue for targetValue fails especially second literal.|
|tests/quiz-scan-insert-examples.test.ts:221|C|inserts 16 and 18 carry no scalp row, so they keep the hair verdict|C4: A problem-card success verdict of warn while headline/deviation stay correct is caught by new assertion; existing home keeper already catches same error for step18.|
|tests/quiz-scan-insert-examples.test.ts:233|R|insert 17 keeps the restriction verdict when only the wash deviates|Warn-only oily+irritated keeps restriction instead of bad/ok; bad-scaffold and all-positive cases cannot catch precedence.|
|tests/quiz-scan-insert-examples.test.ts:245|R|insert 17 falls back to a balanced scalp before the question is answered|Empty scalp/thickness defaults; explicit type does not reach missing-value fallback.|
|tests/quiz-scan-insert-examples.test.ts:254|R|insert 18 weighs the mask against thickness, direction and repair need|Full mask product/three rows/positive result coarse case; missing direction/repair rows or metadata fails.|
|tests/quiz-scan-insert-examples.test.ts:290|R|insert 18 walks the rich mask down the care-weight ladder|Three care-weight distances and exact verdict/deviation; wrong scale ordering fails.|
|tests/quiz-scan-insert-examples.test.ts:314|R|insert 18 raises the repair target for bleached hair|Bleaching treatment raises high repair even without concern; treatment trigger loss fails.|
|tests/quiz-scan-insert-examples.test.ts:330|R|insert 18 raises the repair target for damage concerns|Each of three damage concerns raises repair and unrelated frizz/natur does not; Set-membership drift fails.|
|tests/quiz-scan-insert-examples.test.ts:344|C|insert 18 joins every deviation into one line|C5: Dropping, reordering or changing separator of either deviation fails the existing rendered home assertion.|
|tests/quiz-scan-insert-examples.test.ts:353|R|insert 18 stays valid before any question is answered|Entirely empty mask input gives fallback targets; explicit thickness ladder cannot detect missing fallback.|
|tests/quiz-scan-insert-examples.test.ts:364|R|the copy helpers name the hair the quiz already knows|Texture/density/thickness/scalp copy helpers include unknown/default and all named variants; wrong copy mapping or fallback fails.|
|tests/quiz-scan-insert-examples.test.ts:405|C|every insert's example product carries a packshot|C6: Each individual fixed image path regression fails the matching retained render iteration; missing packshot also fails.|
|tests/quiz-scan-insert-examples.test.ts:416|R|every row value stays a single word except the scalp range the product covers|Single-word product values is a limited content-format oracle; many literals overlap but sole jede row value has no independently proven full keeper. Hold rather than delete based only private shape; no runtime retirement claim.|

## Limits / rejected expansion

Retain missing/empty/invalid inputs, obsolete-but-supported version1 persistence, all historical post-lead step identities, package-crossing lifecycle, medical copy, raw-vs-projected primary ambiguity, scalp complaint gate and all vocabulary mappings. colored concern is a named taxonomy exclusion; generic unknown rejection does not prove it. Requires-pick zero boundary remains because the fully read UI keepers have only one/two+ selected input, and zero can accompany free text. Do not infer absence of storage or scalar malformed tests is complete coverage. Single-word product-value inventory is held: overlapping exact values are clear but the sole `jede` always-ok row has no independently proven keeper or normative retirement decision in this bounded lane.

No runnable owner, native test, browser, database, provider or environment command executed. Source-control descriptors are static proposals only. Main must run unchanged baseline, transfer with all donors present, selected actual-source controls with byte restoration, then cut and rerun focused contracts, broad preservation and campaign coverage. Control counts must be taken from the control artifact. No acceptance claim before that.
