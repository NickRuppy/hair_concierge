# AgentV2 final-answer validator read-only audit ledger

Scope: `tests/agent-v2-final-answer-validator.spec.ts`; production owner `src/lib/agent-v2/validation/final-answer-validator.ts`, invoked by `runAgentV2ResponsesTurn` before accepted terminal output (`src/lib/agent-v2/runtime/responses-agent.ts:646`) and after repair (`:1432`). `R` retains a direct boundary contract; `C` reduces declaration duplication but retains each distinct row; `D` is deletion-ready.

| line | case | mark | evidence / keeper |
|---:|---|:---:|---|
| 493 | validator accepts known product ids | D | Fixture-only happy-path probe; later direct validator cases already require the same base product IDs to pass their intended paths. Keeper: all explicit product render/known-ID cases, especially L4582/L5716. No production seam unlocked. |
| 499 | validator diet softens hidden product interpretation metadata when answer is otherwise safe | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 560 | validator diet keeps low-confidence routine changes blocking | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 589 | validator accepts grounded text-only product assessment without visible recommendations | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 653 | validator accepts found-exact lookup grounding for product assessment with matching product facts | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 743 | validator blocks product assessment from found-exact identity without product facts | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 809 | validator blocks product assessment from identity-only projection without product facts | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 894 | validator accepts routine usage assessment from trusted routine product context without product facts | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 964 | validator still requires product guidance for non-routine routine usage assessments | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 1042 | validator blocks product assessment that omits the resolved product name | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 1112 | validator blocks mixed product assessment prose for an unresolved second product | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 1204 | validator blocks product assessment for unresolved lookup contexts | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 1271 | validator blocks pronoun product advice while active product review is pending | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 1328 | validator rejects recommendation-card payload fields for product assessment | R | product-assessment/product-ID grounding; regression is accepting unsupported product truth or rejecting grounded assessment |
| 1355 | AgentV2 validator fills clear product offer without pending follow-up action | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1392 | validator does not require lookup from deterministic named-product context alone | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1417 | validator requires lookup when deterministic context identifies an evaluation even if model misses product candidate | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1458 | validator requires lookup when visible answer claims about deterministic own-product context | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1485 | validator requires lookup from model-owned product candidate metadata without named-product context | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1513 | validator does not require duplicate lookup when model-owned product candidate already called lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1566 | validator matches lookup to mentioned product identity even when answer target category differs | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1620 | validator does not treat a different product lookup as satisfying model-owned candidate lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1670 | validator does not use lookup evidence quote alone as candidate identity | C | Identity mismatch is a distinct row but duplicates the same `product_lookup_required` owner outcome as L1620. Move its copied-evidence variant into an identity-mismatch table under L1620; preserve row. |
| 1722 | validator does not use generic product name fragment alone when lookup brand differs | C | Generic-name mismatch is another input row for L1620’s wrong-lookup contract. Consolidate into its table; preserve row. |
| 1774 | validator does not use product-name-only evidence when lookup brand differs | C | Overlapping-name/brand mismatch is another L1620 identity-mismatch row. Consolidate into its table; preserve row. |
| 1828 | validator requires lookup when constraint-blocked answer makes named-product claim | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1873 | validator does not use stale recent evidence text to satisfy a different product lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1925 | validator requires lookup before clarification for exact own-product suitability turns | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1971 | validator does not require lookup for background current-use product mentions | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 1999 | validator does not require lookup for background product clarification answers | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2046 | validator does not require unavailable product lookup when intake is disabled | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2086 | validator does not require lookup for broad product recommendations without a concrete product | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2104 | validator blocks product recommendations after ${status} product lookup | R | Dynamic declaration: six unresolved-status rows (listed below) exercise the status-to-product-specific-answer block at the actual validator boundary. |
| 2121 | validator allows product recommendations after exact product lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2137 | validator blocks unverified-product caveat for trusted selected product | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2183 | validator allows identity-only acknowledgement for trusted selected product without product tool | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2230 | validator requires product tool for trusted selected product suitability claims | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2275 | validator allows claim-level hedge for trusted selected product | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2321 | validator allows claims for exact lookup products when another lookup is unresolved | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2345 | validator does not let an unresolved mentioned-product lookup block unrelated grounded recommendations | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2439 | validator does not let unresolved baseline lookup block grounded alternatives | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2559 | validator does not require duplicate lookup for grounded alternatives to active product | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2648 | validator diet softens unknown hard rule metadata on grounded product alternatives | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2735 | validator blocks named product detail prose after unresolved product lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2783 | validator blocks exact named-product property claims after unresolved lookup despite general-advice classification | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2815 | validator blocks pronoun product suitability claims after unresolved lookup | C | Pronoun suitability is a lexical row of the unresolved-claim predicate already owner-tested by L2735/L2847. Move as a table row with L2847; preserve this regression. |
| 2847 | validator blocks pronoun product claims after unresolved lookup with structured input identity | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2897 | validator blocks category-term product property claims after unresolved lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 2929 | validator blocks named-product use claims after unresolved lookup | C | Named-product use verb is a lexical row of `hasNamedProductClaimPredicate`, already keeper-tested by L2783. Move as a table row; preserve verb coverage. |
| 2961 | validator blocks product-phrase use claims after unresolved lookup | C | Product-phrase use is a lexical row of the unresolved-name/reference predicate, overlapping L2929/L3025. Consolidate as a row; preserve category-reference coverage. |
| 2993 | validator blocks pronoun keep claims after unresolved lookup | C | Pronoun keep verb is another `hasPronounProductClaim` row; consolidate with L2815/L2847 while retaining the keep-verb row. |
| 3025 | validator blocks category-term routine keep claims after unresolved lookup | C | Category-term keep is another unresolved reference/claim combination; table with L2897/L2961, retaining the category-term row. |
| 3057 | validator allows generic category context after unresolved lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3088 | validator blocks personalized category suitability after unresolved intake-card lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3120 | validator allows cautious product deferrals after unresolved lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3164 | validator covers unresolved category-term use claims for ${testCase.category} | R | Dynamic declaration: nine category rows (listed below) protect the category reference-term expansion and unresolved-product block. |
| 3197 | validator allows constraint-blocked deferral after unresolved product lookup | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3246 | AgentV2 validator blocks visible prose offers without structured pending follow-up action | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3291 | AgentV2 validator checks visible prose offers even when next_step_offer_de is non-confirmable | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3330 | validator blocks social answers that claim a specific product candidate | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3365 | AgentV2 validator does not treat plain Ich-kann answer openers as follow-up offers | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3398 | AgentV2 validator blocks visible prose offers with first-person action verbs | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3436 | AgentV2 validator does not treat direct recommendations as follow-up offers | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3473 | AgentV2 validator allows informational next step without pending follow-up action | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3506 | AgentV2 validator strips hidden pending action behind informational next step | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3546 | AgentV2 validator strips hidden pending follow-up actions without visible offer | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3591 | AgentV2 validator keeps hidden pending action blocking when mixed with product truth failures | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3631 | AgentV2 validator blocks next-step offers that are not rendered in the visible answer | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3661 | AgentV2 validator blocks visible product offers stored as advisor follow-up actions | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3707 | AgentV2 validator accepts visible product offers with matching pending product action | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3754 | AgentV2 validator blocks visible routine mutation offers stored as advisor follow-up actions | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3796 | AgentV2 validator accepts product-worded routine mutation offers | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3843 | AgentV2 validator normalizes advice-style routine offers stored as routine mutations | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3901 | AgentV2 validator blocks routine mutation category drift from visible offers | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 3946 | AgentV2 validator does not count mirrored next-step offer as a second visible question | R | lookup and pending-follow-up protocol; regression is bypassing lookup/visible-action state or corrupting repair |
| 4022 | AgentV2 validator schema blocks routine action fields on product follow-up actions | R | Sole retained final-validator embedding proof: `AgentV2TerminalAnswerSchema` embeds `AgentV2PendingFollowupActionSchema` at contracts.ts:384. If that field becomes `z.any()`, this otherwise visible, correctly-kind/category matched product offer passes `validatePendingFollowupAction` and this test turns green; direct schema tests would not catch the disconnected terminal boundary. |
| 4055 | AgentV2 validator schema blocks routine action fields on advisor follow-up actions | D | Only replays the pending-action schema through the validator; canonical invalid-combination proof is tests/agent-v2-pending-followup-action.spec.ts “AgentV2PendingFollowupActionSchema rejects invalid field combinations”. No final-validator-specific behavior. |
| 4099 | AgentV2 validator schema blocks routine mutation follow-up without routine action | D | Only replays routine-mutation schema invalidity through the validator; canonical invalid-combination proof is tests/agent-v2-pending-followup-action.spec.ts “AgentV2PendingFollowupActionSchema rejects invalid field combinations”. No final-validator-specific behavior. |
| 4132 | validator accepts social and domain-boundary answers when gate-consistent | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4182 | validator blocks social and domain-boundary answers without an authorized gate | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4208 | validator blocks social and domain-boundary side effects | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4273 | validator blocks domain-boundary code and gate mismatch | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4318 | validator requires mode-specific and category guidance for category product answers | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4360 | validator requires product guidance for product-detail clarifications | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4415 | validator blocks repeated exact-name clarification for already named off-catalog products | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4470 | validator blocks substitute catalog recommendations for already named off-catalog product detail turns | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4537 | validator requires category guidance for category education answers | R | turn-gate/guidance boundary; regression is a bypass or missing required package |
| 4582 | validator blocks hallucinated product ids | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4593 | validator blocks payload product ids that bypass tool grounding | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4625 | validator blocks memory leakage in user prose | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4641 | validator blocks raw internal routine labels in user-facing copy | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4661 | validator blocks raw internal labels in visible payload recommendation fields | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4689 | validator catches raw internal labels in visible payload routine step reasons | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4706 | validator blocks internal product-ranking language in user-facing copy | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4725 | validator blocks internal instruction phrasing in user-facing copy | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4742 | validator warns on catalog metadata phrasing in visible payload routine step actions | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4763 | validator ignores hidden non-user-facing fields when checking visible payload language | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4792 | validator blocks bare Ja opening for non-confirmation user message | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4812 | validator allows Ja opening after explicit confirmation | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4832 | validator warns on catalog classification phrasing without failing validation | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| L4852 | validator warns on representative ASCII German orthography tokens without failing validation | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4917 | validator does not warn on ordinary ue letter pairs or standard German orthography | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4966 | validator allows cosmetic treatment wording for frizz | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4982 | validator allows public styling tool wording | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 4998 | validator blocks raw product property dump bullets | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 5019 | validator accepts natural product fit sentences | R | visible-language/ID boundary; regression is leaking internal text or false-positive user copy |
| 5035 | validator requires product answers to surface available recommendation options | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5077 | validator blocks empty product recommendations when selected products are available | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5116 | validator requires semantic select_products tool arguments for concrete product interpretations | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5128 | validator treats product selection as supporting grounding for routine mutations | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5260 | validator blocks non-diagnostic request interpretation evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5275 | validator returns repair metadata for ungrounded evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5307 | validator allows full short user messages as evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5331 | validator allows exact short concern terms as evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5373 | validator allows decorative quote marks and punctuation differences in evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5417 | validator allows German umlaut transliterations in evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5442 | validator allows evidence quotes from active routine visible step labels | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5520 | validator warns instead of blocking semantically close evidence paraphrases | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5592 | validator rejects vague or invented evidence quotes | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5627 | validator sanitizes harmless terminal evidence quote metadata during validation | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5676 | validator sanitizer refuses mixed or non-evidence failures | R | product-selection/evidence grounding; regression is ungrounded tool evidence or unsafe repair |
| 5716 | validator requires user-facing prose to mention each recommended product | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 5774 | validator blocks incomplete routine prose that omits visible steps | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 5847 | validator blocks incomplete product prose that omits a final recommendation | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 5902 | validator blocks final product rendering when product names are unavailable | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 5942 | validator blocks incomplete routine product deep dive prose that omits the product | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6015 | validator requires blocked answers to render the actual blocker, not only a generic phrase | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6040 | validator rejects unasked product cards in general advice | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6076 | validator rejects product recommendation mode when the user did not ask for products | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6100 | validator requires selected products to be surfaced for concrete category-fit asks | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6148 | validator allows general category comparison without product fulfillment | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6183 | validator respects an explicit request for two product recommendations | R | Exact-count overflow side of `validateProductAnswerShape`: three rendered recommendations for requested two. L6478 covers undercount through the same `!==` branch but cannot catch an overflow-only regression (for example changing the predicate to `<`). |
| 6244 | validator accepts explicit one and two product recommendation counts | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6306 | validator allows vague alternatives to return one grounded option | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6347 | validator allows vague alternatives to return more than three grounded options | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6401 | validator accepts one visible recommendation per multi-category product slot | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6478 | validator still blocks single-category exact-count mismatches | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6512 | validator does not relax single-category exact-count requests into invented slots | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6566 | validator does not let model-authored evidence unlock invented slots | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6619 | validator blocks multi-slot answers that surface products outside selected projections | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6685 | validator blocks multi-slot answers above the distinct category cap | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6761 | validator does not relax multi-slot answers that double-fill one slot | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6835 | validator does not relax multi-slot answers with duplicate recommendation rows | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6898 | validator does not apply the multi-slot cap to non-A2 multi-category traces | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 6959 | validator does not relax exact counts for terminal-only multi-category slot shape | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7009 | validator accepts natural catalog-verification wording for blocked product lookup answers | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7089 | validator ignores hidden product grounding for blocked not-found product deferrals | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7174 | validator does not relax multi-slot answers using prior-turn selected products | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7244 | validator does not relax multi-slot answers that omit a fillable slot | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7306 | validator accepts partial success for multi-category product slots | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7370 | validator does not relax partial success that hides an empty slot | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7434 | validator does not relax partial success that names an empty slot without no-match copy | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7499 | validator does not relax missing-slot copy when safe language refers elsewhere | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7564 | validator allows routine product asks as product recommendations with routine context | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7628 | validator bases option count on projections relevant to the recommended products | R | visible rendering and product-count contract; regression is hidden, wrong, or unfulfilled recommendation output |
| 7672 | validator validates every answer mode payload | R | terminal payload schema/repair protocol; regression is invalid-mode acceptance or unhelpful repair metadata |
| 7855 | validator rejects malformed mode payloads | R | terminal payload schema/repair protocol; regression is invalid-mode acceptance or unhelpful repair metadata |
| 7868 | validator coerces constraint-shaped safety payloads | R | terminal payload schema/repair protocol; regression is invalid-mode acceptance or unhelpful repair metadata |
| 7910 | validator explains mismatched payload fields for repair | R | terminal payload schema/repair protocol; regression is invalid-mode acceptance or unhelpful repair metadata |
| 7953 | validator blocks hallucinated routine step ids | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8008 | validator blocks payload routine step ids that bypass tool grounding | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8054 | validator blocks routine payload layer that disagrees with routine context | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8111 | validator requires routine tool call even when routine projections are present | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8157 | validator allows first category-specific routine mutation when current routine inventory exists | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8241 | validator allows guidance-only general advice inside active routine thread | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8310 | validator keeps routine context active for routine follow-up questions | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8368 | validator requires routine tool for routine mutation inside active thread | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8430 | validator blocks routine mutation intent even when mislabeled as general advice | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8491 | validator blocks pronoun-based routine mutation intent in active routine thread | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8552 | validator blocks routine layer regression using routine thread current layer fallback | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8634 | validator requires routine tool for hand-rolled routine change advice | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8692 | validator allows placement-only dry shampoo advice without routine tooling | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8713 | validator allows placement-only oil and leave-in advice without routine tooling | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8734 | validator allows concise summaries inside active routine threads without routine tool | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8794 | validator requires product tool and routine return path for routine product recommendations | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8855 | validator allows nullable next step offer for routine product recommendations with return path | R | routine continuity/tooling boundary; regression is hand-rolled mutation or lost return path |
| 8938 | validator blocks objective bad conversation closers | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9040 | validator checks rendered clarification question close text | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9089 | validator warns but does not block weak conversation closers | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9136 | validator warns on duplicated medium-length visible answer paragraphs | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9189 | validator warns on adjacent long visible answer paragraphs with high overlap | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9242 | validator ignores repeated short visible answer labels | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9291 | validator allows honest clean stop for unsupported INCI-list analysis | R | conversation-close/render quality boundary; regression is unsafe bait, duplicate output, or false positive |
| 9348 | validator blocks carried routine step ids when active routine thread has no visible steps | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9422 | validator accepts routine product recommendation step ids from active routine thread visible steps | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9504 | validator blocks routine product recommendation context categories that disagree with interpretation | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9584 | validator blocks routine product recommendation category that disagrees with referenced routine step | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9668 | validator blocks ungrounded routine product recommendation step ids | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9725 | validator blocks product-first answers in restricted safety mode | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9735 | validator blocks common German medical diagnosis and treatment claims | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9760 | validator caps product recommendations at three when count policy is cap | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9805 | validator drops invalid session memory without blocking valid final answer | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9843 | pending intake lookup for another category does not block a grounded recommendation | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9883 | pending same-category intake does not veto a generic recommendation for other products | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |
| 9918 | runtime-loaded guidance satisfies the requirement when the model omits it from grounding | R | routine-step/safety/session-guidance boundary; regression is ungrounded continuity, medical breach, unsafe memory, or missing runtime guidance |

