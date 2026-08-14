# Stage 3 product-comparison truth and desktop actions

**Status:** implementation in progress; all-category investigation complete; corrected variant 5 and final evidence approved; designed-user-journey sign-off confirmed

## Outcome

Make every Stage 3 exact-product comparison preserve confirmed catalog facts independently from how well those facts fit the signed target. A supportive value must not be rendered as a hard failure, an unknown result must not be rendered as outside target, and a target mismatch must never turn a complete product fact into `nicht bestätigt`.

On desktop, implement Nick's selected **variant 5, compact decision strip**: contained controls with visible button affordances, never a viewport-wide floating bar over the evidence.

## Source context and evidence

- Reported screenshot from 2026-08-14: Bali Curls Moisturising Conditioner versus Sante Intense Hydration Conditioner.
- Current Stage 3 production code and tests on `origin/main`.
- Read-only production schema and aggregate-safe product-spec queries against Supabase project `pqdkhefxsxkyeqelqegq`.
- Rendered artifact: [five desktop variants](./artifacts/2026-08-14-product-comparison-desktop-variants.html).
- Final all-category artifact: [selected design across categories](./artifacts/2026-08-14-product-comparison-final-all-categories.html).
- Final artifact check: rendered at 1600×1200; Conditioner, Leave-in, Mask, Oil and specialist tabs verified locally.
- Final alignment feedback: status symbols use one right-aligned icon rail per value column; verified across every category tab at 1600×1200 and on the 600 px mobile layout; confirmed by Nick.
- Initial evidence review: **confirmed 2026-08-14**.
- Final all-category evidence review: **confirmed by Nick after status-symbol alignment correction**.
- Selected direction: **variant 5**.
- Conditioner amber display-only rule: **confirmed by Nick**.

## Investigation findings

### Exact reported defect

1. The database values are complete. Bali Curls has base Conditioner balance `stretches_bounces` (canonical `balanced`) and rerank `balance_direction=balanced`; Sante has base `snaps` (canonical `moisture`) and rerank `balance_direction=moisture`.
2. `selectConditionerSpec` searches the multi-row eligibility table for an exact `(hair thickness, target care direction)` tuple. When no tuple matches, it correctly records `targetFit: "known_mismatch"` but also nulls the selected base direction and thickness.
3. The comparison UI reads `proteinMoistureBalance` from that target-selected row and ignores the independently loaded rerank `balanceDirection`. `positionLabel(unknown)` then renders `nicht bestätigt`. The rerank value must also pass through the canonical Conditioner direction parser before comparison; only `moisture | balanced | protein` may reach the rail.
4. Therefore this is not missing catalog data. It is a loader/projection boundary defect: a target-relative eligibility result is being used as though it were the product's display fact.

### Cross-category audit

The same exact nulling mechanism currently exists in the two target-context, multi-row loaders: Shampoo and Conditioner. The wider relation defect reaches all ten Stage 3 categories.

| Category | Catalog shape | Current comparison | Required repair |
| --- | --- | --- | --- |
| Shampoo | Multi-row by product, thickness and shampoo bucket | Visual rails except dandruff; exact-match selection can null complete observations | Preserve unambiguous product observations; keep exact tuple fit separate. |
| Conditioner | Multi-row base eligibility plus single-row rerank | Visual rails; displays target-selected base direction | Display the already-loaded rerank direction; leave base eligibility and target fit unchanged. |
| Leave-in | Product-only single-row specs | Weight, care and repair rails | Keep facts; use the same supportive/fail rules as authority. |
| Mask | Product-only single-row specs | Weight, care and repair rails | Keep facts; reuse category axis pass/caution/fail semantics. |
| Oil | Product spec plus multi-row eligibility | Role, weight and thickness rails | Keep facts; show leave-on weight caution as supportive and role failure as outside. |
| Heat protectant | Product-only single-row spec | Compact criterion evidence | Map pass/caution/fail/unknown faithfully. |
| Scalp care | Product-only single-row spec | Compact criterion evidence | Map pass/caution/fail/unknown faithfully. |
| Dry shampoo | Product-only single-row spec | Compact criterion evidence | Map pass/caution/fail/unknown faithfully. |
| Bondbuilder | Product-only single-row spec | Compact criterion evidence | Map pass/caution/fail/unknown faithfully. |
| Deep-cleansing shampoo | Product-only single-row spec | Compact criterion evidence | Map pass/caution/fail/unknown faithfully. |

