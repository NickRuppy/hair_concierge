# Personal Plan Stage 3 fit-review UX repair

Status: implemented and review-ready on fresh `main`
Evidence review: matrix, Auswahl-Panel, soft Status-Zeile, and current-value status selected
Designed user-journey sign-off: confirmed by Nick on 2026-08-13

## 1. Outcome and source context

Repair the merged Stage 3 individual product review so a user can understand and act on each product verdict at a glance on mobile and desktop, including truthful pending and zero-alternative states.

Source evidence:

- [Diagnosed findings](evidence/2026-08-13-stage3-fit-ux-findings.md)
- [Merged durable-fit plan](2026-08-12-personal-plan-stage3-durable-fit-review.md)
- Five authenticated screenshots supplied on 2026-08-13
- Merged implementation: PR #385 / `d0a4ca8c`

Planning contract:

- Outcome: each review clearly communicates category, position, verdict, evidence, and saved action.
- Constraints: preserve individual reviews, at most three server-verified alternatives, exact candidate/fingerprint validation, durable recovery, direct Routine handoff, and deterministic server-owned reasoning with no generated or client-inferred fit claims.
- Non-goals: do not change recommendation rules, candidate eligibility, product catalog data, persistence schemas, Routine computation, or analytics identity policy.
- Done when: the reviewed prototype covers comparison, fit/no-alternative, no-product/no-alternative, pending, and error states at mobile/desktop widths; the journey is explicitly signed off; implementation tasks and regressions are checkable.

## 2. Chosen direction

Use a **verdict-first comparison matrix with an Auswahl-Panel**.

Every normal review begins with a visible category/role and position, followed by a quiet overall verdict (`Passt`, `Passt teilweise`, or `Passt nicht`) and the number of verified criteria currently in the target. Current and selected alternative products remain side by side on mobile. A compact matrix directly compares `Deins`, `Ziel`, and `Alternative` for each criterion. Each softly tinted row carries a small check or cross beside the actual `Deins` value rather than repeating `Passt` or `Passt nicht` beneath the criterion name. Tapping a row selects it and updates one persistent Auswahl-Panel below the matrix with the server-owned reason for that target and the profile facts that support it. The sticky footer contains exactly one short primary action.

Reasoning is computed from structured authority evidence, not authored ad hoc in the component. Core categories use observed product values plus a target relation where the authority owns one. Dimensions without an authoritative target show the verified values and explicitly avoid an in/out mark. Specialist categories use compact pass/caution/fail criteria instead of invented numeric positions. Pending, unknown, and unsupported products receive no fit verdict.

At `375–400px`, each product card deliberately keeps only its label, image, and fully wrapping product name. Per-card recommendation prose moves into the verdict/evidence area instead of competing for width. This is the selected compact-card tradeoff: identity remains complete, while duplicate explanatory copy is removed.

Use dedicated state templates when comparison is not truthful:

- owned product fits but no alternative: positive verdict and keep action, no empty comparison shell;
- no product and no verified alternative: honest explanation with deliberate `Vorerst ohne Produkt` action and a contained add/back option when available;
- pending product: pending explanation and next-step expectation;
- unsupported analysis: retry state;
- no truthful action: explicit no-alternative state, never a fake comparison.

This direction keeps the transparency of the signed comparison design while making the actual routine decision understandable before the evidence detail.

## 3. Scope and non-goals

In scope:

- Stage 3 review information hierarchy and German copy;
- visible category/role and subject progress;
- mobile and desktop product-card composition;
- compact comparison-matrix semantics, subtle row status, and selectable explanations;
- primary/secondary action hierarchy and overflow containment;
- structured server-owned fit reasoning for every known category/role evaluation;
- supportive-action normalization so keep, exact replacement, and continue-without are all available;
- scroll/focus behavior when moving between review subjects;
- dedicated sparse, pending, unsupported, and zero-action states;
- component, flow, and browser regression coverage.

Out of scope:

- changes to Stage 1/2 category selection;
- catalog or hair-care authority changes;
- new recommendation candidates or scoring;
- scoring or fit claims for pending, unknown, or insufficiently verified products;
- changes to Stage 3 durable mutation/retry architecture;
- Routine or Anwendung redesign;
- migration, deployment, or feature activation.

