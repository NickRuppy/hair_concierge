# AgentV2 product/context owner-layer reassessment

Current scope: **111 declarations**, {'R': 101, 'F': 3, 'C': 4, 'D': 3}. Proposed net removals **7**, conditional on main native/control proof. No added declarations, inputs or table rows. Read-only; repository untouched.

This reassesses the first seven files from the generic 254-site all-R runtime ledger, not new full-read credits for those files. All eight current test files, callbacks, inline fixture functions and both external JSON fixture bodies were read. Source owner functions were read with focused runtime/pipeline entry and validation sections; the complete large production pipeline, full responses-runtime suite, browser execution, provider behavior and repository-wide duplicate closure are not claimed.

## Reachability, history, and CI

The current /api/chat route calls runAgentV2ProductionPipeline; that builds named product/current and persisted resolved contexts then runs runAgentV2ResponsesTurn. The runtime invokes resolvePendingRoutineMutationPolicy and actual terminal validation; final-answer-validator safeParses AgentV2TerminalAnswerSchema. Product-tool message composition is used in production chat and the supported compare runner. ChatMessage renders actual ProductLookupClarificationCard and ProductIntakeCard; the latter and clarification card both call ProductIntakeSubmittedState. All production seams remain in use; no source deletion proposed.

History inspected: fc8b7e20 introduced product-tool context with AgentV2 CareBalance delivery; dbf56a5d is the follow-up-confirmation/repair change and introduced pending helper tests; b4fb21f4 intake consolidation explains submitted-state continuity; 5ee54b61 moved chat context off legacy RAG without retiring current cards; fa358862 adjusted default model. These are current contracts, not age-based retirements. History scope was file logs and commit stats/current call graph; no claim about actual operator traffic.

CI: package test:node includes chat-product-mentions; test:agent explicitly includes contracts, lookup-policy, resolved-selection adapter and responses-runtime. Four scoped .spec files (current-care, named-product, product-tool-context, pending-followup) are absent from test:agent and from the .test.ts glob. This is a preexisting routing gap, not a deletion reason. Main must explicitly include all eight in focused validation. Zod installed strictObject/discriminatedUnion/safeParse implementations were read: rejection is driven by accumulated issues, validating the F concerns.

## Candidate assertion union

### C1 C — tests/chat-product-mentions.test.tsx:777
Donor: `pending product intake submitted state collapses the editable form`
Keeper: `tests/chat-product-mentions.test.tsx` — `product intake card renders persisted submitted state after reload`
Same pending_review child status; parent existing persisted pending offer returns the same real child. Preserve role=status, aria-live=polite, pending headline/body, absence of Foto hochladen/Daten eingeben/Kategorie/Häufigkeit/Jean &amp; Len/Produkt einreichen.
Child renderer output already delivered through the real parent and persisted-status branch; transfer missing output assertions before deleting direct child render.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

### C2 C — tests/chat-product-mentions.test.tsx:792
Donor: `matched product intake submitted state renders compact saved copy`
Keeper: `tests/chat-product-mentions.test.tsx` — `product intake card renders resolved review state after approval`
Same child status matched is selected by existing approved review overriding pending status. Preserve saved headline, direct-followup body, no upload/submit controls and preexisting absence of pending headline.
Existing approved parent boundary delivers identical matched renderer; transfer body and no-upload assertion.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

### C3 C — tests/chat-product-mentions.test.tsx:922
Donor: `assistant product lookup clarification renders a category fallback without an image url`
Keeper: `tests/chat-product-mentions.test.tsx` — `assistant product lookup clarification renders an enabled structured selection action`
Same createProductLookupClarification candidate (no image_url), conversation-1, valid assistant id and callback; parent ChatMessage maps same card. Keep Syoss name plus no img anywhere in existing products-empty parent output. Assistant id differs but only its nonempty/non-temp status is read before handler invocation.
Transfer no-img assertion to existing same clarification at ChatMessage renderer; no extra render/input.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

