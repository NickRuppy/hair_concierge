# Quiz/result owner-layer challenge — read-only evidence

Workspace: `/Users/nick/AI_work/hair_conscierge/.worktrees/test-audit-pruning`. Base campaign `21e0e41f`. No repository edits, test runs, compiler runs, source mutations, env-file reads, provider calls or DB operations were performed.

## Chosen direction and counts

**22 conditional declaration removals: 17 C + 5 D.** These are actual existing declaration sites, not fixture/table rows. No new declaration sites are proposed. Of these, 2 D remove a demonstrably retired production wrapper and its tests; the other proposals concentrate duplicate assertions at existing actual owner boundaries. Every C remains conditional on the native retained keeper and specified actual-source negative control passing under the parent's serialized runner. No coverage result is claimed.

The navigation cohort is **24 files / 257 test declaration sites**. All 257 complete test bodies and their file-local literal tables/setup were read; the count was reconciled by declaration-call inventory (including one count per loop declaration) against the 257 supplied/navigation total. A further 6 supporting declarations in personal-plan-result-artifact-email.test.ts were fully read for exact default/configured serializer keepers; those 6 are not added to the 257 denominator and are not removal candidates.

**Depth limit:** this is not a completed whole-subsystem source audit of 257 sites. Complete candidate owners and their relevant caller/normalization/delivery paths were read. For retained priority ranking, Personal Plan state/draft/persistence and template-operator files, test bodies were read but every transitive source implementation and history was not re-audited. The 235 non-candidates remain untouched; do not present them as 235 independently mutation-verified R verdicts. One retained narrative title needs F correction, described below. The appended inventory identifies every examined declaration and distinguishes cut/F from retained-for-now. This avoids repeating the earlier all-R overclaim.

The earlier durable `plans/evidence/2026-10-02-recommendation-matrix-ledger.md` classified its 103 quiz declarations R with broad separate-output/layer reasoning. `/tmp/test-audit-runtime-ledger.md`, `-ui-ledger.md`, `-helpers-ledger.md`, `-retired-journeys-ledger.md` and relevant earlier lanes supplied navigation. This pass challenges that reasoning only with exact inputs and existing keepers; it does not call the legacy quiz itself obsolete.

## Current ownership and history