## 4. Target map

Likely production surfaces:

- `src/lib/personal-plan/products/fit-comparison.ts`
  - add deterministic matrix rows, per-product display values, and server-computed target relations as additive response fields on the existing non-persisted comparison projection;
  - retain the existing `dimensions` field unchanged as a deprecated compatibility shim so an already-open older client can refetch safely; the new client reads only `evidenceRows`, and the exhaustive new relation tests cover only the authoritative `evidenceRows` path rather than duplicating both projections;
  - retain compact specialist reasoning and explicit `no_target`/`unknown` cases instead of fabricating corridors.
- `src/lib/personal-plan/products/authority/categories/*.ts`
  - normalize every category adapter that can emit a supportive owned-product verdict so `keep_owned` and `leave_uncovered` are both available; `select_replacement` remains bound to the server-built comparison allowlist.
- `src/lib/personal-plan/products/authority/contracts.ts` and `src/lib/personal-plan/products/gateway.ts`
  - extend the typed comparison transport only as required for structured reasoning; do not change persistence schemas or client-authoritative inputs.

- `src/components/personal-plan-products/product-fit-comparison.tsx`
  - render verdict-first normal and sparse states;
  - compose side-by-side products, the selected comparison matrix/Auswahl-Panel, and bounded actions.
- `src/components/personal-plan-products/stage3-products-flow.tsx`
  - provide decision-phase-only category/role, current review position, and total review count;
  - derive the total from `deriveStage3DecisionSubjects(draft).length`;
  - lift the resolved displayed `nextSubject.decisionKey` to a memoized value that can key scroll/focus and alternative reset effects;
  - preserve exact decision submission and recovery.
- `src/components/personal-plan-products/index.tsx`
  - leave the shared `Stage3Shell` presentation unchanged; `currentStepLabel` is used by capture, role, system, and handoff screens that are outside this reviewed surface.
- `src/components/ui/button.tsx`
  - do not globally relax `whitespace-nowrap`; apply the proven local `whitespace-normal`/containment override to this `funnelCta` instance.
- `tests/personal-plan-product-fit-comparison.test.tsx`
- `tests/personal-plan/products/stage3-authority.test.ts`
- `tests/personal-plan/products/production-persistence-gateway.test.ts`
- `tests/personal-plan-stage3-flow.test.tsx`
- `tests/personal-plan-stage3.spec.ts`

A bounded server response-contract extension is expected. No database migration, stored-schema change, or new recommendation rule is expected.

Consumer inventory for the additive comparison contract: production and fixture gateways, Stage 2 entry/bootstrap transport, the Stage 3 API response, HTTP gateway parsing, Stage 3 flow bundle alignment, `ProductFitComparison`, and their fixtures/tests. The server and client deploy atomically; the comparison is computed fresh and is not persisted in a Stage 3 draft or recovery command. Therefore no second schema version or dual parser is introduced. Existing `dimensions` remain unchanged solely for already-open older clients and keep their current regression coverage; they are not a second authoritative model. The new client treats missing structured evidence as an honest compact state and never infers target relations from labels.

Sequencing decision: implement core rich comparisons and specialist compact reasoning in the same PR. Users must not receive category-dependent explanation quality; the exhaustive category/role matrix is the release gate. This increases test scope but avoids shipping a knowingly inconsistent trust surface.

## 5. Designed user journey

### Entry

The user has finished entering exact products. Stage 3 opens the first unresolved product review at the top of the page.

### Normal owned-product comparison