## Nested/table semantic rows (not additional AST declarations)

| parent AST declaration | rows | mark | evidence |
|---|---|:---:|---|
| L2104 | ambiguous; needs_variant_selection; category_mismatch; insufficient_identity; not_found; unsupported_category | R | Each ProductLookupStatus policy value must block product-specific output; direct status-to-validator boundary. |
| L3164 | shampoo; conditioner; mask; leave_in; oil; bondbuilder; deep_cleansing_shampoo; dry_shampoo; peeling | R | Each category reference term is a distinct `getAgentV2NamedProductCategoryReferenceTerms` expansion; retain all rows. |
| 4852 | ue; ae; oe; ss-heisst; ss-gross; ss-grosse; ss-grossen; ss-ausser; ss-ausserdem; ss-weiss | R | Distinct orthography detector tokens; preserve warn-not-block policy and all false-negative rows. |
| L5374 | each decorative quote/punctuation evidence_quote row | R | Normalizer punctuation variants; direct evidence-grounding compatibility rows. |
| L5593 | User wants medical treatment; shampoo; Routine | R | Distinct vague/invented evidence failure shapes; direct fail-closed evidence boundary. |
| L7820 | product_recommendation; product_assessment; routine; general_advice; clarification; constraint_blocked; safety_boundary; social; domain_boundary | R | Each terminal answer mode has a different payload schema; preserve every row. |
| L8979 | generic; infeasible; multi-question; redundant product recommendation; two unsupported-INCI variants; redundant comparison; redundant source triage | R | Separate generic/infeasible/unsupported/multi-question closer detectors; retain rows. |
| L9298 | three declared allowed-refusal wordings | R | False-positive guard for supported clean-stop language; retain rows. |
| L9736 | Ekzem behandeln; Psoriasis medizinisch behandeln; Entzuendung behandeln | R | Separate medical safety pattern rows; retain all. |

## Result

- AST declarations: 195 (193 string-literal declarations plus the two dynamic declaration sites at L2104/L3164). The nested/table semantic rows below are annotations only and do not increase this count.
- D: 3 declarations. C: 8 declarations, with every semantic row transferred into its named keeper table (do not count C rows as semantic pruning).
- No production source is test-only or unlocked by this batch.