Production shape audit:

- Shampoo: 52 products; 4 have multiple complete spec rows. Their cleansing intensity is invariant across rows, while eligibility fields vary.
- Conditioner: 49 products; 7 have multiple complete base rows; 5 vary by base balance direction. Every Conditioner has a non-null rerank direction, and each rerank direction occurs among that product's supported base directions.
- All other category spec tables are product-keyed single-row tables, except Oil eligibility, which is already loaded separately from the product's Oil spec.

Consequences:

- Never select the first contextual row for display.
- Shampoo cleansing intensity may be presented only when all complete rows agree. Supported scalp routes are a display set; evaluator bucket/thickness/scalp selection and exact target fit remain unchanged.
- Conditioner display direction comes from the already-loaded single-row rerank fact. Base rows remain evaluator-owned target eligibility and must not be rewritten for display.
- Shampoo display-only observations may be aggregated from complete contextual rows, but they must live outside evaluator-owned `spec` and outside `factFingerprint`. They never substitute for `targetFit`, activate a thickness gate, or authorize a decision.
- Incomplete, invalid or materially ambiguous product facts remain unknown. The fix must not manufacture certainty.

### Shared relation defect

`Stage3FitEvidenceRelation` currently has only `in_target | outside_target | unknown | no_target`.

- Compact evidence maps only `pass` to `in_target`; `caution`, `fail`, and explicit `unknown` all become `outside_target`.
- Rail evidence uses exact stop overlap, so adjacent weight/repair values and a compatible balanced care direction become red even where category authority calls them supportive.
- This lets the visual matrix contradict the authority verdict across Conditioner, Leave-in, Mask, Oil, and all compact specialist categories.

The missing state is `supportive`.

### Desktop action defect

- The primary CTA becomes `md:absolute`, but no comparison ancestor establishes the intended positioned containing block. It resolves against the document rather than the comparison card, spans far too widely and appears at the wrong page position.
- Lower actions use a ghost variant, so they read like passive text rather than decisions.

## Product and technical decisions

### Decision 1 — Authority facts, comparison observations and fit are distinct

A product fact answers “what is confirmed about this product?” A fit result answers “how does it relate to this signed target?” Neither may overwrite the other.

The repository also needs an explicit third boundary: display-only comparison observations. They may expose a conservative aggregate that the UI needs, but they do not participate in evaluation, replacement identity or persisted decision freshness.

For each displayed value, the comparison projection must produce:

- a value state: confirmed value, genuinely unknown, or targetless;
- a relation state: `in_target`, `supportive`, `outside_target`, `unknown`, or `no_target`.

`nicht bestätigt` is reserved for absent, incomplete, invalid, or materially ambiguous source data—not disagreement with the target.

### Decision 2 — Category authority owns relation semantics

Do not add a second generic exact-equality fit engine to presentation. The rail categories do not currently emit one criterion per axis, so extract their named distance/opposition predicates into pure helpers and call those helpers from both the existing aggregate authority evaluation and the per-axis comparison projection.

Minimum mapping contract:

| Authority result | Comparison relation |
| --- | --- |
| `pass` | `in_target` |
| `caution` | `supportive` |
| `fail` | `outside_target` |
| `unknown` or absent criterion | `unknown` |
| confirmed product fact with no target | `no_target` |

Category-specific examples remain authoritative: adjacent Conditioner/Leave-in weight may be supportive; Leave-in balanced is supportive under its existing aggregate rule; Mask balanced is supportive under its existing `axisResult`; underpowered repair can fail while over-target support can remain supportive; Oil role support is hard while its existing leave-on weight caution maps to supportive.

Conditioner rerank `balanceDirection` is a confirmed display fact that the authority evaluator does not consume. Its comparison relation is therefore an explicit **display-only** rule, never decision authority: equal direction → `in_target`; `balanced` on either side → `supportive`; moisture versus protein → `outside_target`; missing/invalid → `unknown`.