1. A review-only context row says, for example, `Conditioner · Produkt 2 von 5`. It is rendered inside the product-review surface, not globally in the shared Stage 3 shell. The denominator comes from the complete derived decision-subject list.
2. A restrained heading says `Dein Conditioner im Vergleich`. Immediately below it, a quiet overall verdict says `Passt`, `Passt teilweise`, or `Passt nicht`. `m` counts only displayed rows with an authoritative target; `no_target` rows are excluded. The `n von m im Ziel` count appears only when every target-bearing current-product relation is `in_target` or `outside_target`. If any target-bearing relation is `unknown`, the count is omitted rather than guessed.
3. `Dein Produkt` and `Passende Alternative` are shown side by side, including at `375–400px`.
4. If multiple verified alternatives exist, arrows change only the viewed alternative and show `Alternative 1 von 3`; nothing is saved yet. The matrix and selected explanation update to the newly viewed candidate.
5. A compact four-column matrix shows `Prüfpunkt`, `Deins`, `Ziel`, and `Alternative`. Every known row uses the selected softened Status-Zeile treatment: near-white tint, two-pixel status rail, and a small outlined check or cross beside the current `Deins` value. Criterion names carry no repeated fit label. Color is never the only status cue.
6. The first decision-relevant row is selected initially. Tapping or keyboard-selecting another row changes only the persistent Auswahl-Panel below the matrix. The panel states whether the current value is `im Ziel` or `außerhalb des Ziels`, explains why that target matters, and cites the bounded profile facts used for it.
7. A row without an authoritative target shows the verified values but no status rail, check/cross, overall-count contribution, or fit claim. A row with unknown product facts likewise says that the relationship cannot yet be assessed.
8. Any override/secondary action sits in a labeled `Andere Möglichkeit` area immediately before the footer.
9. The sticky primary CTA is short: `Mein Produkt behalten` or `Diese Alternative wählen`. The exact product name stays visible in the product card/footer context rather than being interpolated into the button.
10. On save, the next unresolved review opens at the top and announces its new heading to assistive technology.

### Decision actions by verdict

| State                                     | Primary action                    | Contained alternatives                                                              |
| ----------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| Does not fit, verified alternative exists | `Diese Alternative wählen`        | `Mein Produkt trotzdem behalten`, `Vorerst ohne Produkt fortfahren` when authorized |
| Fits partly, verified alternative exists  | `Mein Produkt behalten`           | `Diese Alternative wählen`, `Vorerst ohne Produkt fortfahren`                       |
| Fits, no clearly better alternative       | `Mein Produkt behalten`           | none by default                                                                     |
| No product, no verified alternative       | `Vorerst ohne Produkt fortfahren` | `Produkt hinzufügen` or back when available                                         |
| Analysis outstanding, no alternative      | `Auf Analyse warten`              | `Andere Produkte weiterprüfen`                                                      |
| Fit cannot be assessed reliably           | current authorized safe action    | verified alternative or continue-without only when authorized                       |

In the partial-fit state, changing the viewed candidate remains presentation-only. `Diese Alternative wählen` always saves the currently viewed exact candidate ID and fingerprint. `Mein Produkt behalten`, `Diese Alternative wählen`, and `Vorerst ohne Produkt fortfahren` are three distinct decisions; none is silently substituted for another.

### Owned product fits, no verified alternative

1. Context and progress remain visible.
2. The state says `Dein Produkt passt zu deinem Bedarf.` and explains why.
3. No empty alternative slot, carousel, or comparison matrix appears. A compact owned-product evidence summary may show verified in-target criteria without implying that alternatives were evaluated.
4. Primary action: `Mein Produkt behalten`.

### No owned product and no verified alternative

1. The state says `Aktuell ist keine verifizierte Empfehlung verfügbar.`
2. It explains that this is an availability/authority limit, not proof that no suitable product exists.
3. When `leave_uncovered` is authorized, the primary action says `Vorerst ohne Produkt fortfahren` and makes the Routine consequence explicit.
4. `Produkt hinzufügen` or `Zurück zu meinen Produkten` is presented as a contained secondary action when supported by the flow.

### Pending product

1. The entered product identity stays visible.
2. The state says `Dein Produkt wird noch geprüft.` and explains that no fit verdict is being claimed yet.
3. If a verified alternative exists, it may be viewed and explicitly chosen.
4. Otherwise the primary action says `Auf Analyse warten`; no empty comparison matrix appears.

### Known identity but no reliable fit verdict

1. A `known` evaluation with `verdict: "unknown"`, or an exact product whose required facts are unavailable, never maps to `Passt`, `Passt teilweise`, or `Passt nicht`.
2. The state says `Noch nicht eindeutig beurteilbar.` and explains `Für diesen Vergleich fehlen noch verifizierte Produktdaten.`
3. It shows any verified identity or criterion evidence without target marks or an overall fit count.
4. If the current server bundle contains a verified selectable alternative, the user may choose it explicitly. Otherwise only the currently authorized safe action is shown, such as continuing without the product or returning to product entry. It does not promise that analysis is underway unless the product is actually pending.

