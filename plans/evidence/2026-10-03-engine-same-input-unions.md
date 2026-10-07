# Engine same-input assertion-union challenge — eight ready conditional cuts

Read-only, 2026-10-03. Current main count319 is separate. **Eight C, zero D, no production changes, no new fixture cases; proposed152→144.** Historical seven engine cuts are already absent and receive zero additional credit. This corrects the generic all-R152 conclusion only where the exact current evidence below establishes a stronger existing keeper.

Completely read all5205 lines of the four current suites: selection2815/52 declarations, categories1209/48, foundation456/24, CareBalance725/28; shared foundation fixtures read fully. Exact literal site counts corroborated with text inventory; main's existing AST census supplied152. The new guarded driver's AST check is prepared but has NOT been executed. This report is not a fabricated new152-row all-R ledger.

## Ready candidate set

| ID | Donor | Existing keeper(s) | Exact input/owner equivalence and transfer |
|---|---|---|---|
| C1 | foundation:15 `persistence adapter maps supported routine categories and reports unsupported ones` | foundation:382 `severe-damage fixture drives high care needs and heat protection urgency` | Exact same SEVERE_DAMAGE_PROFILE and ADAPTER_ROUTINE_ITEMS. Keeper already holds adapted object from actual adapter; transfer every adapter assertion, including unsupported styling_gel, false heat-protection and canonical peeling identity/frequency. |
| C2 | foundation:63 `normalization produces a full inventory map keyed by V1 inventory categories` | foundation:382 `severe-damage fixture drives high care needs and heat protection urgency` | Same adapter and normalize calls with exact same profile/routine object; keeper already holds normalized. Transfer all seven inventory assertions, including both explicit null missing categories. |
| C3 | foundation:160 `low-damage fixture yields low repair need with protective factors` | foundation:240 `low-damage fixture keeps care needs conservative` | Same LOW_DAMAGE_PROFILE and empty routine; keeper already computes actual damage before careNeeds. Transfer every damage level/priority/confidence/protective membership assertion. |
| C4 | foundation:310 `severe-damage fixture yields severe structural load and bond builder recommendation` | foundation:382 `severe-damage fixture drives high care needs and heat protection urgency` | Same SEVERE_DAMAGE_PROFILE and ADAPTER_ROUTINE_ITEMS; keeper computes same damage result before careNeeds. Transfer every damage level/priority/confidence/driver membership assertion. |
| C5 | foundation:254 `straight natural texture plus perm supports explicit curl definition goal only` | categories:144 `straight natural texture with perm and definition goal routes leave-in to curl definition`; categories:160 `chemical straightening does not unlock curl-definition leave-in routing` | Donor two subinputs exactly equal the two existing category callback profiles and empty routine defaults. Both already assert respective moderate/none definition needs. Only permed detanglingNeed:none needs transfer; no case or input added. |
| C6 | foundation:289 `perm alone creates mild maintenance needs without curl definition` | categories:174 `perm maintenance can route leave-in to gentle support without curl definition` | Same LOW_DAMAGE_PROFILE override straight/permed/goals[] and empty routine. Keeper already computes actual normalized/damage/careNeeds via buildEngineState and asserts definition:none. Transfer hydration:low, smoothing:low, detangling:none. |
| C7 | categories:595 `leave-in target splits blow-dry heat protection from high-heat styling prep` | categories:635 `leave-in fit treats missing moderate blow-dry heat protection as a caveated support path` | Exact identical severe-profile overrides straight/normal/medium/blow_dry/heat never/blow_dryer/uses false, empty routine and same actual decision builder. Keeper adds an actual fit call; transfer moderate heat, no styling prep and heat_protect bucket before fit. |
| C8 | care-balance:495 `buildCareBalanceSet recommends adding absent shampoo` | care-balance:328 `buildCareBalanceSet returns one stable row per strong category` | Both call buildRows({}) with same empty routine and EMPTY_REQUEST_CONTEXT. Existing stable callback owns all rows and shapes. Transfer same assertRecommendation(rows,shampoo,add) helper call, no extra owner call/case. |

All transferred expectations remain literal. C1–C4 copy the entire donor assertion block, preserving nulls, booleans, driver/protective memberships, exact strings and array assertions. Their adapted/normalized/damage values already exist in the keeper; no production calls or helper-generated expected results are added. C1/C2/C4 share the same severe profile and exact same ADAPTER_ROUTINE_ITEMS array, including both serum and scrub canonicalization and unsupported styling_gel. C3 shares exactly LOW_DAMAGE_PROFILE and empty routine.

C5 does not fold independent new rows into a table. Its two existing inputs already execute in two separate existing category callbacks. The perm keeper already asserts moderate definition; transfer its only missing detangling:none. The straightening keeper already asserts definition:none, so leave it byte-identical. C6 transfers three missing fields to the already-existing exact empty-goals perm maintenance input, retaining the existing definition:none assertion. Do not replace it with the different permed-only Bondbuilder callback whose inherited goals differ.