Shampoo and Conditioner also need an explicit `Zielprofil-Eignung` evidence row derived from their existing `targetFit`. This is not a product fact: it surfaces the exact tuple decision that already drives the authority verdict. `matched → in_target`, `known_mismatch → outside_target`, and `unknown → unknown`. It prevents a mismatch header from sitting above apparently all-green property rows.

When `targetFit` is `known_mismatch`, product values remain visible and may still receive relations from existing category rules; the red target-fit row explains the overall mismatch. The invariant is: every overall mismatch has at least one visible outside-target row tied to its actual failure, and no property row claims a relation from a rule that does not exist. Shampoo scalp-route relation is shown only for `matched`; on mismatch its confirmed route set remains value-only/neutral because Shampoo authority short-circuits before an axis relation.

### Decision 3 — No authority-version or fingerprint change for this repair

The implementation must preserve category verdicts, allowed actions, replacement allowlists, exact product IDs, evidence fingerprints used for saves, portfolio output, and Routine compilation. It changes observation selection for presentation and maps already-existing pass/caution/fail/unknown semantics truthfully.

Therefore:

- do **not** bump `CATEGORY_ROLE_POLICIES`;
- do **not** add display-only observations to the hashed `spec` payload;
- keep the raw existing Conditioner `balanceDirection` fingerprint input unchanged and canonicalize only at the comparison boundary;
- put new Shampoo `comparisonObservations` top-level on `Stage3ShampooFacts`, outside both `spec` and the hash input; do not overload the commerce `Stage3AuthorityPresentationFields` bag;
- add tests proving old/new row order and display projection do not change `factFingerprint`.

The current snapshot validator compares the complete authority-version map, so even one bump would make all active Stage 3 snapshots stale. The production gateway also rechecks persisted recommendation fingerprints before completion and replacement clicks. If implementation requires changing a verdict, allowed action, recommendation selection, or persisted fingerprint contract, stop and design explicit active-draft and in-flight-tab recovery before proceeding.

### Decision 4 — Variant 5 desktop actions

- Use a compact contained action strip inside the comparison surface.
- Show whichever action the existing `primaryActionFor` selects as primary. With two buttons, match the signed mockup order: secondary left, primary right.
- Show the next allowed action as a visible bordered secondary button.
- Keep the selected mockup's rarer leave-uncovered action as an underlined, keyboard-focusable text link immediately below the two-button strip.
- Apply variant 5 only at desktop widths. Preserve the existing mobile fixed-bottom primary action and its clearance because mobile was not part of the reviewed artifact; verify it remains contained and non-obscuring.
- Preserve the existing action-priority function. Variant 5 lays out whichever authority actions exist; it does not force “alternative” to be primary when `keep_owned` is currently primary.
- No desktop viewport `absolute`, fixed or sticky positioning. Make the existing clearance responsive (`pb-40 md:pb-0`) so it remains only where the mobile bar needs it.

## Scope and non-goals

### In scope

- Fact-versus-fit projection correction for Shampoo and Conditioner without changing evaluator-owned multi-row semantics.
- Authority-consistent comparison relations for all ten Stage 3 categories.
- The selected desktop action strip and visible affordances for every allowed action.
- Production/fixture parity and focused contract, component and browser regression coverage.
- Read-only pre-release catalog/schema validation.

### Non-goals

- Catalog value changes or data backfills.
- A database migration.
- Bedarfsplan target changes.
- New recommendation rules, new allowed actions, or changes to exact replacement authority.
- Changes to Stage 1, Stage 2, Routine or Anwendung.
- Commit, push, PR, merge, deployment, flags or production writes in this planning pass.

## Target map