### Unsupported or changed analysis

1. The user sees a compact retry/reload state with retained-selection reassurance.
2. The button retries the canonical review load; it does not silently submit a stale choice.

### Completion

The final successful decision completes Stage 3 and opens Routine directly, unchanged from the durable-flow contract.

## 6. Planning evidence

Retained decision evidence:

- `plans/mockups/2026-08-13-stage3-fit-ux-repair.html`
- `plans/mockups/2026-08-13-stage3-mismatch-visual-variants.html`
- `plans/mockups/2026-08-13-stage3-matrix-explanation-variants.html`
- `plans/mockups/2026-08-13-stage3-matrix-row-status-variants.html`
- `plans/mockups/2026-08-13-stage3-inline-status-style-variants.html`
- `plans/mockups/2026-08-13-stage3-status-expression-variants.html`
- `plans/evidence/2026-08-13-stage3-mismatch-visual-research.md`

Final prototype question: can the selected matrix make each criterion's current/target relationship immediately visible while keeping the explanation available without returning to paragraph-heavy rails?

Decision criterion:

- at `400px`, a first-time user can identify category/position, overall verdict, both products, current/target/alternative values, and primary action without horizontal overflow;
- the user can select a row and understand why that target applies from one persistent explanation panel;
- zero-alternative and pending states look deliberately complete rather than empty;
- secondary actions are visibly contained and the sticky CTA never includes an unbounded product name.

Disposition: retain the reviewed HTML as planning evidence. Production implementation must rewrite the selected behavior in React with normal tests; it must not promote prototype code directly.

Prototype finding and QA:

- all five planned states render at `400×822` without document, journey, or CTA overflow;
- the comparison state keeps both product cards adjacent;
- the selected four-column matrix keeps all values visible at `400×822` and desktop widths;
- mixed, all-positive, and all-negative states remain distinguishable through tint, a two-pixel rail, and a non-color check/cross beside `Deins`;
- row selection changes only the persistent Auswahl-Panel;
- the panel explains the target and cites bounded profile evidence without duplicating three paragraphs on the default surface;
- the partial-fit state exposes all three distinct choices: keep, choose the viewed alternative, or continue without a product;
- the empty and pending states render deliberate explanatory panels rather than a sparse normal shell.

Evidence-review status: confirmed. Nick selected the matrix, persistent Auswahl-Panel, softened Status-Zeile variant 6, and status-expression variant 4 on 2026-08-13. Earlier rail, pill, whole-row alert, accordion, sheet, and alternative status-expression options are rejected production directions and remain only as prototype history. Production must reimplement the selected behavior in React and must source `targetRationale`, evidence labels, and target relations from the server-owned authority projection. Nick explicitly signed off the reconciled designed journey on 2026-08-13.

## 7. Ordered tasks

### Task 1 — Lock the visual-state contract with red regressions

Add component fixtures for normal and partial matrix comparisons, current-value status marks, Auswahl-Panel switching, owned-fit/no-alternative, pending/no-alternative, no-product/leave-uncovered, no-action, and unsupported analysis.

Add a category/role reasoning matrix across all ten categories. For every known `ideal`, `supportive`, and `mismatch` fixture, require a non-empty structured explanation; require explicit `no_target` where no authority corridor exists and compact criterion evidence for specialist categories. Add a red supportive-action fixture requiring `keep_owned`, exact `select_replacement`, and `leave_uncovered`.

Add browser assertions at `375px`, `400px`, and desktop for visible category/progress, adjacent mobile product cards, fully visible matrix columns, selected-row/Auswahl-Panel behavior, contained CTA, and no required content hidden behind the sticky footer.

In `tests/personal-plan-product-fit-comparison.test.tsx`, explicitly replace the current pending identity-plus-`Auf Analyse warten` sparse-shell assertion and the long `Zweite Alternative trotz Einschränkung übernehmen` exact-copy/ARIA assertions with the reviewed dedicated pending state and short-action labels. Preserve the assertions that the submitted payload carries the exact action kind, selected candidate ID, and fingerprint. Add a mixed row fixture containing `relation: "unknown"` and prove that the overall `n von m im Ziel` count is omitted rather than guessed.