### C4 C — tests/chat-product-mentions.test.tsx:722
Donor: `normal product intake offers render as an action card without duplicate helper copy`
Keeper: `tests/chat-product-mentions.test.tsx` — `product intake card reports submitted metadata to parent`
createProductIntakeOffer defaults equal all explicit keeper overrides (shampoo, weekly_1x, manual); serialize the already-rendered initial element before its existing click. Preserve both method labels and absence of duplicate helper paragraphs without a second component invocation.
Existing real initial render then submit lifecycle owns same initial offer output; dispatcher only models React state and endpoint mock supplies remote response, neither implements labels.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

### D1 D — tests/agent-v2-pending-followup-action.spec.ts:167
Donor: `isPendingRoutineMutation only accepts routine mutation actions`
Keeper: `tests/agent-v2-pending-followup-action.spec.ts` — `resolvePendingRoutineMutationPolicy authorizes short confirmations for routine mutation state`
Helper reads only action?.kind. Donor routine_mutation simplify/null fields and keeper add_step/mask/basics have identical kind projection. Product_recommendation mask/null action negative is literal-equivalent and policy also retains null input. Both full policy outputs checked.
Existing actual policy observes both boolean outcomes and authorization result; inert category/layer/action differences do not create predicate behavior.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

### D2 D — tests/agent-v2-product-tool-context.spec.ts:10
Donor: `direct product messages are passed through unchanged`
Keeper: `tests/agent-v2-product-tool-context.spec.ts` — `direct asks with a named object stay unchanged even with referential wording`
Welches Öl passt für Glanz und Frizz? and Welches Tiefenreinigungsshampoo passt dann? both enter generic DIRECT_NAMED_OBJECT_ASK positive branch. Keeper dann additionally reaches referential augmentation if direct guard regresses; donor without referential tokens still returns unchanged through fallback. No category dictionary here.
Keeper is a discriminating positive control for same early return; donor remains green if direct guard disappears.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

### D3 D — tests/agent-v2-contracts.spec.ts:255
Donor: `AgentV2TerminalAnswerSchema accepts text-only product assessment payload`
Keeper: `tests/agent-v2-responses-runtime.spec.ts` — `AgentV2 runtime repairs ungrounded trusted product assessment by loading product facts`
Donor only checks parsed answer_mode. Runtime keeper actually safeParses same discriminated product_assessment/fit branch, one nonempty id, string answer, valid nullable context and empty memory; final product_assessment plus null failure_stage prove acceptance. Shampoo/count1/exact independent field members are retained at request-interpretation keeper. ID/prose/confidence differ inside unrestricted string/in-range numeric branches. No cross-field category/count restriction exists in schema.
Accepted fit schema branch is exercised by real runtime repair and schema parse, not implemented by fake provider. No independent shape assertion beyond mode is lost.
No production removal: all covered owners remain current runtime/renderer callees. Only unused test imports removed.
Conditional until native unchanged baseline, transferred keeper and actual-owner faults pass; no provider/browser execution claim.

## Per-declaration ledger

### tests/agent-v2-current-care-context.spec.ts
SHA256 `5639001ec803c72ccf74e94711af0add6cacecae0e478c6c146b4d2affab4f04`; 12 sites.