| Surface | Responsibility |
| --- | --- |
| `src/lib/personal-plan/products/authority/contracts.ts` | Add Shampoo-only top-level `comparisonObservations`, separate from common commerce fields and evaluator-owned specs. |
| `src/lib/personal-plan/products/authority/catalog-facts.ts` | Keep Conditioner authority facts unchanged; conservatively aggregate only the Shampoo observations a comparison consumes and omit them from fingerprints. |
| `src/lib/personal-plan/products/authority/categories/{conditioner,leave-in,mask,oil}.ts` plus shared helpers | Expose/reuse category-owned axis comparison semantics without changing verdicts. |
| `src/lib/personal-plan/products/fit-comparison.ts` | Add `supportive`, use correct Conditioner direction, and project all category relations from shared semantics. |
| `src/lib/personal-plan/products/fixture-gateway.ts` | Remove its duplicated binary/compact relation behavior or update it through the same shared projection contract. |
| `src/components/personal-plan-products/product-fit-comparison.tsx` | Exhaustively render five relation states in matrix, compact, summary and detail consumers; implement variant 5. |
| Loader, authority, comparison, component and browser tests | Prove all-category truth, parity, containment and unchanged decision authority. |

## Ordered implementation tasks

Implementation begins only after explicit journey sign-off.

### Task 1 — Lock the all-category contract with failing tests

Add table-driven comparison tests across all ten categories before production edits:

- pass → in target;
- caution → supportive;
- fail → outside target;
- unknown/absent → unknown;
- targetless confirmed fact → no target.

Add exact loader regressions for complete nonmatching and multi-row Shampoo/Conditioner products. Assert both the confirmed observation and separate target fit; do not merely assert `known_mismatch`.

**Complete when:** the tests fail for the present nulling/collapse behavior and name the intended distinction precisely.

### Task 2 — Repair display observations without touching authority identity

In the catalog loader:

- leave Conditioner evaluator-owned `spec`, raw `balanceDirection`, `targetFit`, weight, repair and fingerprint construction unchanged; canonicalize `balanceDirection` only inside the comparison projection;
- for Shampoo, parse all contextual rows and aggregate only comparison-consumed observations: invariant cleansing intensity and the supported scalp-route set;
- change `loadCategorySpec` to return `{ spec, comparisonObservations? }`; in `normalizeProductFacts`, compute `factFingerprint` from the unchanged `common + spec` first, then attach observations only to the returned Shampoo facts; type them only on `Stage3ShampooFacts`, never `Stage3AuthorityCommonProductFacts` or `Stage3AuthorityPresentationFields`;
- leave scalar evaluator fields and exact target tuple selection untouched;
- retain unknown for partial rows, invalid vocabularies and material ambiguity, and never select a first row.

Add direct `factFingerprint` assertions for matched, nonmatching, reordered and display-only changed inputs. Existing saved selections and in-flight tabs must continue to validate across this deployment.

**Complete when:** a complete nonmatching product can render its confirmed comparison observation, incomplete/ambiguous observations stay unknown, and authority verdicts/fingerprints are byte-for-byte unchanged.

### Task 3 — Centralize relation projection without changing authority

Add `supportive` to the evidence contract.

- For Leave-in, extract its concrete weight-distance, care-direction and repair predicates into pure helpers and reuse them in aggregate evaluation plus projection; balanced remains supportive.
- For Conditioner weight/repair, extract and reuse the existing distance predicates. Implement the explicitly display-only care-direction rule from Decision 2 without feeding it into evaluation.
- For Mask, reuse its existing per-axis `axisResult` output rather than re-deriving it.
- For Oil, reuse the existing role result and `oil.weight` criterion result.
- For compact specialist rows, map the existing criterion result exactly.
- For Shampoo/Conditioner, build a direct evidence row from each entry's `spec.targetFit` before dimensional rows; change the evidence composition/signature so it receives entries/facts. Allow four rail rows and do not truncate the new row through `.slice(0, 3)`.
- Emit that target-fit row only when the signed category target exists. In reachable owned flows, `targetFit: unknown` already yields the existing unassessable surface; cover unknown relation via alternative/direct projection fixtures rather than inventing an owned rail state.
- For Shampoo, keep cleansing intensity and suitable thickness targetless. Build the confirmed scalp-route row directly from `comparisonObservations` rather than changing the existing categorical dimension to a set. Emit a scalp-route relation only when `targetFit === matched`; otherwise keep that value neutral beside the target-fit failure.
- Pass the current `Stage3AuthorityEvaluation` and candidate assessments/criteria into evidence composition so Mask/Oil relations can reuse their actual emitted axis results for both owned and alternative products.
- Route the fixture gateway through the same relation mapping rather than retaining its duplicate binary cast.
- Keep compact evidence intentionally limited to its first three criterion IDs for glanceability; the all-category fix applies truthful mapping to every displayed compact row and does not expand the compact information density in this task.