C7 compares identical source profile objects, not merely similar heat titles. The explicit `blow_dry`, tools `[blow_dryer]`, heatStyling never and false protection are equal in donor and keeper. The keeper already builds the actual decision and then evaluates a product without protection. Transfer all three donor target literals before the fit call. Keep thermal-roller, no-tool explicit request and flat-iron request distinctions elsewhere.

C8 uses the same buildRows({}) invocation and defaults. The stable-row keeper already checks exact ten-category order and row shapes; add the exact existing `assertRecommendation(rows, "shampoo", "add")` call. This reasserts the same row, without another build or another input. It cannot be replaced by mere truthiness because `no_action` is also truthy.

Expected declaration counts after: selection52 unchanged, categories47, foundation18, CareBalance27 =144. Eight plain donor tests disappear; C5's two underlying input cases remain at their already-existing category callbacks, so no input case is lost and no runtime-row declaration credit is invented.

## Meaningful boundaries and actual callers

- `runtime.ts:126–183` composes actual adapter → effective normalized context → damage → care needs → reset/cadence/CareBalance/plan/category owners and exposes those results. The foundation keeper composition uses the same actual owners with no mocks; its intermediate output assertions protect contracts consumed downstream, not private identifier spelling.
- `adapters/from-persistence.ts:149–199` canonicalizes serum/scrub into peeling, merges frequencies/identities and retains unsupported category diagnostics. `runtime.ts:136,183` forwards diagnostics; `chat.ts:240` emits `unsupported_routine_categories`. Those diagnostics remain preserved by C1's literal array; they are not discarded as “debug only”.
- `normalize.ts:19–70` creates explicit null inventory slots and normalized names/frequencies, consumed by actual runtime and planners. C2 preserves that object shape independently from later category outcomes.
- `assessments/damage.ts:128–242` returns levels/priorities/confidence and driver/protective lists; `assessments/care-needs.ts:29–99` uses the resulting dimensions. Confidence and explanatory drivers can change without changing careNeeds; copied literal assertions explicitly retain those independent outputs in C3/C4.
- `categories/leave-in.ts:286–383` builds the actual target; `evaluateLeaveInFit` consumes it through the remaining code. C5/C6 preserve actual care-needs values used to derive definition or gentle-support routing. C7 retains target fields even where the downstream fit result alone is insufficient.
- `care-balance/evaluators.ts:282–303,715–733` dispatches actual Shampoo evaluation; absent item returns recommendation add. `chat-pipeline.ts:570–584` builds runtime and projects actionable rows; `build-or-fix-routine.ts:431–438` consumes runtime for care-driven planning. C8 therefore protects a live emitted recommendation.
- `agent/tools/select-products.ts:3259–3285` dispatches category selectors. Production selector wrappers in selection.ts acquire specs and call the actual rerank functions (Conditioner2149; Leave-in2435; Mask2505; Oil2317/2343; reset2722). Selection tests do not cover provider acquisition, but exercise real deterministic candidate ranking/metadata at a live boundary. No selection-layer or export retirement was proved.

All imported owners remain live. No source cleanup is necessary or proposed. This is an assertion-union consolidation of repeated exact fixtures, not removal of distinct admission, policy, shape, catalog or provider contracts.

## Concrete rejected shortcuts / remaining weak assertions

- Foundation fallback Shampoo cadence, absent profile with routine-derived cadence, absent profile with explicit derived cadence, and real unnamed inventory are different actual adapter branches. Same frequency strings do not make them duplicates. Keep legacy night protection versus explicit empty versus null distinctions.
- Category explicit heat request with saved tools versus wording without tools is independent input-source coverage. Neither replaces the other. Thermal rollers are distinct from blow-dryer exposure. The8 cut list contains only the exact blow-dryer profile duplicated verbatim.
- Selection preserveProductIds versus includeProductIds is deliberately different: inclusion permits assessment eligibility; preservation forces an item into the display limit. The mismatch assessment target, owned missing-spec filter and ordinary routine-owned target test protect distinct failures. Keep them.
- Oil exact-purpose sufficient coverage, adjacent bridge below threshold, null-purpose legacy subtype, and wrong concrete purpose are not the same branch. Similar fixed output IDs do not justify collapsing them.
- Bondbuilder retired/add-on exclusion differs from explicitly included owned products, severe-combo attachment and named K18/OLAPLEX comparison. No cut of those current callbacks is supported.
- Three default-looking Mask decision helpers in selection/categories intentionally carry different balance/thickness/need targets and different spec candidates. Do not infer equality from helper names. The seven historical transfers are already reflected in current selection literal assertions.
- CareBalance “context signals … without changing effective profile” currently observes facts/conflicts/provenance, not normalized profile equality. This is a narrow title/oracle observation gap, not a ready declaration deletion. No new repair is included.
- Selection104's positive metadata regex can match ordinary `product_weight:"light"` after losing the actual CareBalance reason; selection2478's can match ordinary `reset_intensity:"gentle"`. Actual bonus/ranking assertions remain meaningful, so retain these tests and consider narrowing the reason oracle separately. A reason-only owner omission that preserves score would escape the regex. **Do not generalize that finding to Oil1732 without proof:** its ordinary emitted use_mode is styling_finish, not light_finish; the same bypass is not statically established there.
- No shared mutable expected oracle was found in the152 callback/helper bodies. Fixtures use local profile objects or read shared constants; selection sorting consumes local candidate arrays. Adapter and normalized profile arrays can share input references, but the inspected damage/care/reset owners read rather than mutate them, while effective-context explicitly clones arrays. This is not a claim of a full mutation audit of every downstream engine owner.