Completion: the new assertions fail on merge commit `d0a4ca8c` for the diagnosed reasons. This task changes tests only; it intentionally updates the presentation contract while leaving mutation behavior untouched.

### Task 2 — Make reasoning and partial-fit actions server-authoritative

Extend both the `comparison` and `compact` branches of the existing, response-only `Stage3FitComparison` with an additive `evidenceRows` field. Do not introduce a second schema version for this non-persisted, atomically deployed payload. Each rich evidence row has this bounded semantic shape:

- stable `rowId` and German `label`;
- `target: { valueLabel, rationale, profileEvidenceLabels } | null`, with at most two bounded, privacy-safe evidence labels;
- `productValues: { productId, valueLabel, relation }[]`, where `relation` is exactly `in_target`, `outside_target`, `unknown`, or `no_target`;
- at most three displayed evidence rows and the existing maximum of three verified alternatives.

The server, not the component, computes every relation from the existing authority facts and category logic. Display-label equality is never used as a fit rule. `unknown` and `no_target` remain distinct: unknown means the required fact is unavailable; no-target means the authority intentionally owns no target corridor for that criterion. The overall verdict continues to come from `Stage3AuthorityEvaluation.verdict`. For `n von m im Ziel`, `m` includes only target-bearing rows; `no_target` rows are excluded, and any target-bearing `unknown` relation suppresses the complete count. The count is never treated as a score.

Extend the server-built fit-comparison projection with structured, transport-safe evidence for:

- headline strengths and limitations;
- owned and selected-alternative observed positions;
- target position and normalized relation when a target exists;
- explicit `no_target`, `unknown`, and specialist compact-criterion cases.

Use fixed deterministic mappings over existing authority facts, refinement context, and criterion IDs. `rationale` explains why the target matters; `profileEvidenceLabels` cite only the bounded profile facts actually used by that authority rule. Do not send prewritten arbitrary prose from product data, derive meaning from display labels, or invoke generated text. Alternative evidence must be recomputed for every candidate in the current bounded verified allowlist so selecting candidate 1/2/3 changes values without changing authority semantics.

Core categories emit the reviewed matrix rows. Specialist categories emit the same structured evidence contract in compact form; when their authority exposes only criterion-level evidence, they must not invent a numeric target or product position. Pending, unknown, unsupported, and no-exact-product inputs emit no fit relation. If structured evidence is absent during an in-flight deploy or rollback, the client renders an honest compact state and retains the existing decision actions; it never synthesizes target relations in the browser.

Normalize supportive verdict action policy across every adapter that can emit that state so a known owned product can be kept or left uncovered, while the selected exact alternative remains authorized exclusively by the current server comparison bundle and fingerprint. Do not add `select_replacement` to category adapter `allowedActions` or weaken mutation revalidation.

Consumes: current category targets, exact product facts, detached candidate evaluations, refinement context, and criterion results.
Produces: an additive typed explanation projection plus the complete partial-fit action set.

Completion: the category/role matrix passes; every emitted status mark traces to a server relation; an already-open client can still consume the retained existing fields; a missing `evidenceRows` field produces the compact fallback; unknown/pending facts produce no fit claim; response-size bounds hold; and gateway/API regressions prove forged or stale alternatives still fail while all three partial-fit decisions persist their existing distinct semantics.

### Task 3 — Build the verdict-first presentation and dedicated sparse states

Refactor `ProductFitComparison` into an exhaustive typed presentation union derived from the existing evaluation/comparison inputs. Cover normal comparison, fit-only, uncovered, pending, unsupported, and no-action states without a generic sparse fallthrough. Keep action kinds and selected candidate payloads unchanged.

Add an explicit unknown-fit presentation for both a `known` evaluation with `verdict: "unknown"` and an exact product whose required facts are unavailable. Its reviewed copy is `Noch nicht eindeutig beurteilbar.` / `Für diesen Vergleich fehlen noch verifizierte Produktdaten.` It renders no fit mark or count and exposes only actions present in the current authoritative bundle.