Run an explicit before/after oracle over all category authority fixtures: verdict, allowed actions, recommendation product ID/rule, product fingerprint save contract and coverage rule IDs remain unchanged.

**Complete when:** every Shampoo/Conditioner target-fit mismatch has its explicit outside-target row; aggregate verdict copy remains authoritative for other early failures; every property relation comes from an existing category rule or the documented Conditioner display-only rule; and the authority oracle is unchanged.

### Task 4 — Render truthful five-state evidence

Update the comparison UI:

- confirmed + in target: green/check;
- confirmed + supportive: amber marker with visible copy **`Passt mit Einschränkung`**;
- confirmed + outside: red/cross;
- genuinely unknown: neutral `nicht bestätigt`, never red;
- no target: confirmed value without pass/fail judgment.

Keep value text primary and relation styling secondary. Give all five relations distinct German `aria-label` text.

Implement relation rendering and summaries with exhaustive `switch` functions whose default assigns to `never`; widening the union must fail typecheck until every consumer is handled.

Enumerate every relation consumer:

- replace the binary “X von Y im Ziel” summary with separate exact/supportive/outside counts; filter targetless rows first, count known relations even if another targeted row is unknown, and show unknown separately instead of suppressing the summary;
- show supportive rows in their own summary phrase instead of dropping them from both lists;
- choose the default detail row in priority order: outside target, supportive, unknown, then first row;
- give `SelectedEvidencePanel` distinct `Im Ziel`, `Passt mit Einschränkung`, `Außerhalb des Ziels`, `Noch nicht beurteilbar`, and `Kein Zielwert` states;
- render unknown/no-target neutrally rather than allowing `RelationMark` to fall through to a red X;
- update `CompactOwnedEvidence` so supportive is distinct across Heat Protectant, Scalp Care, Dry Shampoo, Bondbuilder and Deep Cleansing;
- update the separate `CompactEvidence` criteria renderer so its caution copy/styling matches the same supportive state;
- update both current and alternative `EvidenceMatrix` mark/style guards so supportive is amber and unknown/no-target stay neutral;
- reset the default selected evidence row when a new comparison replaces the previous rows.

Use one user-facing phrase everywhere: **`Passt mit Einschränkung`**. Replace the current `Passt teilweise` / `mit Einschränkung` variants in the touched comparison surface.

**Complete when:** Bali Curls displays `ausgeglichen` (not `nicht bestätigt`) with the documented supportive display relation, and all five states have semantic component tests.

### Task 5 — Implement variant 5 contained actions

At desktop widths, remove the document-level absolute bar. Preserve `primaryActionFor`; with two buttons render the secondary left and primary right as signed off. Use the existing `funnelCta` primary with width/flex overrides, `outline` secondary, and focusable `link` leave action. Keep `leave_uncovered` as the selected mockup's underlined lower-priority link. The reachable action-state matrix must cover `select_replacement`, `keep_owned`, `acknowledge_override`, `keep_pending`, and `leave_uncovered`; if a reachable state produces more than two non-leave decisions, use a wrapping contained button row rather than hiding one.

When `searchIsPrimary`, “Produkt suchen” occupies the primary/right slot so the uncovered desktop state never loses its sole control. When search is quiet, keep it as the existing separate visible search button outside the strip; do not add a new search control to the reviewed variant.

At mobile widths, retain the current fixed-bottom primary action and `pb-40` clearance; make the desktop clearance `md:pb-0`. Preserve callbacks, disabled/loading states, focus order and exact alternative identity.

**Complete when:** the two main decisions are buttons, leave-uncovered remains the signed lower-priority link, no reachable action disappears, and no action container escapes the comparison at 1024, 1280 or 1440 CSS px.

