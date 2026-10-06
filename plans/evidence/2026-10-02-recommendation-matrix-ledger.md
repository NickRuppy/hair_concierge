# Shared recommendation and Quiz decision-matrix audit

Read-only audit. No repository file, provider, or test execution was changed or run.

## Scope and inventory

This is a bounded 307-declaration layer, not a whole-tree finding.

- 204 direct recommendation-engine declarations: care-balance comparison (8), care-balance (28), categories (54), chat (2), foundation (24), planner (8), routine bridge (2), selection (53), shampoo cadence (25).
- 103 direct Quiz decision/projection declarations: guided-story products (9), offer preview (9), normalization (23), primary concern (22), guided-story priorities (18), funnel package context (13), preparation (9).
- Excluded: prior routine-planner 88-declaration ledger, Agent/Compare, Discovery, Scanner, Stage3, and previously applied wrapper/dead-Quiz batches. The direct engine set is the largest remaining coherent matrix below 300; the Quiz projection owners are its live inputs/consumers and bring the audit to a bounded 307.

## Owner and live-path evidence

The engine deterministic owner chain is adapter/normalize -> assessments -> planner/categories/care-balance/shampoo cadence -> runtime/selection. It is used by routines (src/lib/routines/planner.ts:1280 and load-routine-artifact-data.ts:193), AgentV2 production (src/lib/agent-v2/production/chat-pipeline.ts:574), and agent tools (src/lib/agent/tools/build-or-fix-routine.ts:433). The selection cases call real rerankers with independent candidate/spec fixtures; they do not mock the engine.

Quiz normalization is read by drafts, lead lifecycle, scanner context, profile linking and reactivation (src/lib/quiz/draft.ts:59, lead-lifecycle.ts:18, src/lib/scan/scanner-context.ts:218, src/lib/quiz/link-to-profile.ts:124, src/lib/reactivation/profile-quiz-answers.ts:132). Primary concern feeds need lane, narrative, profile projection and preview. Guided-story priorities/products feed src/lib/personal-plan-quiz/prepared-plan.ts:292-295 and Customer.io artifact generation. Offer preview is used by reactivation and profile-reactivation lab. Funnel-package context carries a signed-cookie/server-render/bootstrap boundary, not an engine fixture replay.

package.json routes the Node test surface through test:node; the routine-planner Playwright contract is separately registered in test:playwright:contracts. Recent history ties the matrix to shampoo cadence, chemical-treatment taxonomy, hair-loss boundary, guided offer journey, and batch-7 primary-concern behavior, rather than a private implementation seam.

## Ledger

Marks: R retain; F repair; C consolidate; D delete. All 307 declarations are R. The named output in each title is an independent deterministic, persistence/schema, public-copy, signed-context, or recovery contract. A credible regression is a changed mapping, precedence rule, product/filter decision, or lifecycle transition in the named owner. No stronger keeper renders a row redundant, and no source/test-only seam is unlocked.