## Source controls and guarded staging

Artifacts:

- `/tmp/test-audit-engine-union-candidates.json`: exact eight donors/keepers, declaration body hashes, same-input reasoning, full literal edit blocks and file/source hashes.
- `/tmp/test-audit-engine-union-edit.cjs`: main-only check/transfer/cut. All outputs staged in memory and parsed before any repository write; exact AST callbacks;138 untargeted declarations and every outside-target byte preserved. Whole selection file unchanged. Four current test files, six owner files and shared fixture rechecked immediately before first write. No imports become unused; no source edits.
- `/tmp/test-audit-engine-union-baseline/`: original four test files, shared fixture and six source-owner snapshots with pinned manifest.
- `/tmp/test-audit-engine-union-controls.json`:18 unique source anchors, selected exact keeper argv, intended red and source SHA. Validity is by source inspection only; no source was mutated or compiled by this agent.
- `/tmp/test-audit-engine-union-proof-template.json`: starts PENDING. The cut gate requires actual transferred native/control receipts, hashes,18 completed IDs and main's explicit inspected-red/restored attestations. It does not automatically verify log contents or constitute proof itself.
- `/tmp/test-audit-engine-union-static-preparation.json`: Python-only literal staging confirms all anchors and prospective hashes; not a passed AST/native receipt.

Control intent is deliberately directed at actual owners: adapter loses unsupported/alias/protection forwarding; normalizer drops name/frequency/explicit null; damage corrupts low overall/protective factor or severe confidence/driver; careNeeds corrupts the exact transferred perm fields while other fields can keep routing unchanged; leave-in emits each wrong target field; actual Shampoo evaluator returns no_action. Several controls leave downstream behavior unchanged so the transferred assertion must do the work. They do NOT exhaust every possible fault in every copied field; full union preservation is also checked textually and by exact callback diff. Every actual run needs green before, intended assertion red, byte-exact source restoration and green after. Type/import/fixture errors do not count.

Commands for main from the named checkout, after its exclusive window permits them:

```sh
node /tmp/test-audit-engine-union-edit.cjs check
node --import ./tests/server-only-register.cjs --import tsx --test tests/recommendation-engine-selection.test.ts tests/recommendation-engine-categories.test.ts tests/recommendation-engine-foundation.test.ts tests/recommendation-engine-care-balance.test.ts
node /tmp/test-audit-engine-union-edit.cjs transfer
```

Run the same native command for transfer proof; execute the18 controls individually with the selected argv in JSON. Once inspected proof exists:

```sh
node /tmp/test-audit-engine-union-edit.cjs cut --proof=/tmp/ACTUAL-engine-union-proof.json
```

Then run native after and main's integrated campaign gates. Do not run the template as though it were passed proof. No pipeline/provider, network, env or DB activity is needed for this set.

## History, CI and verification limits

Git source/title history inspected: foundation/perm inputs added with chemical-taxonomy cb6fb1b3 (#187); paired blow-dry target/fit traces to3c396bd3 (#57); CareBalance rows tofc8b7e20; current heat semantics6be9b148 (#545). Current bodies, not titles/history alone, establish the transfers. package.json49 and CI158 run these root Node test suites. No external normative hair-policy research was undertaken or needed: production behavior remains unchanged.

Fully read supporting source: adapter199, normalization70, damage242, care-needs99, effective-context212, runtime231, reset168, CareBalance shared146 and Leave-in category/fit owner through its complete end. Selectively read CareBalance evaluator shape/dispatch/Shampoo path, live consumer entry sections and selection wrappers/metadata owners relevant to rejected candidates/F observations; the entire2849-line selector and every other category evaluator were not reread. That limitation does not affect the eight proposed owners/keepers above, but precludes presenting this as a new comprehensive source-level R144 certification.

No repository edits, native runners, compiler/AST driver execution, mutations, browser, env, provider or DB activity were performed. All52+48+24+28 current test bodies were read, and all8 exact transfer/cut anchors were text-staged with hashes. Main retains integration, actual mutation judgment and full coverage proof.