### Task 6 — Integrated parity, recovery and release verification

- Production and fixture gateways both emit only the shared five-value relation union and use the same compact result-to-relation helper; their intentionally different fixture dimensions/stops need not become identical.
- Exact replacement remains bounded to the server comparison and requires the current candidate fingerprint/planned-product identity.
- Revision conflict, stale source, save retry, keep-owned/override and leave-uncovered behavior remain unchanged.
- A pre-deploy tab can submit its current replacement fingerprint after deployment because this change leaves the fingerprint stable; add an integration assertion for that compatibility boundary.
- Existing completed Routine/Anwendung authority remains unaffected.
- Repeat read-only production shape checks immediately before release; no write accompanies them.

**Complete when:** focused suites, full relevant Stage 3 suites, browser checks, typecheck/lint/build gates and the normal implementation-loop reviews pass.

## Regression matrix

| Risk | Required proof |
| --- | --- |
| Complete fact hidden by target mismatch | Conditioner comparison consumes existing rerank direction; Shampoo display projection preserves conservative observations beside unchanged `known_mismatch`. |
| Arbitrary multi-row value selected | Differing-row fixtures stay set-valued or unknown; row order does not change output/fingerprint. |
| Saved decision invalidated | Direct fingerprint and production-gateway completion/click tests prove display-only changes remain compatible. |
| Supportive rendered as failure | Conditioner, Leave-in, Mask and Oil rail fixtures show `supportive`. |
| Unknown rendered as failure | Compact and rail fixtures show neutral `unknown`. |
| Specialist regression | Heat, Scalp, Dry Shampoo, Bondbuilder and Deep Cleansing pass/caution/fail/unknown mapping tests. |
| Authority behavior changed accidentally | Snapshot/oracle test compares verdicts, actions, recommendations and save identity before/after. |
| Production/fixture relation drift | Both gateways use the shared union/helper without requiring identical fixture dimensions. |
| Exact target-fit failure hidden | Shampoo/Conditioner comparison tests show an explicit target-fit row and no mismatch header/all-green matrix contradiction. |
| Evidence row truncated | Four-row Shampoo/Conditioner fixtures retain target fit plus all existing property rows. |
| Desktop overlay | Browser screenshots and bounding-box assertions at 1024/1280/1440 plus full-page scroll. |
| Mobile controls cover evidence | Mobile viewport, safe-area, long-label and scroll-to-last-row checks. |
| Keyboard/accessibility loss | Native button roles, visible focus, deterministic tab order, icon-independent status text. |
| Variable actions disappear | Component matrix covers every reachable primary/secondary ordering, leave-uncovered link, `keep_pending`, wrapping, and separate search. |

## Verification commands and evidence

Run the directly affected files first with:

```bash
node --import ./tests/server-only-register.cjs --import tsx --test \
  tests/personal-plan/products/stage3-persistence-supabase.test.ts \
  tests/personal-plan/products/stage3-catalog-facts.test.ts \
  tests/personal-plan/products/stage3-authority.test.ts \
  tests/personal-plan/products/stage3-fit-comparison.test.ts \
  tests/personal-plan/products/production-persistence-gateway.test.ts \
  tests/personal-plan-product-fit-comparison.test.tsx
```

This includes updating the existing four-value relation allowlist in `stage3-fit-comparison.test.ts`. Then run:

- `npm run test:personal-plan` for Stage 3 state-machine, exact-replacement, journey-access and nested product suites;
- `npm run test:playwright:personal-plan-stage3` for the responsive browser journey;
- final repository gate: `npm run ci:verify`.

Browser evidence:

- desktop widths 1024, 1280 and 1440 CSS px;
- one representative mobile width to prove the unchanged fixed primary action and clearance still work;
- full comparison scroll, selected-evidence panel, long German labels, loading/disabled/retry states;
- keyboard traversal of every displayed decision.

## Designed user journey

Final all-category evidence review and designed-user-journey sign-off are confirmed.