* Result route (`src/app/result/[leadId]/result-client.tsx:240,264`) and quiz results (`src/components/quiz/quiz-results.tsx:271`) build/receive the actual narrative and render QuizResultsView. That view owns the TransformationCard and LeverRows calls at :94/:108. Both child implementations are fully read: they render rows/tuples, not quiz-profile branches. The composed keeper has the same surface-support product tuple as the child fixture.
* `buildQuizResultNarrative` at result-narrative.ts:1018 resolves raw primary concern before `projectQuizAnswersForLegacyConsumers`, then calls `resolveQuizNeed(answers, statedConcern)`. Need lane, primary-concern, normalization, validators and the entire 1045-line narrative owner were read. The null-lane transfer must observe the exact base headline as well as null concern; intro alone is insufficient.
* QuizInfoStrip and QuizAnalysis get package copy through QuizFunnelPackageProvider context; the provider intentionally never writes module-singleton store during SSR and applies browser package before first child. Full provider, info strip, analysis, funnel-copy, funnel-package resolver and store implementations were read. Keep signed cookie/default/bootstrap authority, browser first render, async context publication, draft package and moderator-reset tests distinct.
* Full `HairPortrait` file and gallery were read. `/labs/portrait/page.tsx` currently renders HairPortraitGallery, which renders HairPortrait. Retain the gallery and shared renderer. `35f56ce9` added HairPortraitArtwork to preparation; **9c02f20f (#329)** removed that exact import/render while replacing the old preparation experience. Current repository reference census finds no artwork consumer outside its definition/type/two tests. This is concrete retirement evidence, not inference from internal naming.
* Quiz artifact POST delegates to `handleQuizResultArtifactRequest` -> `handleResultArtifactEmail` -> actual `buildQuizResultArtifactEmailPayload` -> `buildPersonalPlanResultArtifactEmailPayload` -> injected send. Route, service, both builders, stored normalizer/schema and prepared-plan builder were read. The send port is a capture only; it does not manufacture the asserted payload. **ebf263b6 (#422)** explicitly moved regular email to the shared compact Personal Plan contract and prohibited products/routine/free text. The route requires a configured message ID before claim; therefore leave default-ID proof at the shared serializer's real default contract, and test configured delivery at the actual route.
* `b34d6787 (#316)` preserves historical quiz/result computation while retiring offer presentations. It does not authorize deleting normalization, legacy need/profile or current prepared-plan logic. Guided product helpers are actually called by buildPersonalPlanPreparedArtifact at :294–295, so their private naming is not retirement proof.
* Package `test:node` at package.json:49 includes all cohort .test.ts/.test.tsx files; `.github/workflows/ci.yml:158` runs it. Native runner is Node with server-only register and tsx imports. No Playwright/browser runner is required by these proposals.

## Exact removal ledger
### C01 — C — `tests/quiz-result-transformation-card.test.tsx:20`

`transformation card renders Heute / In 4 Wochen columns with each row's before and after copy`

Primary keeper: `tests/quiz-results-view.test.tsx:9`.

Input / lost assertions / transfer: Move every escaped row.before/row.after assertion, the E47474 gradient exclusion, and currentPosition/targetPosition exclusion into the existing composed-view render. It already checks both column headings and E35858 removal. Existing view input is wavy/normal/lightly uneven/balanced pull/dryness/shine; removed input differs in roughness and goals, but this renderer receives only the resulting three rows and never branches on those quiz inputs. Keep literal narrative oracles in result-narrative tests.

Actual-owner control: Blank a row before/after in QuizResultTransformationCard, swap after for before, or serialize raw positions: the transferred composed-view assertions must fail.
### C02 — C — `tests/quiz-result-transformation-card.test.tsx:52`

`transformation card renders the green arrow connector`

Primary keeper: `tests/quiz-results-view.test.tsx:9`.

Input / lost assertions / transfer: Transfer aria-label="Transformation" to the existing composed render. The title promises a green arrow, but the body checks only this label. There is no straight-hair renderer branch; raw hair answers never reach this component. Do not claim this preserved an unasserted arrow/color contract.

Actual-owner control: Delete/change the article accessible label in actual child source; composed keeper must fail.
### C03 — C — `tests/quiz-result-lever-rows.test.tsx:8`

`lever rows renders the primary product with a star and the secondary product with a plus`

Primary keeper: `tests/quiz-results-view.test.tsx:9`.

Input / lost assertions / transfer: The keeper dryness/shine fixture resolves surface_support and the identical Conditioner/Leave-in tuple: assert both literal names and descriptions, and exact primary/secondary aria labels there. Child is unconditional tuple destructuring, with no independent product-selection input branch. Existing title claims star/plus but does not assert glyphs; no such claim is lost.

Actual-owner control: Drop secondary product description or swap tuple fields in QuizResultLeverRows; composed keeper must fail.
### C04 — C — `tests/quiz-result-narrative.test.ts:280`

`surface branch explains the main lever with multiple fitting categories`

Primary keeper: `tests/quiz-result-narrative.test.ts:6`.

Input / lost assertions / transfer: Exactly identical wavy/normal/rau/stretches_bounces/frizz/[less_frizz,shine] input. Transfer the exact mainLeverProducts sentence to :6, replacing its weaker three regex checks. The products deepEqual already matches. No new call/site.

Actual-owner control: Change the surface mainLeverProducts literal while retaining Conditioner and Leave-in tokens; exact retained assertion must fail.
### D01 — D — `tests/quiz-funnel-copy.test.tsx:57`

`scan_v1 copy never contains the retired verdict wording`

Primary keeper: `tests/quiz-funnel-copy.test.tsx:34 and :50`.

Input / lost assertions / transfer: All seven flattened values are already exact literal oracles at :34 and the name/blank cases at :50. Lena versus padded Lena and empty versus whitespace follow the same explicitly tested trim path. The retired-word guard cannot fail while the exact values pass. No untested package is added by this declaration.

Actual-owner control: Insert Urteil into a scan copy field: the exact literal keeper fails; no special obsolete behavior control is required.
### D02 — D — `tests/quiz-funnel-copy.test.tsx:76`

`no funnel package promises a set-up scanner before the offer`

Primary keeper: `tests/quiz-funnel-copy.test.tsx:9 and :33; quiz-analysis.test.tsx:137`.

Input / lost assertions / transfer: null/default_organic/scan_v1 loading headings are already exact literal outputs in :9/:34. The actual scan loading render also prohibits the setup promise. This negative substring declaration adds no input/default/platform branch.

Actual-owner control: Change scan loading text to Wir richten deinen Scanner ein: actual view :136 and literal :34 fail.
### C05 — C — `tests/quiz-funnel-copy.test.tsx:83`

`the scan_v1 loading line explains what the quiz answers are for`

Primary keeper: `tests/quiz-analysis.test.tsx:137`.

Input / lost assertions / transfer: The actual QuizAnalysisView loading render calls getQuizFunnelCopy(scan_v1) and already asserts both exact same regexes plus the forbidden post-purchase promise. No transfer needed.

Actual-owner control: Change either scan sentence in getQuizFunnelCopy actual record; actual render fails.
### C06 — C — `tests/quiz-funnel-copy.test.tsx:94`

`the info strip renders the scan copy through the provider during a server render`

Primary keeper: `tests/quiz-funnel-package-context.test.tsx:226`.

Input / lost assertions / transfer: Same provider scan_v1 + QuizInfoStrip SSR tree; stronger keeper also establishes initial store null and verifies it remains null. Transfer doesNotMatch organic body to :226.

Actual-owner control: Make provider context organic or append organic copy to info strip: retained SSR render fails. A server-store write must also fail the retained null assertion.
### D03 — D — `tests/quiz-funnel-package-context.test.tsx:54`

`an organic quiz store carries no funnel package`

Primary keeper: `tests/quiz-funnel-package-context.test.tsx:61`.

Input / lost assertions / transfer: Body explicitly calls reset then setFunnelPackageKey(null), so it does not prove organic initial state. :61 already exercises scan -> default_organic -> null and asserts every state. Reset preserving an existing package remains separately protected at :101. No initial-state contract is removed because this declaration never observed it.

Actual-owner control: Make setter ignore null: :61 fails. Do not claim this tests initialState or reset-null behavior.
### C07 — C — `tests/quiz-funnel-package-context.test.tsx:117`

`the provider never mutates the shared store during a server render`

Primary keeper: `tests/quiz-funnel-package-context.test.tsx:226`.

Input / lost assertions / transfer: Identical initial null store and scan provider SSR. Literal span passthrough is subsumed by rendering the actual consumer with exact scan text, while the no-mutation assertion is already identical. No new invocation or transfer.

Actual-owner control: Unconditionally write scan key on server render or suppress provider children: :226 fails.
### C08 — C — `tests/quiz-analysis.test.tsx:40`

`headings personalize with a trimmed name and fall back grammatically`

Primary keeper: `tests/quiz-analysis.test.tsx:122 and :136`.

Input / lost assertions / transfer: Move heading coverage to existing loading renders: use name=" Lena " at organic :122 and retain exact visible Einen Moment, Lena.; use name="" at scan :137 and assert exact Einen Moment. All other phase/copy assertions remain. This adds real trimming coverage absent from the old misleading title and preserves blank grammar through an actual renderer. No new test sites/renders.

Actual-owner control: Remove trim from getLoadingHeading; padded organic render fails. Return comma-name form for empty input; scan render fails.
### D04 — D — `tests/hair-portrait.test.tsx:55`

`HairPortraitArtwork renders the complete selected portrait without analysis controls`

Primary keeper: `tests/No replacement required for retired HairPortraitArtwork export; shared HairPortrait tests :128, :159, :250 remain`.

Input / lost assertions / transfer: 9c02f20f explicitly removed its only production import/render from QuizPreparation. Current tracked reference census finds only its definition/type and these two tests. Remove unused HairPortraitArtwork export/type and test import. Shared PortraitArtworkComposition and HairPortrait stay; /labs/portrait still uses the gallery. The preparation-only className/no-markers contract has no current consumer.

Actual-owner control: No fabricated mutation keeper for a retired export. Re-run remaining portrait/gallery contracts and verify no non-test references. Shared body/image stacking stays covered at :128.
### D05 — D — `tests/hair-portrait.test.tsx:82`

`HairPortraitArtwork accepts raw answers and omits the shared body for ownBody assets`

Primary keeper: `tests/No replacement required for retired HairPortraitArtwork export; HairPortrait ownBody keeper :159 remains`.

Input / lost assertions / transfer: Same retirement evidence. This was the retired wrapper rawAnswers path, not evidence that current HairPortrait/raw-answer support should be removed. Delete only artwork-only wrapper/type/tests; leave shared config-source union and shared resolver intact.

Actual-owner control: No mutation required for removed unused wrapper. Existing HairPortrait :159 still catches erroneously drawing shared body for ownBody pixie assets.
### C09 — C — `tests/hair-portrait.test.tsx:234`

`HairPortrait keeps complete copy in the non-visual equivalent only`

Primary keeper: `tests/hair-portrait.test.tsx:99`.

Input / lost assertions / transfer: Identical wavy/high/medium/dauerwelle config, same priorities and selection index 0. Transfer the two exactly-once text counts and obsolete visible-border exclusion into :99, which already asserts decorative image and both accessible sentences.

Actual-owner control: Duplicate summary/treatment sr-only text or add the retired border section: strengthened :99 fails.
### C10 — C — `tests/hair-portrait.test.tsx:293`

`HairPortrait image fallback advances once to generic and then terminal hidden state`

Primary keeper: `tests/hair-portrait.test.tsx:323, :373, :388`.

Input / lost assertions / transfer: Real failure boundary already proves selected -> generic and generic -> hidden. Extend :373 with a second failure call using its returned hidden state and assert unchanged hidden result; this transfers terminal idempotence through the real owner. getNextPortraitImageState generic/hidden branches cannot execute from its only caller: generic returns earlier on GENERIC src, hidden returns early because expectedRenderedSrc is null. Remove helper export/function and inline state:"generic" in the final return after checking the census.

Actual-owner control: Actual getNextPortraitImageFailure final selected return wrongly hidden must fail :323; change generic failure to generic must fail :373; terminal retry resurrecting an image must fail the transferred assertion. Do not mutate the removed unreachable helper branches.
### C11 — C — `tests/hair-portrait.test.tsx:299`

`HairPortrait image fallback compares same-origin absolute and relative image paths`

Primary keeper: `tests/hair-portrait.test.tsx:323`.

Input / lost assertions / transfer: Existing real failure case already distinguishes matching localhost absolute wavy from different localhost curly path. Add the third direct input as a cross-origin failure https://example.com/images/quiz/hair-portrait/wavy-long.webp against the selected local wavy path and assert unchanged initialFailure. This preserves external-origin distinction at the actual guard. Keep normalizer implementation because it also guards the cached-image effect; remove only its test import/export visibility if desired, never the function.

Actual-owner control: Normalize every absolute URL to pathname regardless of origin: transferred cross-origin case must fail. Existing same-origin case catches refusing valid absolute src.
### C12 — C — `tests/quiz-primary-concern.test.ts:150`

`need lane: several concerns without a pick run with no primary concern`

Primary keeper: `tests/quiz-primary-concern.test.ts:225`.

Input / lost assertions / transfer: Both use COMPLETE + concerns:[breakage,frizz] + goals:[] + absent primary_concern. Add primaryConcern===null, primaryGoal===null, and exact base heroHeadline to existing narrative keeper. buildQuizResultNarrative resolves the raw stated concern, projects legacy values, then invokes resolveQuizNeed; base headline uniquely observes lane=base. Existing intro assertion alone does not observe the lane.

Actual-owner control: Change resolveQuizNeed for the no-pick/no-goal case to surface_support: base hero assertion fails. Wrong primary_concern inference must fail primaryConcern/null or narrative copy. Do not replace with a direct helper call.
### C13 — C — `tests/quiz-result-artifact-email.test.ts:41`

`uses the personal-plan transactional email without exposing product details`

Primary keeper: `tests/quiz-result-artifact-route.test.ts:159 (claims, sends...) plus personal-plan-result-artifact-email.test.ts:54`.

Input / lost assertions / transfer: The route happy fixture is the identical lead UUID, Lea Beispiel, lea@example.com, site URL and complete wavy/fine/medium/leicht_uneben/stretches_stays/ausgeglichen/no issue/frizz+dryness/gefaerbt/less_frizz+moisture input. Transfer profile_line, lead_id, CTA, exact attributed URL, diagnostic array, and absence of foundation_products/routine_levers/products onto captured sends[0]. Use configured ID 42 on this real delivery keeper and restore env. Default message-ID behavior stays at shared actual serializer keeper :54, which clears the same env key and asserts the fallback. Do NOT simulate valid production configuration by claiming default/no-env is configured.

Actual-owner control: Leak products into actual builder or alter profile_line/focus URL: route captured-payload assertions fail. Default serializer ID mutation is caught by shared :54.
### C14 — C — `tests/quiz-result-artifact-email.test.ts:66`

`builds the compact diagnosis from the regular result-page assessment model`

Primary keeper: `tests/quiz-result-artifact-route.test.ts:159 (claims, sends...)`.

Input / lost assertions / transfer: Transfer exact 3 diagnostic row id/title/today_label array to the same captured route payload: surface_frizz/Oberfläche & Frizz/viel Potenzial; moisture_softness/Feuchtigkeit & Geschmeidigkeit/viel Potenzial; breakage_stability/Stabilität/gute Basis. Do not calculate expected rows using the assessment implementation.

Actual-owner control: Drop/reorder/change an emitted diagnosis row in actual legacy email builder or serializer: route assertion fails.
### C15 — C — `tests/quiz-result-artifact-email.test.ts:100`

`uses the configured personal-plan transactional message id`

Primary keeper: `tests/quiz-result-artifact-route.test.ts:159 plus personal-plan-result-artifact-email.test.ts:142`.

Input / lost assertions / transfer: Set the actual configured env key to string42 around the existing route send keeper and assert captured transactionalMessageId===42, with try/finally restoration. Shared serializer already tests numeric conversion at :142. This proves the regular route forwards the actual shared configuration and eliminates the wrapper replay.

Actual-owner control: Use an old quiz message ID or bypass the shared configured ID in actual legacy builder: route assertion fails. Numeric conversion mutation fails shared :142.
### C16 — C — `tests/quiz-result-artifact-email.test.ts:111`

`never includes free quiz text in the harmonized email`

Primary keeper: `tests/quiz-result-artifact-route.test.ts:159 (claims, sends...)`.

Input / lost assertions / transfer: Add concerns_other_text:"<b>do not send</b>" to that existing claimed fixture and transfer both absence-of-key and serialized-secret-text exclusions to captured messageData. Normalization and strict stored schema preserve this valid short field, so this reaches the actual builder; it is not stripped upstream. Same diagnostics and full route send/sent assertions remain.

Actual-owner control: In actual buildQuizResultArtifactEmailPayload add the raw free text to messageData: route payload assertion must fail, rather than mutating an unrelated mock.
### C17 — C — `tests/quiz-offer-preview.test.ts:210`

`cadence uses the canonical base scalp target and labels it as a starting point`

Primary keeper: `tests/guided-story-legacy-regression.test.ts:77 (legacy guided-story output locks), scalp.preview.needs`.

Input / lost assertions / transfer: The old direct cadence input is fettig+schuppen, normal/medium. Retained scalp preview input is fettig+schuppen, fine/low, explicitly has_scalp_issue=true and complete facts. deriveWashCadence reads only scalp_type/condition; full preview.needs pins the identical 3-4x/Woche, Startpunkt aus deinem Quiz and Bei jeder Haarwäsche outputs. The removed raw partial state lacks has_scalp_issue but deriveOfferPreviewNeedProfile has only the normalized builder as a production caller. No independent external raw-input contract is lost.

Actual-owner control: Change actual offer-preview deriveWashCadence to 2x/Woche or remove Startpunkt/conditioner cadence: full retained scalp.preview.needs literal fails. Do not mutate guided-story-products separate cadence owner.

## Cleanup and verification contract

Delete the two now-empty child-renderer test files after transfers; keep their production components because the actual result view still calls both. Move the escapeHtml utility only if required by the composed keeper, retaining no unused direct child imports. Prefer independent literal text plus correct escaped comparisons, not expected values obtained by re-rendering the child.

Remove only artwork-specific exported function/type/import. Keep HairPortraitConfigSource/getPortraitConfig, shared PortraitArtworkComposition, generic image behavior, and the lab/gallery route. Its optional internal className parameter becomes unused and can be removed as a local follow-up only after confirming no remaining caller; this is not additional test credit. Inline the selected-to-generic transition only after the real failure-boundary transfer/control passes; do not remove the normalizer because the cached-image effect also uses it.

Email cleanup removes the four wrapper declarations and their now-unused message constants/env helper as appropriate. The two retained email tests still need buildPayload: current-versus-legacy diagnosis equivalence is a distinct raw-vocabulary contract, and arbitrary lead `lead/with spaces` reaches the serializer but cannot pass the route UUID schema. Do not delete either just because the route exists. The legacy-regression compact-email profile is medium thickness instead of fine and retains its independent profile-line projection.

Focused native command (parent only, after the active shared runner is idle):

```sh
node --import ./tests/server-only-register.cjs --import tsx --test tests/quiz-results-view.test.tsx tests/quiz-result-transformation-card.test.tsx tests/quiz-result-lever-rows.test.tsx tests/quiz-result-narrative.test.ts tests/quiz-primary-concern.test.ts tests/quiz-funnel-copy.test.tsx tests/quiz-funnel-package-context.test.tsx tests/quiz-analysis.test.tsx tests/hair-portrait.test.tsx tests/hair-portrait-gallery.test.tsx tests/quiz-result-artifact-email.test.ts tests/quiz-result-artifact-route.test.ts tests/personal-plan-result-artifact-email.test.ts tests/quiz-offer-preview.test.ts tests/guided-story-legacy-regression.test.ts
```

Omit deleted filenames in the after command; preserve all existing failures rather than treating them as a pruning benefit. Run before, transfer-only, after, then narrowly targeted temporary controls against actual owners with restore/hash checks. The parent's full canonical coverage command must still show the required <=2pp decline; this report supplies no substitute coverage claim. For environment-setting email keeper use exact prior-value restoration in finally, including absent-vs-empty distinction. No .env file is needed.

## Rejected blanket cuts and retained risks

* Need-lane's 14 fixtures are one AST declaration and include distinct stretch-only no-repair, corroborated moderate damage, oily-only base, and scalp-condition/no-length-concern states. Four legacy snapshots do not cover all of them. No table regrouping credit.
* Primary-concern aliases and nonlegacy concerns are not all interchangeable. Raw two-concern projection can collapse to one; explicit stated concern must override that collapse. Keep that dedicated input and the medically adjacent hair-loss copy boundary. C12 is limited to the truly identical no-pick/no-goal fixture.
* Guided product tests exercise a different selection owner from offer preview: ranked priority evidence controls extras, including fallback suppression, rough-surface complement outranking masks, oil requiring ends priority, and neutral/coarse/oily behavior. Prepared artifact computes with that implementation, not the older lane-based one. No cross-owner dedup merely from similar outputs.
* Normalization fixtures distinguish omitted/null/malformed storage, legacy pull/scalp aliases, raw order and first-seen volume conflicts, stale primary picks, strict new-submission versus permissive stored hair length, and unknown/free-text behavior. The observed full-route fixture does not cover that input domain. No broad normalization removal is supported.
* The artifact route's configured-vs-unconfigured, scanner-vs-organic attribution, query error, moderator exclusion, old sending/sent/failed status, null name, race, redaction and malformed stored answers are retained. A hand-written store simulates the persistence port, so race tests prove service protocol over an atomic-claim contract, not actual PostgreSQL concurrency. That limitation does not justify deleting the distinct service dispatch behavior.
* Customer.io old-template tests protect an operator script and real canonical template files, including exact target/message pairing, active-confirmation, schema drift, concurrency/readback and legal-layout controls. Production email modernization alone is not proof the operator is retired. No deletion is proposed without command/operator reachability evidence.
* HairPortrait selected, ownBody, marker a11y, marker percentages, generic summary, legacy fallback labels, duplicate/stale failure and selected-already-generic cases remain. SSR cannot prove onError/useEffect timing, so this report does not substitute gallery markup for those stateful owner guards.
* F: `quiz-result-narrative.test.ts:422` says “balanced fallback” but uses frizz/less_frizz and asserts surface-support copy. Rename to the actual surface-support headline contract if retained; do not claim it tests base-lane fallback. C12 adds exact base-headline proof to an existing actual narrative fixture.

## Per-declaration read inventory

`R-hold` below means complete body read, no deletion evidence proposed; it is not a claim that all transitive sources/history were re-audited or that the title alone proves value. The section above records concrete retained input distinctions. Candidate decisions are fully specified in the removal ledger. This distinction is intentional: 257 body reads must not be reported as 257 completed owner/mutation audits.

### tests/quiz-primary-concern.test.ts — 22 sites

| Line | Status | Exact test title |
|---:|---|---|
| 102 | R-hold | resolveStatedPrimaryConcern: ${row.name} |
| 107 | R-hold | a pick is asked for only with two or more concerns |
| 113 | R-hold | reconcilePrimaryConcern keeps a contained pick and drops a stale one |
| 119 | R-hold | toLegacyQuizConcern maps aliases and leaves the four non-legacy codes out |
| 138 | R-hold | need lane: the stated pick decides, not a weight ranking |
| 150 | C C12 | need lane: several concerns without a pick run with no primary concern |
| 156 | R-hold | need lane: aliases map into the legacy vocabulary |
| 178 | R-hold | need lane: stated ${nonLegacy} falls back to no primary concern |
| 190 | R-hold | need lane: the explicit stated concern wins over a collapsed legacy projection |
| 201 | R-hold | narrative: the stated pick drives the intro and the friction row |
| 213 | R-hold | narrative: legacy multi-concern answers without a pick get neutral copy |
| 225 | R-hold | narrative: legacy multi-concern answers without a pick and without goals stay neutral |
| 245 | R-hold | narrative: stated ${concern} has its own copy and does not crash |
| 262 | R-hold | narrative: hair loss keeps the medical boundary and promises no product result |
| 276 | R-hold | offer preview lane follows the stated pick from the raw answers |
| 297 | R-hold | lead schema accepts the new key and still accepts answers without it |
| 311 | R-hold | lead schema never rejects a stale pick; canonicalisation drops it |
| 321 | R-hold | lead schema rejects a pick outside the concern vocabulary |
| 327 | R-hold | canonicalisation keeps a contained pick |
| 336 | R-hold | stored re-read: old answers without the key and new answers with it both parse |
| 353 | R-hold | stored re-read drops a stale pick instead of failing |
| 365 | R-hold | profile projection writes the legacy vocabulary like concerns |

### tests/quiz-guided-story-priorities.test.ts — 18 sites

| Line | Status | Exact test title |
|---:|---|---|
| 40 | R-hold | exports the nine locked priority families |
| 57 | R-hold | runtime copy includes active family variants plus the approved positive fallback only |
| 92 | R-hold | legacy fallback copy stays separate from the approved matrix records |
| 123 | R-hold | selects every active approved variant on its supported path |
| 277 | R-hold | tier precedence keeps active breakage ahead of a lower-tier matched goal |
| 291 | R-hold | matching goals win within the same tier before fixed family order |
| 305 | R-hold | concern coverage wins before fixed tie order |
| 319 | R-hold | fixed family order is the last deterministic tie-break |
| 332 | R-hold | supporting priorities keep remaining stated concerns ahead of goal-only findings |
| 348 | R-hold | balanced no-concern profile uses selected goals and an honest positive fallback |
| 368 | R-hold | shine never suppresses or rewrites a co-selected less-frizz goal |
| 385 | R-hold | sparse no-concern profiles do not repeat positive scalp foundations |
| 399 | R-hold | healthy scalp goal can centralize a dry or oily scalp state without an active condition |
| 412 | R-hold | scalp condition is read from the separate condition fields, not stale free-form scalp values |
| 426 | R-hold | fully incomplete legacy answers return exactly three approved fallback priorities |
| 446 | R-hold | free-text concerns are not classified into medical or cosmetic routes |
| 455 | R-hold | healthier_hair modifies a supported specific family but never becomes its own family |
| 469 | R-hold | a true four-family profile merges close neighbors so every concern stays visible |

### tests/quiz-guided-story-products.test.ts — 9 sites

| Line | Status | Exact test title |
|---:|---|---|
| 38 | R-hold | derives every shampoo route and thickness, including the neutral coarse-oily fallback |
| 62 | R-hold | preserves direct conditioner balance from the pull test |
| 78 | R-hold | does not add a mask from the pull test alone or unrelated priorities |
| 86 | R-hold | bond care wins for Tier-1 damage plus chemical treatment |
| 116 | R-hold | matching priorities unlock protein and moisture masks |
| 138 | R-hold | rough surface unlocks a complementary leave-in and texture chooses its variant |
| 171 | R-hold | oil requires an ends priority; shine alone does not create it |
| 186 | R-hold | returns two cards when no truthful extra exists and three when one does |
| 196 | R-hold | incomplete profiles keep fallback priorities out of the targeted-product decision |

### tests/quiz-need-lane.test.ts — 2 sites

| Line | Status | Exact test title |
|---:|---|---|
| 98 | R-hold | need lane: ${fixture.name} |
| 103 | R-hold | bond repair wins when overlapping mask and surface signals are present |

### tests/quiz-normalization.test.ts — 23 sites

| Line | Status | Exact test title |
|---:|---|---|
| 13 | R-hold | natur stays exclusive in treatment selection |
| 19 | R-hold | colored and bleached can be combined |
| 26 | R-hold | chemical shape treatments combine with color treatments in canonical order |
| 35 | R-hold | chemical shape treatments remain exclusive with natur |
| 44 | R-hold | legacy pulltest values are normalized |
| 59 | R-hold | density values are normalized and invalid values are removed |
| 66 | R-hold | hair length values are normalized and invalid values are removed |
| 71 | R-hold | legacy scalp values still map to type and condition |
| 86 | R-hold | legacy no-issue scalp answers normalize to a negative scalp gate |
| 102 | R-hold | stored answers without the new concern or scalp gate fields backfill clean defaults |
| 116 | R-hold | free-text concern notes are trimmed and empty strings are removed |
| 125 | R-hold | blank free-text concern notes normalize to undefined |
| 134 | R-hold | legacy free-text concern notes are clamped to the current 50-character limit |
| 142 | R-hold | shared hair-loss concern is added once after hair damage with reviewed copy |
| 158 | R-hold | canonicalization drops invalid natur conflicts |
| 185 | R-hold | goals are passed through when valid (sorted to canonical GOALS order) |
| 195 | R-hold | two goal lists with the same items in different order normalize equal |
| 201 | R-hold | invalid goal values are filtered out |
| 210 | R-hold | new quiz goals preserve every unique shared selection |
| 236 | R-hold | goals drop the conflicting volume/less_volume pair (keeps first occurrence) |
| 245 | R-hold | missing or empty goals normalize to undefined |
| 251 | R-hold | canonicalization carries goals through in canonical GOALS order |
| 267 | R-hold | shared quiz values project once into the existing profile vocabulary |

### tests/quiz-validators.test.ts — 15 sites

| Line | Status | Exact test title |
|---:|---|---|
| 21 | R-hold | quiz schema accepts an empty concern array with a negative scalp gate |
| 29 | R-hold | quiz schema requires density as the third physical hair attribute |
| 36 | R-hold | quiz schema requires hair length as the fourth physical hair attribute |
| 43 | R-hold | quiz schema accepts free-text-only concern notes |
| 52 | R-hold | quiz schema accepts all nine shared concerns and rejects duplicates or unknowns |
| 73 | R-hold | quiz schema requires a scalp condition when the user reports an active issue |
| 82 | R-hold | quiz schema rejects a scalp condition when the scalp gate is negative |
| 91 | R-hold | quiz schema does not use colored as a concern code |
| 100 | R-hold | quiz schema accepts multiple non-natural chemical treatment values |
| 109 | R-hold | quiz schema rejects natur combined with a chemical shape treatment |
| 118 | R-hold | quiz schema accepts 50-character concern notes and rejects longer text |
| 132 | R-hold | quiz schema accepts all eight shared goals and historical stored goal values |
| 160 | R-hold | quiz schema rejects unknown goal values |
| 169 | R-hold | quiz schema rejects volume + less_volume together |
| 178 | R-hold | quiz schema rejects duplicate goals |

### tests/quiz-offer-preview.test.ts — 9 sites

| Line | Status | Exact test title |
|---:|---|---|
| 14 | R-hold | the curated registry is coverage-driven and every record has a product identity and image |
| 24 | R-hold | all scalp-route and thickness profiles select a deterministic shampoo example |
| 67 | R-hold | fine oily profiles use a regular shampoo example without deep-cleansing naming |
| 89 | R-hold | all thickness and balance profiles select a conditioner without crossing those hard axes |
| 119 | R-hold | conditioner signal exposes thickness and balance direction without claiming a density-matched weight |
| 137 | R-hold | a surface-led result shows two foundation examples and one leave-in suggestion |
| 170 | R-hold | a neutral or colored-only result stays at shampoo and conditioner |
| 193 | R-hold | curl definition chooses the curl leave-in example without claiming a universal pattern fit |
| 210 | C C17 | cadence uses the canonical base scalp target and labels it as a starting point |

### tests/quiz-result-narrative.test.ts — 28 sites

| Line | Status | Exact test title |
|---:|---|---|
| 6 | R-hold | surface-led results expose scope labels, bucketed positions, concise goal copy, and a main lever |
| 49 | R-hold | the stated main problem drives the friction row |
| 70 | R-hold | treatment no longer re-ranks concerns: only her pick names the main problem |
| 104 | R-hold | multi-goal intro acknowledges additional selected goals with unter anderem and mirrors the concern |
| 120 | R-hold | no-concern fallback can become scalp-led when scalp is the strongest real friction |
| 165 | R-hold | an explicit dryness concern keeps row two and the main lever out of the scalp fallback |
| 186 | R-hold | ansatz fallback stays concise without repeating location words |
| 202 | R-hold | primary goal falls back to the existing ordered selected goals when no direct match is selected |
| 221 | R-hold | severe structural signals can mention bondbuilder support in the main lever |
| 246 | R-hold | chemical straightening with roughness routes to stability without changing natural texture |
| 265 | R-hold | dauerwelle alone does not hard-route to the bondbuilder stability lever |
| 280 | C C04 | surface branch explains the main lever with multiple fitting categories |
| 300 | R-hold | scalp branch explains the main lever with product-specific follow-through |
| 319 | R-hold | split-ends branch explains the main lever with tip-focused product guidance |
| 339 | R-hold | chemical stress tiers calibrate split-end narrative severity |
| 375 | R-hold | fallback branch still offers a concise but fuller product bridge |
| 395 | R-hold | hero headline maps overextended pull test to protein-led result |
| 410 | R-hold | hero headline maps snapping pull test to moisture-led result |
| 422 | F title | hero headline has a balanced fallback |
| 437 | R-hold | fixed row labels and CTA copy stay compact |
| 461 | R-hold | scalp-irritated branch fires when scalp_condition === gereizt and no concern is set |
| 489 | R-hold | scalp-oily-balanced branch fires when scalp_type signals oily without a specific scalp_condition |
| 517 | R-hold | protein-moderate branch fires when pulltest=stretches_stays without severe-damage signals |
| 543 | R-hold | moisture-needs branch fires when pulltest=snaps |
| 569 | R-hold | curl-definition branch fires when primaryGoal=curl_definition and structure is wavy/curly/coily |
| 594 | R-hold | curl-definition does not claim a curl-specific product for straight recorded texture |
| 609 | R-hold | chemical straightening does not unlock curl-definition narrative for straight natural texture |
| 624 | R-hold | shine branch fires when primaryGoal=shine and no earlier branch matches |

### tests/personal-plan-prepared-plan.test.ts — 9 sites

| Line | Status | Exact test title |
|---:|---|---|
| 55 | R-hold | V2 adapter uses the fixed taxonomy, diagnostic priority, and required elasticity answer |
| 78 | R-hold | multiple scalp concerns retain the safest supported shampoo direction |
| 89 | R-hold | volume balance follows factual hair signals instead of selection order |
| 117 | R-hold | new damage concern is retained without merging it into Frizz |
| 126 | R-hold | combined hair-loss concern appends profile compatibility without displacing routine concerns |
| 153 | R-hold | prepared artifact contains three public dimensions but keeps products and routine locked |
| 174 | R-hold | prepared artifact keeps email priority separate from the offer assessment |
| 198 | R-hold | straight, wavy, curly, and coily complete profiles all prepare deterministic plans |
| 225 | R-hold | canonical answer hash ignores selection order but changes with durable answers |

### tests/personal-plan-quiz.test.ts — 18 sites

| Line | Status | Exact test title |
|---:|---|---|
| 18 | R-hold | quiz transition direction follows the navigation action, not screen order |
| 36 | R-hold | approved flow inserts the analysis bridge, midpoint, admission ladder, and daily commitment |
| 54 | R-hold | recurrence keeps ordinary history-stack Back semantics after moving beside concerns |
| 64 | R-hold | five stable checkpoint sections cover every semantic phase |
| 73 | R-hold | scalp concerns use one optional multi-select screen without a medical warning branch |
| 86 | R-hold | the later scalp tail still reaches a conflict prompt after recurrence moved earlier |
| 97 | R-hold | browser draft trims malformed current concern notes without resetting v4 drafts |
| 110 | R-hold | conflicting-needs prompt is shown only for a supported trade-off |
| 142 | R-hold | goals retain all eight selected domains without a cap |
| 161 | R-hold | draft preserves an explicit no-concerns answer across reloads |
| 175 | R-hold | prepared-plan answer keys survive the draft's canonical field ordering |
| 208 | R-hold | stale elasticity opt-outs return the user to the required test |
| 236 | R-hold | v4 drafts preserve exact concern recurrence and reject the retired v3 schema |
| 280 | R-hold | draft excludes lead PII and all conversion-only answers |
| 312 | R-hold | draft ignores removed rough-flow fields and malformed storage |
| 336 | R-hold | draft persistence tolerates restricted storage |
| 355 | R-hold | profile summary stays positive and derives four useful rows from durable answers |
| 375 | R-hold | materially different profiles produce recognizably different positive receipts |

### tests/quiz-preparation.test.ts — 9 sites

| Line | Status | Exact test title |
|---:|---|---|
| 25 | R-hold | preparation prefetches the result route only from the commitment handler |
| 40 | R-hold | preparation waits for a lead and the client auth session |
| 63 | R-hold | anonymous and already-entitled sessions are ready without an extra access request |
| 86 | R-hold | signed-in sessions without profile access wait for the matching server check |
| 101 | R-hold | a stalled access check settles after a bounded timeout |
| 125 | R-hold | access-check cleanup aborts work without marking it settled |
| 147 | R-hold | result artifact delivery starts once after preparation settles |
| 174 | R-hold | missing-lead recovery returns to the earliest incomplete lead field |
| 179 | R-hold | preparation threads retake mode and return destination into the canonical result |

### tests/quiz-results-view.test.tsx — 1 sites

| Line | Status | Exact test title |
|---:|---|---|
| 9 | R-hold | shared results view renders transformation card + structured lever rows |

### tests/quiz-result-transformation-card.test.tsx — 2 sites

| Line | Status | Exact test title |
|---:|---|---|
| 20 | C C01 | transformation card renders Heute / In 4 Wochen columns with each row's before and after copy |
| 52 | C C02 | transformation card renders the green arrow connector |

### tests/quiz-result-lever-rows.test.tsx — 1 sites

| Line | Status | Exact test title |
|---:|---|---|
| 8 | C C03 | lever rows renders the primary product with a star and the secondary product with a plus |

### tests/quiz-funnel-copy.test.tsx — 9 sites

| Line | Status | Exact test title |
|---:|---|---|
| 9 | R-hold | the default copy (organic, or any unknown package key) matches today's strings |
| 24 | R-hold | default commitHeading personalizes with a trimmed name and falls back grammatically |
| 34 | R-hold | scan_v1 swaps the info strip body, lead headline, commit copy, and loading headline verbatim |
| 50 | R-hold | scan_v1 commitHeading personalizes with a trimmed name and falls back grammatically |
| 57 | D D01 | scan_v1 copy never contains the retired verdict wording |
| 76 | D D02 | no funnel package promises a set-up scanner before the offer |
| 83 | C C05 | the scan_v1 loading line explains what the quiz answers are for |
| 94 | C C06 | the info strip renders the scan copy through the provider during a server render |
| 105 | R-hold | the info strip renders the default copy through the provider for an unattributed visit |

### tests/quiz-analysis.test.tsx — 11 sites

| Line | Status | Exact test title |
|---:|---|---|
| 17 | R-hold | phase resolution: commit until tapped, loading until elapsed AND ready, then ready |
| 40 | C C08 | headings personalize with a trimmed name and fall back grammatically |
| 45 | R-hold | loading beat holds for its minimum and cleanup cancels it |
| 64 | R-hold | ready beat waits 900ms before revealing and cleanup cancels it |
| 83 | R-hold | reduced motion skips both beats synchronously |
| 92 | R-hold | commit view shows exactly one question and both approved buttons, nothing else |
| 114 | R-hold | pending commit disables both buttons against double taps |
| 122 | R-hold | loading view shows the quiet beat copy with a status region and shimmer bar |
| 137 | R-hold | loading view carries the scan package's own line, not the post-purchase one |
| 154 | R-hold | ready view is only the beat headline |
| 164 | R-hold | one user action calls the reveal callback exactly once |

### tests/quiz-motivation-copy.test.ts — 3 sites

| Line | Status | Exact test title |
|---:|---|---|
| 11 | R-hold | quiz motivation copy matches the visible question count |
| 24 | R-hold | quiz question sequence drives special step counters |
| 32 | R-hold | goal cards expose selection state without repeated status pills |

### tests/quiz-funnel-package-context.test.tsx — 13 sites

| Line | Status | Exact test title |
|---:|---|---|
| 54 | D D03 | an organic quiz store carries no funnel package |
| 61 | R-hold | the server-resolved package key is authoritative in both directions |
| 72 | R-hold | the browser bootstrap may only fill a package key the cookie did not deliver |
| 86 | R-hold | restoring a browser draft keeps the funnel package of the running session |
| 101 | R-hold | a moderator fresh start clears quiz progress but keeps the funnel package |
| 117 | C C07 | the provider never mutates the shared store during a server render |
| 130 | R-hold | the provider applies the package key before the first child renders |
| 151 | R-hold | the quiz reads the package key out of the signed funnel cookie |
| 165 | R-hold | both quiz layouts initialize the store from the signed cookie |
| 178 | R-hold | a scan draft resumes on the insert it was saved on |
| 197 | R-hold | the same draft resumes organically on the question the insert sits behind |
| 226 | R-hold | a server-rendered package reaches the consumer copy without any bootstrap |
| 239 | R-hold | the bootstrap fallback publishes the effective package to the context too |

### tests/quiz-result-artifact-email.test.ts — 6 sites

| Line | Status | Exact test title |
|---:|---|---|
| 41 | C C13 | uses the personal-plan transactional email without exposing product details |
| 66 | C C14 | builds the compact diagnosis from the regular result-page assessment model |
| 85 | R-hold | projects current and legacy concern ids to the same email diagnosis |
| 100 | C C15 | uses the configured personal-plan transactional message id |
| 111 | C C16 | never includes free quiz text in the harmonized email |
| 118 | R-hold | encodes the lead id in the attributed result URL |

### tests/customerio-quiz-result-template.test.ts — 12 sites

| Line | Status | Exact test title |
|---:|---|---|
| 106 | R-hold | canonical HTML is an email-safe fragment under layout 1 |
| 132 | R-hold | canonical templates render the current trigger contract and no retired offer |
| 174 | R-hold | product meaning and both result links survive missing images |
| 198 | R-hold | capability section uses the approved grouped checklist hierarchy |
| 227 | R-hold | plain-text alternative is complete, multiline, and legally self-contained |
| 243 | R-hold | update request exactly uses canonical sources and preserves writable metadata |
| 271 | R-hold | subject uses the sanitized name without HTML entities |
| 276 | R-hold | operator preflight guards message state, pairing, and legal layout content |
| 310 | R-hold | operator fails closed when templates.update adds an unreviewed optional field |
| 323 | R-hold | operator guards template identity, concurrent changes, and final read-back |
| 361 | R-hold | operator flags guard exact message/template pairs and active confirmation |
| 421 | R-hold | there is only one canonical HTML body |

### tests/hair-portrait-gallery.test.tsx — 2 sites

| Line | Status | Exact test title |
|---:|---|---|
| 8 | R-hold | portrait lab keeps the development and Preview guard at the route boundary |
| 15 | R-hold | portrait gallery runs all 20 personalized states plus generic through HairPortrait |

### tests/hair-portrait.test.tsx — 17 sites

| Line | Status | Exact test title |
|---:|---|---|
| 55 | D D04 | HairPortraitArtwork renders the complete selected portrait without analysis controls |
| 82 | D D05 | HairPortraitArtwork accepts raw answers and omits the shared body for ownBody assets |
| 99 | R-hold | HairPortrait renders the selected generated portrait as a decorative priority image |
| 128 | R-hold | HairPortrait composes the exact visual layers around hair-only assets |
| 159 | R-hold | HairPortrait does not draw the shared body for approved ownBody pixie assets |
| 176 | R-hold | HairPortrait renders three native marker buttons with accessible selected state |
| 207 | R-hold | HairPortrait exposes potential labels and percentages in each marker's accessible name |
| 234 | C C09 | HairPortrait keeps complete copy in the non-visual equivalent only |
| 250 | R-hold | HairPortrait keeps generic copy unspecific when portrait axes are incomplete |
| 266 | R-hold | HairPortrait uses neutral visible labels for legacy fallback markers |
| 293 | C C10 | HairPortrait image fallback advances once to generic and then terminal hidden state |
| 299 | C C11 | HairPortrait image fallback compares same-origin absolute and relative image paths |
| 323 | R-hold | HairPortrait image fallback accepts absolute selected failures for the same path only |
| 347 | R-hold | HairPortrait image fallback ignores duplicate or stale selected failures after generic renders |
| 373 | R-hold | HairPortrait image fallback hides only after the rendered generic image fails |
| 388 | R-hold | HairPortrait image fallback hides immediately when the selected asset is already generic |
| 402 | R-hold | HairPortrait density does not change the selected asset or visual copy |

### tests/guided-story-legacy-regression.test.ts — 2 sites

| Line | Status | Exact test title |
|---:|---|---|
| 77 | R-hold | legacy guided-story output locks retain all four representative profile contracts |
| 679 | R-hold | result email uses the compact personal-plan contract and excludes free quiz text |

### tests/quiz-result-artifact-route.test.ts — 16 sites

| Line | Status | Exact test title |
|---:|---|---|
| 91 | R-hold | resolves the latest persisted scanner package without an analytics flag |
| 128 | R-hold | the production claim excludes moderator-owned legacy leads |
| 159 | R-hold | claims, sends, and marks the result artifact email sent |
| 179 | R-hold | does not claim or mutate when Customer.io transactional config is missing |
| 209 | R-hold | does not claim a scanner lead when its dedicated Customer.io config is missing |
| 237 | R-hold | does not claim when persisted funnel attribution is unavailable |
| 267 | R-hold | scanner attribution sends the scanner email for an existing lead without a consent gate |
| 294 | R-hold | skips personal-plan rows before parsing or sending a legacy result email |
| 312 | R-hold | skips when the result artifact email was already sent or is sending |
| 332 | R-hold | skips a failed result artifact email until manual retry resets it |
| 351 | R-hold | the harmonized result email does not require a first name |
| 371 | R-hold | two calls only send once with an atomic store claim |
| 398 | R-hold | two scanner requests only send once with the existing atomic claim |
| 426 | R-hold | send failure marks failed and redacts secret-ish tokens |
| 454 | R-hold | incomplete quiz answers fail before sending |
| 474 | R-hold | persisted attribution distinguishes absent or organic rows from lookup failure |

