I now have precise, HEAD-accurate attribution for every finding (and caught that one subagent finding — `deterministicContextRequiresLookup` — was working-tree code, not HEAD). Writing the report.

---

# Code Review — `HEAD` (`1c04b03`)

## Scope

`HEAD` is a **merge commit** (`1c04b03`) that merges `origin/codex/product-identity-canonical-correction` into `codex/product-intake-full-flow-smoke`, with declared conflicts in `scripts/eval-chat/fixtures.ts`, `src/lib/agent-v2/runtime/responses-agent.ts`, `tests/agent-v2-final-answer-validator.spec.ts`, and `tests/agent-v2-responses-runtime.spec.ts`. I reviewed the diff this merge brought onto the branch (`7596bc7..HEAD`, 33 files / +7424), with emphasis on conflict-resolution correctness and the two cross-branch integration changes: the `pending_routine_action → pending_followup_action` rename and the new **required** field `specific_product_candidate`.

**Out of scope:** the large *uncommitted* working tree in this worktree (the product-lookup clarification **card** feature) is not part of `HEAD` and was not reviewed here — see the note at the end. All findings below were verified against `HEAD`'s actual content (`git show HEAD:…`), not the working tree.

---

## Findings (by severity)

### Medium

**1. `isProductEvaluationConstraintRendered` treats affirmative "möglich" as a negation — weakens a blocking-constraint check.** `src/lib/agent-v2/validation/final-answer-validator.ts:2604` and `:2613`
The negation alternation is `(?:nicht|kein|keine|ohne|unmo?glich|moglich)`. `unmo?glich` already covers "unmöglich"; the bare `moglich` additionally matches the **affirmative** "möglich" once `normalizeVisibleText` strips diacritics. The function AND-s three token groups independently (evaluation-word ∧ exactness-word ∧ negation-word) rather than matching a coherent phrase. Consequently a `constraint_blocked`/clarification answer whose prose asserts that a precise evaluation *is* possible ("eine **genaue Produktbewertung** ist **möglich**") satisfies all three groups → `isConstraintRendered` returns `true` (`:2563`) → the `visible_payload_not_rendered` block is skipped, i.e. the validator concludes the blocking constraint was honestly surfaced when the prose says the opposite. Real-world trigger is narrow (requires a self-contradictory answer), but this is **new** validation logic (absent from both parents) and the bare `moglich` alternative is almost certainly an oversight. The sibling helper `isCatalogVerificationConstraintRendered` (`:2574`) uses a clean negation set without this flaw.

**2. New clarification fallback can emit a schema-invalid `evidence_quote: ""` that bypasses re-validation.** `src/lib/agent-v2/runtime/responses-agent.ts:2455` (`buildProductLookupClarificationFallback`)
`evidenceQuote = readNonEmptyString(lookupArgs.evidence_quote) ?? params.message.slice(0, 240)`. When the lookup call carries no usable `evidence_quote` **and** the user message is empty/whitespace, `evidenceQuote` becomes `""`, which is then placed into `request_interpretation.evidence_quote` (and `extracted_constraints.raw_constraints`). The contract requires `evidence_quote: z.string().min(1)` (`contracts.ts:191`). This `answer_mode: "clarification"` answer is returned via `completeWithKnownFallback`, where `isDeterministicRuntimeFallbackAnswer` (`responses-agent.ts:177`) gates re-validation to `general_advice` answers only — so the clarification fallback is emitted **without** schema re-validation, allowing a schema-invalid terminal answer to reach the caller/trace. Low probability (empty messages are typically gated upstream), but there is no non-empty backstop here, unlike sibling fallback builders. Recommend a final `|| "dieses Produkt"`-style guard on `evidenceQuote`.

### Low

**3. Empty-identity asymmetry between the lookup-required gate and the lookup-block gate (undocumented).** `final-answer-validator.ts:1659` vs `:1685`
`productLookupMatchesAnswerCandidate` returns `true` when `identityParts.length === 0` (`:1659`) — a `lookup_product_candidate` call with empty `brand_text`/`product_name_text` counts as a "relevant lookup happened", satisfying `product_lookup_required`. The sibling `unresolvedLookupResultMatchesAnswerClaim` treats the same empty-identity case conservatively, matching only when categories align (`:1685-1691`). This is defensible (permissive require-gate, conservative block-gate) and **not** a hard-rule bypass — the synthetic `status: "called"` object is never in `UNRESOLVED_PRODUCT_LOOKUP_STATUSES`, so it cannot launder an unresolved result — but the divergence is subtle and uncommented. A future refactor that "unifies" the shared `identityParts` builder would silently shift behavior. Add a comment + a confirming test.