1. The user enters the one-product-at-a-time Stage 3 review with an owned exact product and, where available, a verified exact alternative.
2. Each comparison row first shows the confirmed product value. A mismatch with the target never changes that value to `nicht bestätigt`.
3. Shampoo and Conditioner also show a separate `Zielprofil-Eignung` row so an exact tuple mismatch is visible without corrupting a product property.
4. Every row separately communicates whether its value/result is in target, supportive, outside target, genuinely unknown, or has no target. Property relations follow their category rule; the separate eligibility row explains an aggregate tuple mismatch.
5. The overall “passt / passt nicht” summary continues to use current authority rules and allowed actions; this repair does not invent new reasons or recommendations.
6. On desktop, variant 5 keeps two main decision buttons within the comparison surface; leave-uncovered is the lower-priority underlined link. Nothing spans the viewport or covers rows while scrolling. Mobile keeps its current fixed primary action.
7. Selecting an action uses the existing exact candidate ID/fingerprint, save, revision-conflict and retry paths. A failed save leaves the current review intact and offers recovery.
8. The flow advances to the next product. After the final review, the existing Stage 3 completion handoff continues to Routine, with Anwendung still derived downstream from the accepted authority.

## Rollout and stop conditions

- No migration or catalog write.
- No authority-version bump and no new feature flag: the existing Personal Plan rollout remains the gate, while fingerprint/verdict compatibility makes this a non-blocking projection repair. If compatibility cannot be proven, stop and revisit both recovery and a kill-switch before release.
- A pre-deploy client may temporarily omit or mis-style a newly returned `supportive` marker during the deployment window; this is no worse than current behavior and cannot change an action or fingerprint. The exhaustive new client fixes it after reload.
- Stop and return to planning if implementation changes a verdict, allowed action, recommendation selection, fact fingerprint compatibility for an existing saved decision/in-flight tab, or requires invalidating an active draft.
- Stop if production rows violate the audited invariants (for example, Conditioner rerank direction outside the accepted parser vocabulary, or Shampoo display facts vary materially where the plan assumes invariance).
- After implementation, use `implementation-loop` with `ready-check` and one whole-branch counterpart review before any publication request.

## Review ledger

| Finding | Source | Resolution | Status |
| --- | --- | --- | --- |
| Conditioner data is complete but hidden by target-row selection | Screenshot, code trace, live read-only query | Separate observation from target fit; display rerank direction | accepted |
| Same nulling class exists in Shampoo | All-category loader audit | Add Shampoo observation/fit split and regression | accepted |
| Caution/unknown collapse affects every category | Comparison projection audit | Add `supportive`; exact result mapping for rails and compact rows | accepted |
| Authority version bump would stale whole snapshots | Snapshot/access audit | Preserve authority outputs; no bump; stop if semantics change | accepted |
| Desktop CTA escapes its surface | Component layout trace | Implement selected contained compact strip | accepted |
| Two main decisions look passive | Screenshot/component trace | Render the two main decisions as visible buttons; retain the selected lower-priority leave link | accepted |
| New observations inside evaluator `spec` would alter fingerprints and activate thickness gates | Claude | Keep Conditioner spec unchanged; put Shampoo comparison observations outside evaluator/hash | accepted |
| Conditioner/Leave-in do not emit per-axis caution results | Claude | Extract their named pure predicates; reuse existing Mask/Oil axis results | accepted |
| Fixture gateway duplicates broken mappings | Claude | Add it to target map and shared relation contract | accepted |
| Relation consumers were incomplete | Claude | Enumerate count, summary, default row, detail eyebrow and RelationMark | accepted |
| Variant 5 must handle variable action lists and obsolete desktop clearance | Claude | Preserve priority; cover all actions/search; keep `pb-40` mobile-only via `md:pb-0` | accepted |
| Narrow repair to Conditioner only | Claude tradeoff | Rejected because Nick explicitly requested the bad behavior be fixed across all categories | rejected |
| First counterpart review verdict | Claude | Fingerprint/data-boundary blockers reconciled before second pass | resolved |
| Exact target-fit fail is invisible in rail mode | Claude second pass | Add explicit Shampoo/Conditioner target-fit row and permit four rail rows | accepted |
| Balanced compatibility was ambiguous | Claude second/fourth passes | Leave-in/Mask use existing supportive rules; Conditioner uses the explicit display-only relation rule | accepted |
| Mask/Oil already expose axis results | Claude second pass | Reuse existing axis/criterion results; extract helpers only for Conditioner/Leave-in | accepted |
| Variant 5 desktop/mobile/action detail had drifted | Claude second pass | Match selected desktop artifact: two buttons plus leave link; retain unchanged mobile bar | accepted |
| Conditioner rerank direction needs canonicalization | Claude third/fourth passes | Canonicalize only at comparison boundary; raw hashed spec stays unchanged | accepted |
| Compact and matrix relation guards were incomplete | Claude third pass | Enumerate CompactOwnedEvidence and both EvidenceMatrix columns; enforce exhaustive switches | accepted |
| Balanced semantics differ by category | Claude third/fourth passes | Leave-in/Mask supportive; Conditioner display-only balanced relation supportive | accepted |
| Shampoo display field lacked a mechanical return channel | Claude third pass | Specify spec/observation bundle, common merge, optional common field and explicit hash omission | accepted |
| Relation semantics under target-fit mismatch | Claude third-pass tradeoff | Keep product values/rules visible; require explicit red target-fit row; Shampoo route stays neutral unless matched | accepted |
| Signed button order and search scope | Claude third-pass tradeoff | Secondary left, primary right; existing search stays outside the strip | accepted |
| Shampoo observation scope | Claude fourth-pass tradeoff | Keep full scope per Nick's explicit all-category request | accepted |
| Shampoo observation ownership | Claude fourth-pass tradeoff | Shampoo-only top-level field attached after hashing; no commerce-bag overload | accepted |
| Variant button styles/search-primary state | Claude fourth-pass tradeoff | `funnelCta`, `outline`, `link`; search takes primary slot when it is the only primary | accepted |
| Terminal counterpart verdict | Claude fourth pass | Hard defects reconciled; optional Shampoo deferral rejected; ready for journey sign-off | resolved |