- **R 12** `AgentV2 exposes set_current_care_context with current-turn fact schema` — Tool registration and four discriminated fact variants are a model protocol: dropping a branch or required evidenceQuote fails; runtime execution alone never proves generated JSON schema.
- **R 64** `AgentV2 model-facing current-care tool schema uses direct root fields` — Flat model-facing fields and JSON strictness differ from internal union schema; restoring oneOf or a nested fact wrapper breaks the independently asserted provider contract.
- **R 120** `AgentV2 parses current-turn context signals from direct tool input` — Exact flat context_signal parsing maps code/evidence without branch leakage; runtime grounded acceptance does not assert the normalized code returned.
- **R 139** `AgentV2 accepts shape-changing chemical treatment profile augments` — Permed and chemically_straightened traverse explicit enum membership; dropping either allowed treatment fails the existing two-row contract.
- **R 158** `AgentV2 parses brush type as a current-turn profile override array` — Brush scalar/array normalization, deduplication, none_regular empty form, contradictory and invalid values exercise distinct readsets; loss of dedupe or accepting unknown arrays fails.
- **R 264** `AgentV2 rejects invalid current-care profile values` — Invalid enum-like profile values must throw the current-care parse error; loosened field allowlists admit rejected values.
- **R 290** `AgentV2 rejects current-care direct tool input with branch leakage` — Fact branch leakage must fail rather than silently mix category/field/signal attributes; permissive parsing or wrong branch priority fails.
- **R 358** `AgentV2 runtime rejects current-care facts with fabricated evidence quotes` — Fabricated evidence must block actual set_current_care_context execution; disabling evidence containment causes runtime assertions to fail.
- **R 385** `AgentV2 runtime accepts grounded current-turn context signals` — Grounded evidence must be admitted, a positive control separate from rejection; rejecting all context facts fails the actual executed-tool observation.
- **R 410** `AgentV2 returns compact current-care tool output to the model` — Model sees compact applied-fact output, not hidden effective context; returning full internal facts or omitting model output breaks asserted protocol.
- **R 458** `AgentV2 runtime applies current-turn facts to the same effective context for product and routine tools` — Same effective current-turn facts must reach both product and routine tools; applying override to only one consumer fails the captured two-tool contexts.
- **R 561** `AgentV2 trace keeps executable tool arguments model-visible only` — Trace/privacy split protects executable tool inputs from persisted summaries while allowing model input; raw-argument leakage or removing model-visible input fails.

### tests/agent-v2-named-product-context.spec.ts
SHA256 `cc94d0ead07803dfb43b4740b4341bc2328a557913bf83ddc38e145909db99c4`; 16 sites.

- **R 9** `detects exact Urban Alchemy conditioner name from latest user message` — Postposed von brand must reorder Urban Alchemy and classify the bare mention as background; dropping the brand-reorder path fails.
- **R 21** `detects named product from a fuller product-detail question` — Own-use question contains brand-before-den-category ordering and evaluation suffix; losing that extraction path fails canonical name/intent.
- **R 34** `detects named product from common what-do-you-think wording` — What-do-you-think prefix is stripped before exact-name extraction; prefix retained in name or wrong evaluation intent fails.
- **R 46** `detects unquoted named product from add-to-routine wording` — Imperative Füge ... zu meiner Routine hinzu must preserve hyphen/ampersand identity and routine_add; losing imperative matcher fails.
- **R 58** `detects common own-product suitability and routine-add phrasing` — Complete table separates current-use question, suitability, own-product evaluation and routine-add patterns; collapsing them to evaluation loses expected intent.
- **R 125** `detects lowercase own-product mentions from natural chat wording` — Lowercase possessive/free-form identities use a permissive extraction path absent from capitalized-name cases; requiring title case fails.
- **R 166** `marks named current-use products as background when the question is category-level` — Category-level question following named current use must stay background; priority inversion that turns mention into actionable lookup fails.
- **R 215** `detects quoted named product with category signal` — Quoted-name path supplies category separately; removing quote extraction or category signal fails.
- **R 225** `does not classify generic category asks as named products` — Generic category questions must not become exact product identities; relaxing name-specific evidence fails null assertion.
- **R 234** `does not include sentence-initial question words in noisy named product asks` — Noisy sentence-initial question words are excluded from extracted identity; including prefix token fails name expectation.
- **R 243** `does not classify generic product recommendation asks as named products` — Generic recommendation requests are not lookup identities; broader recommendation match accidentally starts intake and fails.
- **R 252** `does not classify lowercase generic category descriptions as named products` — Lowercase category descriptors must not pass permissive lowercase name extraction; removing generic-token rejection fails.
- **R 270** `does not classify broad category or brand-family asks as intake candidates` — Brand-family and broad category references lack an exact variant; making every brand mention actionable fails table negatives.
- **R 287** `does not classify generic routine planning requests as exact product identities` — Generic routine planning verbs/category language must not become product identity; loosening routine exclusion fails.
- **R 308** `does not infer categories from aliases embedded inside product tokens` — Category aliases embedded inside longer product tokens must not match word boundaries; substring category inference fails.
- **R 325** `normalizes product names for overlap comparison` — Overlap normalization removes von and lowercases with canonical token order; losing stopword removal fails second independent expected string.