| Test declaration | Mark | Evidence |
|---|---|---|
| tests/recommendation-engine-care-balance-comparison.test.ts:39 — runtime keeps legacy planner authoritative while CareBalance also detects missing conditioner | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:54 — runtime preserves matched and pending routine product identity in effective context | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:97 — runtime side-by-side detects high-priority missing bondbuilder in legacy and CareBalance | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:105 — runtime side-by-side preserves deferred legacy bondbuilder placement | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:138 — runtime side-by-side detects dry shampoo overuse in legacy and CareBalance | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:156 — runtime side-by-side detects peeling overuse when scalp is irritated | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:172 — CareBalance projection surfaces weekly deep-cleansing vulnerability even when legacy plan lacks it | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance-comparison.test.ts:211 — blow-dryer-only heat protectant stays non-authoritative when CareBalance says no action | R | runtime comparison preserves legacy-versus-CareBalance compatibility and one-sided authority. |
| tests/recommendation-engine-care-balance.test.ts:102 — current-turn routine frequency overrides saved routine frequency and records conflict | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:143 — current-turn routine presence can clear or create a routine item | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:185 — current-turn profile augment de-dupes canonical array values | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:216 — current-turn profile override replaces a scalar normalized field | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:247 — current-turn brush type override replaces saved brush tools for this turn | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:278 — current-turn brush type override can clear saved brush tools for this turn | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:309 — context signals are retained without changing the effective profile | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:328 — buildCareBalanceSet returns one stable row per strong category | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:361 — buildCareBalanceSet recommends adding missing conditioner for dry tangled lengths | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:370 — buildCareBalanceSet recommends increasing rare conditioner against 3-4x wash cadence | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:379 — buildCareBalanceSet recommends decreasing daily oil under buildup and flatness pressure | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:391 — buildCareBalanceSet recommends adding absent leave-in for frizz and tangling | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:399 — buildCareBalanceSet recommends decreasing frequent mask under buildup pressure | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:409 — buildCareBalanceSet recommends adding absent heat protectant for flat iron | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:419 — buildCareBalanceSet keeps absent heat protectant as no action for blow dryer only | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:430 — buildCareBalanceSet recommends increasing rare heat protectant for cumulative moderate heat tools | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:443 — buildCareBalanceSet recommends adding absent bondbuilder for high bond priority | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:454 — buildCareBalanceSet recommends decreasing deep-cleansing shampoo at 3-4x use | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:462 — buildCareBalanceSet recommends decreasing weekly deep-cleansing shampoo with vulnerability | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:474 — buildCareBalanceSet recommends decreasing daily dry shampoo under reset pressure | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:484 — buildCareBalanceSet recommends decreasing peeling when scalp is irritated | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:495 — buildCareBalanceSet recommends adding absent shampoo | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:501 — recommendation runtime exposes oily weekly shampoo cadence as below high target | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:539 — compareFrequencyBands orders known bands and returns null when either side is unknown | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:547 — hasDeepCleansingVulnerability reports vulnerable drivers for dry, damaged, textured, or rough profiles | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:576 — hasDeepCleansingVulnerability treats each vulnerability driver as independently sufficient | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:643 — hasDeepCleansingVulnerability is false for quiet balanced profiles | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-care-balance.test.ts:656 — classifyHeatExposure distinguishes airflow, moderate, cumulative, direct, and none tiers | R | real effective-context and CareBalance evaluator action/precedence contract. |
| tests/recommendation-engine-categories.test.ts:75 — category set turns severe shared signals into conditioner, mask, and leave-in targets | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:130 — mask target weight is light for fine hair even with medium density | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:156 — explicit low-need mask requests stay relevant as optional Zusatzpflege | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:178 — explicit low-need leave-in requests build a request-scoped target | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:200 — straight natural texture with perm and definition goal routes leave-in to curl definition | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:216 — chemical straightening does not unlock curl-definition leave-in routing | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:230 — perm maintenance can route leave-in to gentle support without curl definition | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:248 — explicit leave-in heat requests build a high heat target even when routine plan is quiet | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:275 — explicit leave-in heat-protection wording builds a heat target without styling-tool signals | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:303 — separate heat protectant wording keeps blow-dry leave-in heat protection as a bonus | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:332 — explicit fine weighed-down leave-in requests target light booster products | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:363 — non-explicit medium mask need stays relevant as fixed Zusatzpflege | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:386 — explicit mask requests keep real mask need fixed | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:406 — explicit intensive low-need mask requests uplift concentration target one step | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:428 — conditioner stays baseline core care for low-need profiles with existing conditioner | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:453 — conditioner fit stays unknown until balance_direction is backfilled | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:474 — conditioner fit evaluates real dimensions when legacy thickness data is empty | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:490 — conditioner fit treats thickness exclusion as a mismatch | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:505 — conditioner fit keeps balanced product supportive for directional need | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:520 — mask fit uses concentration as a temporary repair proxy but still needs balance backfill | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:549 — mask fit keeps high concentration for medium need as a caveated support path | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:567 — mask fit rejects high concentration for low optional need | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:586 — mask fit hard-gates opposite balance but allows balanced bridge products | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:610 — mask fit treats rich-on-fine as riskier than light-on-coarse | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:643 — leave-in fit derives canonical targets from the current leave-in schema | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:659 — leave-in fit calls a heat-activated product a mismatch for a no-heat profile instead of blaming data | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:690 — leave-in fit mismatches when heat styling support is missing | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:707 — leave-in target splits blow-dry heat protection from high-heat styling prep | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:727 — leave-in target treats thermal rollers as moderate heat exposure | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:747 — leave-in fit treats missing moderate blow-dry heat protection as a caveated support path | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:775 — leave-in fit hard-gates thickness and opposite protein-moisture direction | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:812 — shampoo decision keeps treatment and rotation buckets explicit for dandruff routines | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:831 — oil decision resolves normalized request purpose before category logic runs | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:855 — oil decision does not treat lightweight finish wording as overload | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:869 — oil decision treats non-greasy fine-hair wording as light finish | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:884 — oil decision asks for clarification when no explicit purpose is available | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:908 — reset assessment promotes explicit coated hard-water reset request to strong broad-spectrum | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:938 — explicit deep-cleansing request builds reset target without relying on baseline planner step | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:964 — deep-cleansing request with scalp treatment intent stays guidance-only | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:993 — oil decision redirects scalp treatment oil requests without product target | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1015 — oil decision redirects growth and loss oil requests even without explicit oiling purpose | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1036 — oil decision keeps therapy oil requests guidance-only until therapy oils are catalogued | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1052 — oil decision redirects when the stated need is better served by a non-oil category | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1068 — oil decision preserves explicit product intent while marking overload risk | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1099 — oil decision does not suppress unrelated substring collisions | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1118 — category set activates support/reset categories for oily buildup-heavy routines | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1173 — dry shampoo allows explicit bridge requests despite stored breakage or ordinary dry lengths | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1201 — dry shampoo blocks current-message breakage-dominant requests | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1222 — bondbuilder fit uses intensity and does not rank by treatment mode | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1258 — explicit low-need bondbuilder request stays optional instead of disappearing | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1280 — permed hair alone does not hard-route to bondbuilder | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1297 — chemical straightening with roughness supports bondbuilder consideration | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1310 — peeling fit rejects physical scrub when the target route is dryness-safe | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-categories.test.ts:1342 — category set keeps only baseline conditioner active when shared layers are quiet | R | direct category owner target/fit and safety-routing contract. |
| tests/recommendation-engine-chat.test.ts:43 — nullable scalp condition is treated as complete when scalp type is present | R | chat profile-completeness question contract. |
| tests/recommendation-engine-chat.test.ts:53 — shampoo completeness still asks both scalp answers when neither route is known | R | chat profile-completeness question contract. |
| tests/recommendation-engine-foundation.test.ts:15 — persistence adapter maps supported routine categories and reports unsupported ones | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:35 — persistence adapter merges duplicate category identity as one coherent state | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:63 — normalization produces a full inventory map keyed by V1 inventory categories | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:79 — normalization treats unselected shampoo fallback as cadence but not present inventory | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:93 — normalization keeps explicit derived shampoo cadence when fallback row is hidden from inventory | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:108 — adapter preserves routine-derived shampoo cadence when profile row is missing | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:123 — adapter preserves explicit derived shampoo cadence when profile row is missing | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:133 — normalization does not infer wash cadence from raw deprecated profile field | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:146 — normalization keeps real unnamed less-than-monthly shampoo present | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:160 — low-damage fixture yields low repair need with protective factors | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:178 — length tip accessory counts as present night protection | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:193 — explicit empty night protection is treated as lack of protection | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:208 — legacy tight hairstyles night protection normalizes to explicit lack of protection | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:225 — unknown night protection is not treated like explicit lack of protection | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:240 — low-damage fixture keeps care needs conservative | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:254 — straight natural texture plus perm supports explicit curl definition goal only | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:289 — perm alone creates mild maintenance needs without curl definition | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:310 — severe-damage fixture yields severe structural load and bond builder recommendation | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:331 — chemical treatments contribute capped structural damage with accumulating drivers | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:348 — chemical straightening alone is elevated stress without forcing bondbuilder recommendation | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:365 — bleach caps chemical structural stress at the strongest tier | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:382 — severe-damage fixture drives high care needs and heat protection urgency | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:399 — structural concern cluster caps additive damage and makes breakage the strongest signal | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-foundation.test.ts:439 — tangling raises detangling need without inflating structural damage | R | persistence adapter/normalization/assessment compatibility contract. |
| tests/recommendation-engine-planner.test.ts:15 — planner adds baseline shampoo and conditioner when missing | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:40 — planner emits behavior-first and missing-protection actions for severe heat misuse | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:73 — planner emits night protection behavior gap for explicit no protection | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:97 — planner defers bondbuilder when structural case is consider-level rather than recommend-level | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:126 — planner activates reset-family categories for oily buildup-prone routines | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:175 — planner adds dry shampoo only for explicit between-wash bridge requests | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:204 — planner de-escalates support categories when dryness and overuse risk are high | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-planner.test.ts:274 — planner can increase bondbuilder usage when the structural case is recommend-level and usage is sparse | R | intervention planner action/reason-code contract. |
| tests/recommendation-engine-routine.test.ts:14 — routine planner now reflects shared engine decisions for core care slots | R | engine-to-routine integration contract. |
| tests/recommendation-engine-routine.test.ts:36 — routine planner keeps purpose-driven oil requests inside the routine flow | R | engine-to-routine integration contract. |
| tests/recommendation-engine-selection.test.ts:104 — engine conditioner reranking prefers explicit target fit over higher semantic score | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:141 — engine conditioner reranking softly prefers lighter fits under CareBalance flat-load pressure | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:190 — engine conditioner reranking does not use CareBalance label without load-pressure row | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:241 — engine conditioner reranking excludes mismatches when three non-mismatches exist | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:300 — engine conditioner reranking marks fallback mismatches when coverage is insufficient | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:338 — engine conditioner reranking requires specs for owned non-recommended assessment candidates | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:373 — engine conditioner reranking preserves explicit assessment target inside the limit | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:405 — candidates with empty legacy thickness arrays get structured thicknesses backfilled | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:434 — engine conditioner reranking preserves mismatch assessment target when enough acceptable products exist | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:477 — engine mask reranking rewards complete fit metadata over unknown balance | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:513 — engine mask reranking prefers medium concentration for medium mask need | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:554 — engine mask reranking prioritizes light weight for light mask targets | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:593 — engine mask reranking uplifts explicit low-need intensive requests to medium concentration | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:635 — engine mask reranking hides missing specs when three known mask fits exist | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:670 — engine leave-in reranking strongly prefers heat-safe fit for heat styling profiles | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:715 — engine leave-in reranking under CareBalance heat pressure ranks by base score/fit only (AD-6: no degree preference) | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:781 — engine leave-in reranking excludes hard mismatches when three viable fits exist | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:856 — engine leave-in reranking does not use hard-gated mismatches as fallback fill | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:924 — engine leave-in reranking uses balance mismatches only as caveated fallback fill | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:999 — engine leave-in reranking honors explicit spray and cream comparison requests | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1080 — engine leave-in reranking prefers integrated heat bonus when separate heat protectant exists | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1180 — engine leave-in metadata exposes product conditioner relationship, not target relationship | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1219 — engine shampoo reranking keeps the primary treatment bucket ahead of the rotation bucket | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1259 — engine shampoo reranking uses backfilled cleansing intensity inside the same bucket | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1305 — engine shampoo reranking treats exact normal bucket with gentle intensity as a fit | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1344 — engine shampoo reranking preserves included assessment target products inside the limit | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1387 — engine shampoo reranking does not force routine-owned products without assessment targeting | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1428 — engine shampoo reranking excludes mismatches when enough acceptable fits exist | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1485 — engine shampoo reranking marks fallback mismatches when acceptable coverage is insufficient | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1533 — engine shampoo reranking requires specs for owned non-recommended assessment candidates | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1588 — engine oil reranking follows normalized request purpose and annotates the legacy matcher bridge | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1624 — engine oil reranking requires eligibility rows for owned non-recommended assessment candidates | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1666 — engine oil reranking prefers exact oil-purpose matches over subtype-only bridge candidates | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1704 — engine oil reranking softly prefers light non-heavy oil when CareBalance flags daily oil load | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1755 — engine keeps explicit overload-risk oil requests product-addressable with caveat context | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1782 — engine oil reranking hides finish bridge candidates when exact purpose coverage is enough | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1837 — engine oil reranking allows only adjacent finish bridge below exact threshold | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1895 — engine oil reranking preserves classic subtype eligibility when oil purpose is not populated | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1939 — engine oil reranking keeps exact purpose matches ahead of legacy subtype fallback | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:1979 — engine bondbuilder reranking exposes protocol metadata without ranking by treatment mode | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2039 — engine bondbuilder reranking excludes retired and add-on products from primary cards | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2102 — engine bondbuilder reranking keeps explicitly included owned products assessable | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2156 — engine bondbuilder reranking attaches optional add-ons for severe combo cases | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2264 — engine bondbuilder reranking scopes named K18 and OLAPLEX comparisons | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2344 — engine deep-cleansing shampoo reranking prefers the exact scalp focus over a balanced fallback | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2398 — engine deep-cleansing shampoo reranking prefers broad-spectrum reset for mineral requests | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2450 — engine deep-cleansing shampoo reranking softly prefers gentle reset under CareBalance vulnerability | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2521 — engine deep-cleansing shampoo reranking suppresses unsupported mineral matches | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2557 — engine dry shampoo reranking prefers exact bridge effect and color fit | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2612 — engine dry shampoo reranking filters aerosol when non-spray format is requested | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2660 — engine dry shampoo reranking understands current live dry-shampoo spec fields | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2718 — engine peeling reranking requires both scalp-focus and peeling-type alignment | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-selection.test.ts:2764 — engine selectors keep baseline conditioner active when shared engine is otherwise quiet | R | real selection reranker eligibility, fallback, and metadata contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:95 — oily scalp with weekly_1x shampoo is below the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:105 — oily scalp with weekly_2x shampoo is near the lower edge of the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:115 — oily scalp with weekly_3_4x shampoo is near the preferred high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:125 — oily scalp with weekly_5_6x shampoo is near the upper edge of the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:135 — oily scalp with daily shampoo is above the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:145 — balanced scalp maps to the medium target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:154 — irritated scalp takes precedence over oily scalp type and exposes oily caveat | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:165 — dandruff maps to the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:172 — dry flakes map to the low target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:181 — balanced scalp with oily scalp concern moves up to the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:191 — healthy scalp goal can move balanced scalp up one band | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:201 — multiple upward modifiers are capped to one band | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:223 — oily scalp with stacked fiber fragility moves down to the medium target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:233 — oily scalp with up and down modifiers keeps the high base target and exposes both signals | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:253 — known scalp target with no shampoo frequency falls back to rare shampoo cadence | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:262 — less_than_monthly shampoo cadence is treated as current frequency and falls below oily target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:278 — hidden unselected shampoo fallback is hidden from inventory but still drives cadence delta | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:304 — visible shampoo with unknown frequency uses the same fallback as an empty shampoo row | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:320 — cadence-relevant likely reset assessment moves a balanced scalp up to the high target | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:331 — strong reset assessment uses the same upward modifier as likely reset when cadence relevant | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:342 — mineral-only reset assessment does not move shampoo cadence upward | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:353 — weekly dry shampoo alone does not move shampoo cadence upward | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:369 — twice-weekly dry shampoo moves shampoo cadence upward one band | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:385 — dry-flake scalp condition outranks broad dandruff concern | R | canonical cadence policy and boundary-band contract. |
| tests/recommendation-engine-shampoo-cadence.test.ts:395 — dandruff concern without a specific scalp condition maps to the high target | R | canonical cadence policy and boundary-band contract. |
| tests/quiz-guided-story-products.test.ts:38 — derives every shampoo route and thickness, including the neutral coarse-oily fallback | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:62 — preserves direct conditioner balance from the pull test | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:78 — does not add a mask from the pull test alone or unrelated priorities | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:86 — bond care wins for Tier-1 damage plus chemical treatment | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:116 — matching priorities unlock protein and moisture masks | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:138 — rough surface unlocks a complementary leave-in and texture chooses its variant | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:171 — oil requires an ends priority; shine alone does not create it | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:186 — returns two cards when no truthful extra exists and three when one does | R | prepared-plan product-card derivation contract. |
| tests/quiz-guided-story-products.test.ts:196 — incomplete profiles keep fallback priorities out of the targeted-product decision | R | prepared-plan product-card derivation contract. |
| tests/quiz-offer-preview.test.ts:14 — the curated registry is coverage-driven and every record has a product identity and image | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:24 — all scalp-route and thickness profiles select a deterministic shampoo example | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:67 — fine oily profiles use a regular shampoo example without deep-cleansing naming | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:89 — all thickness and balance profiles select a conditioner without crossing those hard axes | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:119 — conditioner signal exposes thickness and balance direction without claiming a density-matched weight | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:137 — a surface-led result shows two foundation examples and one leave-in suggestion | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:170 — a neutral or colored-only result stays at shampoo and conditioner | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:193 — curl definition chooses the curl leave-in example without claiming a universal pattern fit | R | public quiz result preview and rendering contract. |
| tests/quiz-offer-preview.test.ts:210 — cadence uses the canonical base scalp target and labels it as a starting point | R | public quiz result preview and rendering contract. |
| tests/quiz-normalization.test.ts:13 — natur stays exclusive in treatment selection | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:19 — colored and bleached can be combined | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:26 — chemical shape treatments combine with color treatments in canonical order | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:35 — chemical shape treatments remain exclusive with natur | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:44 — legacy pulltest values are normalized | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:59 — density values are normalized and invalid values are removed | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:66 — hair length values are normalized and invalid values are removed | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:71 — legacy scalp values still map to type and condition | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:86 — legacy no-issue scalp answers normalize to a negative scalp gate | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:102 — stored answers without the new concern or scalp gate fields backfill clean defaults | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:116 — free-text concern notes are trimmed and empty strings are removed | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:125 — blank free-text concern notes normalize to undefined | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:134 — legacy free-text concern notes are clamped to the current 50-character limit | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:142 — shared hair-loss concern is added once after hair damage with reviewed copy | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:158 — canonicalization drops invalid natur conflicts | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:185 — goals are passed through when valid (sorted to canonical GOALS order) | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:195 — two goal lists with the same items in different order normalize equal | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:201 — invalid goal values are filtered out | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:210 — new quiz goals preserve every unique shared selection | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:236 — goals drop the conflicting volume/less_volume pair (keeps first occurrence) | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:245 — missing or empty goals normalize to undefined | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:251 — canonicalization carries goals through in canonical GOALS order | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-normalization.test.ts:267 — shared quiz values project once into the existing profile vocabulary | R | stored-answer canonicalization and legacy-vocabulary compatibility contract. |
| tests/quiz-primary-concern.test.ts:102 — resolveStatedPrimaryConcern: ${row.name} | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:107 — a pick is asked for only with two or more concerns | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:113 — reconcilePrimaryConcern keeps a contained pick and drops a stale one | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:119 — toLegacyQuizConcern maps aliases and leaves the four non-legacy codes out | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:138 — need lane: the stated pick decides, not a weight ranking | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:150 — need lane: several concerns without a pick run with no primary concern | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:156 — need lane: aliases map into the legacy vocabulary | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:178 — need lane: stated ${nonLegacy} falls back to no primary concern | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:190 — need lane: the explicit stated concern wins over a collapsed legacy projection | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:201 — narrative: the stated pick drives the intro and the friction row | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:213 — narrative: legacy multi-concern answers without a pick get neutral copy | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:225 — narrative: legacy multi-concern answers without a pick and without goals stay neutral | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:245 — narrative: stated ${concern} has its own copy and does not crash | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:262 — narrative: hair loss keeps the medical boundary and promises no product result | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:276 — offer preview lane follows the stated pick from the raw answers | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:297 — lead schema accepts the new key and still accepts answers without it | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:311 — lead schema never rejects a stale pick; canonicalisation drops it | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:321 — lead schema rejects a pick outside the concern vocabulary | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:327 — canonicalisation keeps a contained pick | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:336 — stored re-read: old answers without the key and new answers with it both parse | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:353 — stored re-read drops a stale pick instead of failing | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-primary-concern.test.ts:365 — profile projection writes the legacy vocabulary like concerns | R | stated-concern precedence, schema, narrative, and medical-boundary contract. |
| tests/quiz-guided-story-priorities.test.ts:40 — exports the nine locked priority families | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:57 — runtime copy includes active family variants plus the approved positive fallback only | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:92 — legacy fallback copy stays separate from the approved matrix records | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:123 — selects every active approved variant on its supported path | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:277 — tier precedence keeps active breakage ahead of a lower-tier matched goal | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:291 — matching goals win within the same tier before fixed family order | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:305 — concern coverage wins before fixed tie order | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:319 — fixed family order is the last deterministic tie-break | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:332 — supporting priorities keep remaining stated concerns ahead of goal-only findings | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:348 — balanced no-concern profile uses selected goals and an honest positive fallback | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:368 — shine never suppresses or rewrites a co-selected less-frizz goal | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:385 — sparse no-concern profiles do not repeat positive scalp foundations | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:399 — healthy scalp goal can centralize a dry or oily scalp state without an active condition | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:412 — scalp condition is read from the separate condition fields, not stale free-form scalp values | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:426 — fully incomplete legacy answers return exactly three approved fallback priorities | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:446 — free-text concerns are not classified into medical or cosmetic routes | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:455 — healthier_hair modifies a supported specific family but never becomes its own family | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-guided-story-priorities.test.ts:469 — a true four-family profile merges close neighbors so every concern stays visible | R | approved-copy priority ordering and fallback contract. |
| tests/quiz-funnel-package-context.test.tsx:54 — an organic quiz store carries no funnel package | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:61 — the server-resolved package key is authoritative in both directions | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:72 — the browser bootstrap may only fill a package key the cookie did not deliver | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:86 — restoring a browser draft keeps the funnel package of the running session | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:101 — a moderator fresh start clears quiz progress but keeps the funnel package | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:117 — the provider never mutates the shared store during a server render | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:130 — the provider applies the package key before the first child renders | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:151 — the quiz reads the package key out of the signed funnel cookie | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:165 — both quiz layouts initialize the store from the signed cookie | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:178 — a scan draft resumes on the insert it was saved on | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:197 — the same draft resumes organically on the question the insert sits behind | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:226 — a server-rendered package reaches the consumer copy without any bootstrap | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-funnel-package-context.test.tsx:239 — the bootstrap fallback publishes the effective package to the context too | R | signed package/context hydration and resume isolation contract. |
| tests/quiz-preparation.test.ts:25 — preparation prefetches the result route only from the commitment handler | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:40 — preparation waits for a lead and the client auth session | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:63 — anonymous and already-entitled sessions are ready without an extra access request | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:86 — signed-in sessions without profile access wait for the matching server check | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:101 — a stalled access check settles after a bounded timeout | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:125 — access-check cleanup aborts work without marking it settled | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:147 — result artifact delivery starts once after preparation settles | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:174 — missing-lead recovery returns to the earliest incomplete lead field | R | quiz preparation/recovery lifecycle contract. |
| tests/quiz-preparation.test.ts:179 — preparation threads retake mode and return destination into the canonical result | R | quiz preparation/recovery lifecycle contract. |