## Handoff

- Branch/worktree: `codex/product-comparison-debug-mockups` in `.worktrees/product-comparison-debug-mockups`.
- Evidence review: **corrected final all-category variant 5 confirmed**.
- Conditioner amber conditional rule: **confirmed**.
- Status-symbol alignment: **confirmed; one right-aligned icon rail per value column**.
- Designed-user-journey sign-off: **confirmed**.
- Implementation: **complete and locally review-ready**.
- Durable plan and selected HTML mockup: retain with the eventual PR after journey sign-off.
- Transient review output and screenshots: keep outside the repository unless Nick explicitly asks to retain them.

## Implementation receipt

- Conditioner now displays the confirmed, canonicalized rerank `balanceDirection` independently from target-fit authority; Shampoo carries complete comparison observations outside its authority fingerprint and projects multi-route observations as a set.
- Matrix and compact comparison paths preserve `in_target`, `supportive`, `outside_target`, `unknown`, and `no_target` across every category. Shampoo and Conditioner expose the aggregate target-fit result separately from confirmed properties.
- Desktop actions use the signed variant 5 contained layout. Mobile retains its fixed action bar and content clearance. Status symbols share one right-aligned icon rail per value column.
- Focused comparison/persistence tests: **107/107 passed**.
- Full Personal Plan suite: **1,487/1,487 passed**.
- `npm run lint`: **0 errors**; four pre-existing warnings remain outside this scope.
- `npm run build`: **passed**, including TypeScript and 126/126 generated static routes.
- `git diff --check`: **passed**.
- Manual browser verification at 1440x1000 and 390x844 confirmed the contained desktop strip, fixed mobile actions, aligned relation marks, and no horizontal overflow or console errors.
- Whole-tree read-only counterpart review found no hard defects. Its two narrow hardening notes were incorporated: neutral Shampoo routes are counted explicitly and the leave-uncovered link has an accessible label.
- Publication remains unperformed. The worktree base is two commits behind `origin/main`; those commits touch CI and Routine-only files, with no overlap with this implementation. Refresh/rebase belongs to the later publication gate.