### tests/agent-v2-product-tool-context.spec.ts
SHA256 `ca663a9ea4b16d519bef54caf9a45b74d7e6cc1044d79d3e2259bf44f3533293`; 8 sites.

- **D 10** `direct product messages are passed through unchanged` — Keeper is a discriminating positive control for same early return; donor remains green if direct guard disappears.
- **R 25** `direct asks with a named object stay unchanged even with referential wording` — Named-object early return must win despite dann referential token; removing direct named guard appends stale context and fails.
- **R 40** `direct product asks with zu stay unchanged instead of inheriting stale context` — DIRECT_PRODUCT_NEED with generic Produkt and zu is a separate predicate from named objects; losing this alternative appends stale context.
- **R 55** `referential product follow-ups include recent user context and latest message` — Referential follow-up must include bounded recent-user context and latest text; dropping history or current message fails exact output.
- **R 70** `referential group follow-ups include recent user context` — REFERENTIAL_GROUP_ASK wins for group pronouns and preserves context; treating von denen as a named object fails.
- **R 85** `assistant text is excluded from deterministic product inference context` — Assistant text must be excluded from deterministic product inference; removing role filter leaks assistant content into output.
- **R 99** `German referential product follow-ups are recognized` — Five German referential forms cover matcher alternatives beyond one dann case; narrowing the regex loses at least one recognition.
- **R 111** `oil finish follow-up resolves purpose from prior user context` — Composed oil-purpose resolution consumes contextualized follow-up; dropping the prior finishing cue changes actual purpose from expected styling_finish.

### tests/agent-v2-product-lookup-policy.spec.ts
SHA256 `8f6b4d83ed9eb8d181d4d2a4680baf22b726527361ada1127d016ac237cc5541`; 5 sites.

- **R 13** `Agent V2 product lookup policy maps found products to answerable catalog results` — found_exact guidance and no-block/no-card flags are independent model-output/validator policy fields; runtime keeper does not assert their complete literal union.
- **R 24** `Agent V2 product lookup policy maps not_found to intake-card handoff` — not_found exact German intake handoff must prohibit product assessment and signal card; changing prompt instructions or clarification flag fails.
- **R 36** `Agent V2 product lookup policy maps variant and category conflicts to clarification cards` — All three conflict statuses must share clarification admission flags; removing category_mismatch from the status set fails one existing row.
- **R 47** `Agent V2 enriches pure product lookup results with model-visible guidance` — Actual enrichment keeps status/product/candidates and appends exact model guidance; failing to carry candidates or changing instruction bytes fails.
- **R 67** `Agent V2 leaves non-lookup tool outputs untouched` — Malformed/non-lookup result and null remain safe pass-through. Reference identity is not an independent architecture contract; null protection is the retained concrete failure if enrichment reads status unconditionally.

### tests/agent-v2-resolved-product-selection-adapter.spec.ts
SHA256 `c8e960d455f4363aed360bea8b81580be30012ab8ea06415d7f2c60e47649448`; 8 sites.