**4. Dead test helper — possible dropped assertion from conflict resolution.** `tests/agent-v2-responses-runtime.spec.ts:1055`
`terminalNamedProductDeferredGeneralAdvice(...)` is defined but never referenced. This is the kind of artifact left when a conflict resolution supersedes/drops a test but leaves its helper behind. It does not fail CI (test files are ESLint-ignored; `tsc` doesn't flag unused module-level functions). Confirm no intended assertion was lost in the merge, then delete the helper.

**5. `precisionIdentity` makes product-identity precision depend on brand *recognition*.** `src/lib/product-intake/product-lookup.ts:264`
`precisionIdentity = !resolvedBrandId && brandText ? `${brandText} ${cleanProductName}` : cleanProductName`. The change is **monotonic and safe** — prepending a token can only raise precision, never reject a previously-valid identity, and a false-"precise" pass on an unresolved brand only yields a `not_found` + intake offer, never a spurious catalog match. The side effect: an *unrecognized* generic mention (brand `"Jean & Lean"`, name `"Conditioner"`) now passes precision and offers intake, whereas a *recognized* equally-generic mention (`resolvedBrandId` truthy) stays `insufficient_identity`. This is intentional, but it means any capitalized noise the model puts in `brand_text` will satisfy precision — the downstream `specific_product_candidate` / `answerSupportsProductIntakeOffer` gate is now the real safety net, not the lookup precision check. No bug; flagged so the downstream gate isn't accidentally loosened later.

---

## Verified clean / strengths

- **No leftover conflict markers** anywhere in `src/`, `scripts/`, `tests/` at `HEAD`.
- **Rename is complete.** No stray `pending_routine_action` in source logic; the only remaining references are intentional legacy-migration readers (`src/lib/agent-v2/pending-followup-action.ts:47`, `persisted-session-state.ts`) and regression tests that assert the rename landed.
- **`specific_product_candidate` is fully threaded.** Present in all 12 fallback constructors in `responses-agent.ts`, spread through the validator's evidence-sanitizer, and added to the prompt's *universal* "every `submit_final_answer` must include …" list (not just social/domain_boundary). With strict structured outputs + Zod `strictObject` + the repair loop, omission is structurally prevented and `tsc` would catch any missing literal — so the cross-branch field threading is sound.
- **Data-migration script `scripts/product-identity/correct-canonical-identities.ts` is well-guarded:** dry-run by default (writes only with `--apply`), Supabase-host + `--confirm-project` guardrail, stale-mapping abort before any write, idempotent (accepts pre/post-correction state), never mutates `products.name`, and ref-counted orphan deletes. `data/product-catalog-normalization.json` is valid JSON, 239 unique reviewed rows.

---

## Residual risk & test gaps

- **HEAD was not compiled/tested in isolation.** I deliberately did not run `tsc`/tests against `HEAD` because doing so would require disturbing the user's substantial uncommitted working tree (stash). The "typecheck exit 0 / suites pass" evidence gathered reflects the working tree (HEAD **+** uncommitted), not HEAD alone. If certainty is needed, run `npm run typecheck` and `npm run test:agent` against a clean checkout of `1c04b03`.
- **No direct unit coverage** for the affirmative-"möglich" false-positive (finding 1) or the empty-`evidence_quote` path (finding 2). Both are new behavior introduced by this merge and warrant targeted tests.

---

## Out of scope — adjacent working-tree feature (not in `HEAD`)

This worktree contains a large *uncommitted* feature — the product-lookup clarification **card** (new `src/components/chat/product-lookup-clarification-card.tsx`, `src/app/api/chat/product-selection/`, +711 in `chat-pipeline.ts`, +510 in `use-chat.ts`, plus `route.ts`/`chat-message.tsx` wiring). It is **not** part of `HEAD`. One concern surfaced there worth flagging for when it is reviewed: `productIntakeOffer` and `productLookupClarification` are computed independently with no mutual-exclusion guard, so a single assistant turn can stack both an intake card and a clarification card. To review that feature properly, re-run this with the target set to **"current working tree and branch diff"** rather than `HEAD`.