Render the reviewed German copy and quiet overall verdict. The matrix and selected Auswahl-Panel must make the decisive matching and limiting criteria explicit; the overall `Passt teilweise` label is not the only explanation. Do not render alternative comparison columns when there is no alternative.

Consumes: current `Stage3FitComparison` and `Stage3AuthorityEvaluation`.
Produces: explicit normal, fit-only, uncovered, pending, unsupported, and no-action presentations.

Completion: Task 1 component regressions pass; exact action kind, candidate ID, fingerprint, and transport assertions remain green. Superseded presentation-copy assertions are updated to the reviewed short labels and dedicated-state copy.

### Task 4 — Implement the selected comparison matrix and Auswahl-Panel

Keep the current and selected alternative adjacent at mobile width using compact product cards. Render a four-column matrix for criterion, `Deins`, `Ziel`, and `Alternative`. Use near-white row tints and a two-pixel status rail; place a small outlined check or cross beside the actual `Deins` value. Never rely on color alone.

Make each criterion row keyboard- and pointer-selectable. The persistent Auswahl-Panel below the matrix shows exactly one criterion at a time: `im Ziel` or `außerhalb des Ziels`, why that target suits the user, and the bounded profile facts supporting it. Do not calculate relations or author hair-care reasoning in the UI. When no target exists, show verified values without a check/cross or fit claim. When no alternative exists, remove the alternative column and explain the honest absence of a clearly better verified option.

At mobile width, compact cards render label, image, and fully wrapping name; duplicate per-card recommendation prose is omitted and remains available in the verdict/evidence section.

Consumes: reviewed matrix geometry, structured target relations, target rationales, and bounded evidence labels.
Produces: an accessible compact matrix with current-value status marks and one selectable explanation panel.

Completion: mobile geometry and no-overflow tests pass. Mixed, all-positive, and all-negative fixtures prove every row's current-value mark matches the server relation; selection changes only the Auswahl-Panel; keyboard selection works; unknown/no-target criteria never receive a false mark; and no-alternative copy never fabricates an alternative value.

### Task 5 — Repair action hierarchy and subject navigation

Use short primary labels (`Mein Produkt behalten`, `Diese Alternative wählen`, `Auf Analyse warten`, `Vorerst ohne Produkt fortfahren`). Keep exact identity visible near the action without embedding it in an unbounded button label. Place quiet actions in a contained secondary action area.

Implement the reviewed action matrix. In particular, partial fit with a verified alternative must visibly expose exactly: keep current product, choose the currently viewed alternative, and continue without a product. Assert that the replacement control is present and carries the selected candidate ID/fingerprint; do not treat an alternative card as a recommendation unless that exact candidate is selectable.

On displayed-review-subject change, reset alternative focus, scroll to the top, and focus the new heading. Lift the resolved `nextSubject.decisionKey` from the render-only derivation into a memoized value that the effect can observe; do not key on nullable back-navigation state. Render category/role plus `reviewPosition()` and `deriveStage3DecisionSubjects(draft).length` inside the review component only.

The flow owns the draft-derived calculation and passes explicit `reviewPosition`, `reviewTotal`, `categoryLabel`, and `roleLabel` props to `ProductFitComparison`; the component must not import the module-local `reviewPosition()` helper or receive the whole draft. Move the displayed decision-key derivation above the scroll/focus effect so the effect can legally depend on it.

Consumes: parent-owned current subject and the complete existing review ordering.
Produces: decision-phase-only context/progress and deterministic top-of-review navigation.

Completion: long-name CTA, normal save→next subject-change, and back-navigation regressions pass; no global button behavior changes unexpectedly.

### Task 6 — Verify the complete user journey and durable boundaries

Run focused component/flow tests, the full Personal Plan suite, type/lint/build gates, and the Stage 3 Playwright journey. Perform authenticated visual review on `localhost` at `375x844`, `400x822`, and representative desktop width for every planned state. Do not use a non-hydrating `127.0.0.1` dev rendering as visual evidence.

Confirm candidate switching remains presentation-only, exact candidate/fingerprint persistence is unchanged, recovery states still canonical-load correctly, and final completion still opens Routine directly. The automated Playwright script continues to use its configured hydrated `127.0.0.1` runner; the `localhost` requirement applies only to the separate manual visual review.