- **R 32** `adapts product-domain resolved selection into AgentV2 trusted context` — Domain camelCase to trusted snake_case identity bridge; dropping source assistant id or evidenceQuote fails full expected context even if runtime final text remains valid.
- **R 54** `builds the trusted found-exact lookup validation result` — Trusted found_exact result must carry all identity and product fields for validator; omitting category or evidence_quote fails full projected output.
- **R 71** `builds the trusted selected-product projection with selected-product caveat policy` — Selected catalog product is recommend_with_caveat with no supported claims and narrow allowed sources; replacing policy with unrestricted recommend or inventing claims fails.
- **R 106** `preserves active and stored projection conversion shapes` — Active and stored projections have intentionally different persisted shapes; including model-only fields in stored projection or losing provenance fails.
- **R 136** `preserves routine inventory provenance when deriving resolved context` — Routine inventory provenance must survive primary selection; forcing product_lookup_selection source fails and can change grounding permissions.
- **R 159** `skips pending entries when selecting the primary resolved product context` — Pending entries cannot become primary resolved identity; choosing first entry instead of first resolved with id fails.
- **R 196** `replaces a pending intake offer context with the submitted pending product context` — Submitted pending identity must replace prior pending intake offer without losing other contexts; append-only merge or dropping unrelated identity fails.
- **R 234** `replaces a pending product context when the same identity becomes resolved` — Resolution of same identity must replace pending entry, not duplicate it; failure to reconcile product/submission identity fails.

### tests/agent-v2-pending-followup-action.spec.ts
SHA256 `e560999a9d78a8e4f714e1994cf896fd701f6148810d654b32929e7e05e36646`; 9 sites.

- **R 31** `AgentV2PendingFollowupActionSchema accepts the valid action variants` — All valid discriminated pending kinds and their null fields are a persisted/model schema contract; rejecting product/advisor variants fails.
- **R 61** `AgentV2PendingFollowupActionSchema rejects invalid field combinations` — Invalid pending kind-field combinations must fail schema validation; allowing routine action on non-routine or absent action on routine fails.
- **R 119** `legacyRoutineActionToFollowup converts valid legacy routine action state` — Legacy routine action projection is an active compatibility reader; wrong action/category mapping or accepting invalid legacy value fails.
- **R 138** `readPendingFollowupAction reads current action state and falls back to legacy state` — Current action and legacy fallback reading must coexist, malformed current values fail closed; removing legacy fallback or accepting bogus kind fails.
- **D 167** `isPendingRoutineMutation only accepts routine mutation actions` — Existing actual policy observes both boolean outcomes and authorization result; inert category/layer/action differences do not create predicate behavior.
- **R 190** `doesRoutineCallMatchPendingAction matches category, layer, and action` — Authorization must match category, layer and action independently; dropping one comparison causes its corresponding negative assertion to fail.
- **R 249** `doesRoutineCallMatchPendingAction denies non-routine pending actions` — Non-routine input denial retained as security boundary, but guard-specific sensitivity is limited: routine_action null also denies this fixture. No arbitrary invalid action added to isolate guard; not claimed as proof of kind guard.
- **R 270** `resolvePendingRoutineMutationPolicy denies short confirmations without routine mutation state` — Confirmation without pending routine permission must deny both null and product-recommendation actions; accepting non-routine offer fails full policy result.
- **R 302** `resolvePendingRoutineMutationPolicy authorizes short confirmations for routine mutation state` — Valid pending routine action must authorize and preserve action object; denying all confirmation or losing pending payload fails full output.

### tests/agent-v2-contracts.spec.ts
SHA256 `341dce4d44d0ea935ab06b4b0397b7d6b07a72e545c47d30645fef12151798c8`; 20 sites.