## Findings and cutover

- R 307, F 0, C 0, D 0.
- No deletion-ready duplicate was found. The copied-looking fixture matrices are inputs to different direct owners: category decisions, product selection, cadence, CareBalance, Quiz priority, and product projection. They encode different observable policy axes and mutations in any one owner are not reliably caught by another.
- The direct engine tests are not provider-local repeats of a shared runtime: their factory setup constructs inputs/candidates/specs and calls the owner being protected. The Quiz tests independently protect stored/persisted compatibility, user-facing copy/rendering, and signed funnel-context lifecycle.
- No non-test caller is orphaned, no test-only production support is unlocked, and no assertion transfer is appropriate.
- Risks of pruning: category/selection rows would lose the only deterministic proof for a specific fit/safety/fallback axis; Quiz rows would lose legacy answer, medical wording, cookie hydration, or recovery proof.

## Focused validation if a later source change warrants it

node --import ./tests/server-only-register.cjs --import tsx --test tests/recommendation-engine-*.test.ts tests/quiz-guided-story-products.test.ts tests/quiz-offer-preview.test.ts tests/quiz-normalization.test.ts tests/quiz-primary-concern.test.ts tests/quiz-guided-story-priorities.test.ts tests/quiz-funnel-package-context.test.tsx tests/quiz-preparation.test.ts

This command is evidence-only guidance and was not run in this audit.