Completion: automated checks pass, screenshots match the reviewed evidence, the bounded response contract is backward-safe, and no persistence schema or recommendation rule changed.

## 8. Verification

Automated:

- exhaustive category/role fit-reasoning and action-policy tests;
- production/fixture gateway and Stage 3 API contract tests;
- focused ProductFitComparison component tests;
- focused Stage 3 flow/controller tests;
- Stage 3 Playwright lab journey and dedicated state permutations;
- `npm run test:playwright:personal-plan-stage3` for the actual `*.spec.ts` journey runner;
- `npm run test:personal-plan`;
- `npm run ci:verify`.

Manual/browser:

- mobile `375x844` and `400x822`;
- desktop containment;
- long product names;
- mixed/all-positive/all-negative matrix rows and current-value status marks;
- alternative 1/2/3 navigation;
- partial-fit keep/replace/without action matrix;
- core rich comparison and specialist compact reasoning;
- dimensions with no authoritative target corridor;
- owned fit/no alternative;
- no product/no alternative;
- pending, unsupported, and updated-authority recovery;
- known-but-not-reliably-assessable fit verdict;
- final navigation to Routine.

Migration/live state: none expected. No production mutation or deployment is part of implementation readiness.

Rollback posture: the owner decision is deliberately **not** to add a dedicated fit-review feature flag for this repair. The comparison projection is response-only, the UI and server deploy together, and the change writes only existing action kinds through existing validation. The accepted rollback is therefore a guarded revert and redeploy of this PR. Reverting does not migrate or rewrite Stage 3 drafts, selected products, or Routine data. Do not describe the always-on Stage 3 release gate as a fit-review kill switch.

Evidence-sensitive review:

- compare the implementation against the reviewed HTML prototype and supplied failure screenshots;
- obtain one whole-branch counterpart code review before publication.

## 9. Review and handoff

- Branch/worktree: `codex/personal-plan-stage3-fit-ux-repair-v2` in `.worktrees/personal-plan-stage3-fit-ux-repair-v2`, selectively ported onto fresh `main` at `f0505bd6` after PR #387 landed. No commit, push, deployment, migration, or production activation has occurred.
- Counterpart plan review: final Claude high-effort read-only reconciliation completed on 2026-08-13 with `approve with revisions` and no hard blocker. Accepted findings: use additive `evidenceRows` rather than a second schema version; normalize partial-fit actions across every applicable category adapter; pass explicit review-context props from the flow; pin the actual Playwright script; define the known-but-unassessable state; exclude `no_target` rows from the fit-count denominator; and retain legacy `dimensions` only as a non-authoritative open-client compatibility shim. Earlier accepted findings remain incorporated: decision-phase-only context, full-subject denominator, displayed decision-key effects, one-PR all-category coverage, and honest revert/redeploy rollback. Rejected: widening the shared Stage 3 shell without mockup evidence and claiming an undefined existing kill switch.
- Evidence review: confirmed; all annotations are incorporated in the retained prototype and plan.
- User-journey sign-off: confirmed by Nick on 2026-08-13.
- Rollout risk: this is the all-user Stage 3 presentation path. Keep the reasoning projection response-only and backward-safe; do not alter persistence schemas, candidate eligibility, or mutation revalidation. Roll back by guarded revert/redeploy if the verified journey regresses.
- Implementation verification: full Personal Plan suite `1430/1430`; focused server/API/authority suite `183/183`; full Stage 3 flow tests `45/45`; hydrated Chromium Personal Plan journey `15/15`; TypeScript, lint (zero errors; four unrelated existing warnings), and production build green.
- Counterpart code review: Claude Opus high-effort read-only review completed on 2026-08-13 with no blocker. It verified server-owned reasoning, exact replacement validation, PR #387 inventory/need-revision compatibility, action semantics, and state coverage. The one useful residual regression was added: alternative focus is now proven to reset from index 2 to 0 when the review subject advances. A redundant mouse-only row click was removed; each matrix row now exposes one explicit button for keyboard and pointer selection.
- Artifact disposition:
  - plan: commit with eventual implementation PR;
  - findings: commit as evidence;
  - selected prototype: commit as planning evidence;
  - transient screenshots/reviewer output: discard unless intentionally retained.