- **R 47** `AgentV2RequestInterpretationSchema accepts strict semantic examples` — Independent strict semantic parse table includes primary intents, product kinds, categories/count policy and exact returned fields; dropping a member or stripping field fails.
- **R 118** `AgentV2ValidationErrorSchema accepts optional repair metadata` — Validation metadata is an external repair/debug schema, distinct from runtime terminal parsing; removing optional repair values fails exact parsed schema fields.
- **R 136** `AgentV2RequestInterpretationSchema requires every semantic field` — Every semantic field is required; making a field optional lets its deletion case succeed and fails the loop assertion.
- **R 151** `AgentV2RequestInterpretationSchema rejects unknown enum values` — Unsupported semantic enum values must reject; broadening enum to arbitrary strings makes invalid parse succeed.
- **R 160** `AgentV2RequestInterpretationSchema requires boolean product candidate signal` — Product candidate signal must be boolean; coercion or optional behavior admits invalid inputs.
- **R 174** `AgentV2RoutineThreadContextSchema accepts visible routine steps` — Visible routine steps and pending context must parse at persisted thread boundary; removing required compatibility shape fails.
- **R 203** `AgentV2TerminalAnswerSchema accepts a product recommendation payload` — Product recommendation payload contains nested recommendations/usage/caveat arrays absent from assessment; malformed nested schema or field stripping fails.
- **D 255** `AgentV2TerminalAnswerSchema accepts text-only product assessment payload` — Accepted fit schema branch is exercised by real runtime repair and schema parse, not implemented by fake provider. No independent shape assertion beyond mode is lost.
- **F 300** `AgentV2TerminalAnswerSchema rejects product assessment with too many products` — F: too-many-products fixture also sets invalid assessment_kind comparison. Generic success=false stays green if max(1) is removed. Retain contract; add issue code too_big at payload.assessed_product_ids on same input before any claim.
- **R 344** `AgentV2 terminal answer supports generalized pending follow-up action` — Generalized advisor_response pending action must survive full terminal parse; old routine-only schema fails this previously unsupported branch.
- **R 402** `AgentV2TerminalAnswerSchema accepts social and domain-boundary payloads` — Social and domain-boundary payloads expose different focus/return fields; removing either discriminated variant or stripping shape fails exact output assertions.
- **R 463** `AgentV2TraceSchema accepts turn-gate trace fields` — Trace schema is separate from emitted runtime object and accepts gate trace fields; dropping gate usage/latency metadata fails parser compatibility.
- **F 522** `AgentV2TerminalAnswerSchema requires request interpretation` — F: missing request_interpretation fixture also omits pending_followup_action. Generic rejection survives optionalizing request interpretation; require issue path request_interpretation on unchanged input.
- **F 557** `AgentV2TerminalAnswerSchema rejects unsupported answer modes` — F: unsupported mode fixture also has invalid empty payload and missing pending action. Require invalid_union issue at answer_mode so rejection is attributable to discriminator, not other invalid fields.
- **R 588** `AgentV2 model policy defaults to GPT-5.6 Luna Responses` — Model policy defaults are operator config contract; wrong Luna model/API/reasoning/repair limit fails independently of injected runtime clients.
- **R 599** `AgentV2 model policy accepts scoped env overrides` — Scoped env override priority and selected values are operator contract; ignoring custom model/reasoning settings fails exact result.
- **R 613** `AgentV2 model policy preserves minimal reasoning effort` — Minimal reasoning is supported and must not collapse to default; rejecting minimal override fails.
- **R 621** `AgentV2 positive reference cases preserve quality shape rather than exact wording` — Positive-reference fixture is independent advisory eval content: ids/source/quality taxonomy and non-golden intent; duplicate ids or missing required qualities fail. No runtime producer provides expected rows.
- **R 661** `AgentV2 request interpretation regression fixture is structurally valid` — Full regression fixture integrity validates expected semantic dimensions/tool/safety/card policy and all existing rows; corrupt field types or lost safety dimensions fail independently of runtime.
- **R 812** `AgentV2 regression fixture represents routine product follow-ups as specific products plus routine context` — Routine product follow-ups must be specific_products plus routine_context_required in normative eval fixtures; changing them to routine mutation fails two exact scenario expectations.

### tests/chat-product-mentions.test.tsx
SHA256 `9c1df257bbf1109a5d2fa06394d77032f5411d2d6ef728db9cec76e9d781ff37`; 33 sites.

- **R 255** `bold inline product mentions render one clickable trigger without nested buttons` — Inline bold product mention is one interactive trigger without nested buttons; wrapping existing markup in another trigger fails count/nesting.
- **R 272** `assistant inline numbered steps render as a real ordered list` — Numbered assistant prose must render actual ordered-list semantics; treating list content as plain paragraphs fails ol/li assertions.
- **R 290** `assistant bracketed numbers stay plain text without citation UI` — Bracketed numbers remain ordinary prose after citation retirement; legacy citation UI injection fails absence assertions.
- **R 302** `assistant product lookup clarification renders an enabled structured selection action` — Existing ChatMessage enabled-selection keeper; dropping callback/valid id or rendering selected button disabled fails. Receives no-image assertion C3.
- **R 317** `assistant product lookup clarification disables selection on the streaming message` — Streaming clarification must disable selection; parent always supplies wrapper callback, so streaming flag is load-bearing.
- **R 331** `assistant product lookup clarification locks after a later matching selection` — Later matching structured selection must lock original clarification with selected id; identity mismatch or omitted resolved state fails.
- **R 373** `assistant product lookup clarification keeps candidate actions locked while waiting for resolved selection` — Awaiting resolved selection must keep candidate actions locked; pending locked state differs from completed selected candidate.
- **R 410** `product intake card reports submitted metadata to parent` — Actual ProductIntakeCard submit handles endpoint result and emits metadata after state update; wrong status/id or stale editable output fails. Receives existing initial-render assertions C4.
- **R 477** `assistant product lookup clarification renders locked submitted intake state` — Persisted nested intake submission locks clarification actions/form; losing submitted status in card path fails.
- **R 498** `product lookup clarification state helper resolves intake reviews by structured identity` — Review state matches by structured submission/clarification identities; broad text-based matching or wrong source identity fails.
- **R 531** `product intake offer state helper marks submitted offers and resolves reviews by submission id` — Standalone offer review state resolves by submission id and flags pending; matching wrong submission or losing persisted status fails.
- **R 570** `unsubmitted product intake offers stay editable and do not trigger review polling` — Unsubmitted offers remain editable and must not start polling; treating all offer presence as pending fails.
- **R 585** `successful intake submission patches client message state so review polling can start` — Actual client submission patch must update proper message status/id and enable polling; dropping patch or wrong target fails.
- **R 611** `intake submission patch reaches offers nested in clarification cards` — Nested none-action intake patch must reach clarification offer while preserving surrounding message; only handling top-level offer fails.
- **R 635** `needs-more-info repair offers with a submission id stay editable` — needs_more_info with submission id is editable recovery rather than pending lock; locking every submission id fails.
- **R 665** `product intake card renders persisted submitted state after reload` — Persisted pending status selects submitted child after reload; losing status propagation fails. Receives complete child output union C1.
- **R 682** `product intake card renders resolved review state after approval` — Approved review overrides persisted pending status and selects matched child; reversing precedence fails. Receives complete child union C2.
- **R 706** `assistant product lookup clarification suppresses recommendation cards` — Clarification suppresses unrelated recommendation cards even with products/click callback; removing exclusion renders Balea and fails.
- **C 722** `normal product intake offers render as an action card without duplicate helper copy` — Existing real initial render then submit lifecycle owns same initial offer output; dispatcher only models React state and endpoint mock supplies remote response, neither implements labels.
- **R 733** `photo product intake marks barcode optional unless explicitly requested` — Normal photo barcode optional differs from explicitly required repair; making every barcode required fails.
- **R 746** `needs-more-info photo intake marks barcode as required when missing` — Explicit missing Barcodefoto makes repair barcode required; treating it as optional fails.
- **R 762** `needs-more-info product intake offers keep explicit repair guidance` — Repair guidance exposes missing front image/product name with proper labels; hiding missing-fields block fails.
- **C 777** `pending product intake submitted state collapses the editable form` — Child renderer output already delivered through the real parent and persisted-status branch; transfer missing output assertions before deleting direct child render.
- **C 792** `matched product intake submitted state renders compact saved copy` — Existing approved parent boundary delivers identical matched renderer; transfer body and no-upload assertion.
- **R 801** `product selection helper detects already streamed selection messages` — Existing streamed selection dedupe uses assistant role, clarification/source message identity; losing match check causes wrong duplicate detection. Selected product id is intentionally not consulted.
- **R 833** `targeted product selection stream events do not mutate the source clarification message` — Targeted SSE update must affect new assistant response and preserve source clarification; appending to last/source message fails.
- **R 861** `targeted stream events with a missing assistant id do not mutate the last assistant message` — Missing explicit target must not fall back to last assistant; old fallback behavior mutates wrong message and fails.
- **R 875** `chat stream error helper preserves structured server error messages` — Error helper preserves string/message/error server variants and uses German fallback for malformed input; replacing with generic error loses specific branch assertions.
- **R 906** `assistant product lookup clarification renders candidate images and brand line labels` — Real image URL, brand and cleaned display label must render together; no-image keeper cannot guard image-present branch.
- **C 922** `assistant product lookup clarification renders a category fallback without an image url` — Transfer no-img assertion to existing same clarification at ChatMessage renderer; no extra render/input.
- **R 936** `assistant product lookup clarification candidate names can wrap instead of truncating` — Long candidate name must remain fully present and wrap; retained as rendered layout contract, though class-token coupling is a possible future F requiring computed-browser proof not currently owned.
- **R 956** `assistant product lookup clarification hides legacy duplicate suffixes in candidates` — Legacy duplicate suffix is removed from visible name while product identity remains; exposing suffix fails rendered text.
- **R 973** `clarification card shows only the selected candidate after selection` — After selection only selected candidate remains visible; rendering all original candidates fails negative other-name assertion.

## Staging and validation contract

Artifacts: `/tmp/test-audit-agent-context-edit.cjs`, `-edit-plan.json`, `-complete.diff`, `-transfer.diff`, `-cut.diff`, `-candidates.json`, `-full-ledger.json`, `-controls.json`. Main owns execution. Driver check/before are read-only; transfer retains 111 sites; cut removes seven exact AST callbacks for 104. All eight test hashes and 27 source/dependency/fixture guards are checked. Every prospective phase parses before any write; all hashes rechecked immediately before first rename; originals and receipt saved outside repository. All non-keeper callbacks byte-identical; all fixture/support text unchanged during transfer. Only unused direct-child/predicate test imports removed during cut.

Focused command (before, after transfer, after cut): `node --import ./tests/server-only-register.cjs --import tsx --test tests/agent-v2-current-care-context.spec.ts tests/agent-v2-named-product-context.spec.ts tests/agent-v2-product-tool-context.spec.ts tests/agent-v2-product-lookup-policy.spec.ts tests/agent-v2-resolved-product-selection-adapter.spec.ts tests/agent-v2-pending-followup-action.spec.ts tests/agent-v2-contracts.spec.ts tests/chat-product-mentions.test.tsx`.

For D3 also run the exact named retained responses-runtime keeper via `--test-name-pattern="^AgentV2 runtime repairs ungrounded trusted product assessment by loading product facts$" tests/agent-v2-responses-runtime.spec.ts`. Controls are descriptors only: run individually after transfer, require intended assertion failure, restore exact bytes in finally, then clean keeper green. Do not claim thrown setup/type/dependency failure as sensitivity. F repairs are explicitly outside staged cuts; no deletion credit.

No native tests, compiler, browser, source mutations, provider or DB operations were run by this lane. Static parsing/check evidence is recorded in handback. Final main validation and full campaign coverage gates remain required.
