# Personal Plan Stage 3 authority and Stage 4–5 UX rework

## Status, outcome, and stop contract

Implementation authorized on 2026-08-13. This plan incorporates Nick's feedback, the selected Stage 4/5 visual directions, the agreed Stage 3 journey, and the final reviewed product-card/shelf polish.

Outcome:

- Stage 3 first captures every exact product the user says they own/use across the union of current-use categories and the Bedarfsplan's Basis/Optional categories.
- Captured frequencies may change the Bedarfsplan only through an explicit, resumable Stage 3 checkpoint. If nothing materially changes, the checkpoint is skipped. Rejecting a change preserves the prior Bedarfsplan.
- Stage 3 gives every captured product a truthful result. Products without a role in the final Bedarfsplan remain in `Meine Produkte`, never gain an invented alternative, and never become executable Routine items.
- Stage 4 consumes only that final, explicitly reviewed Bedarfsplan. It shows every category once, uses recognizable product imagery, and visually follows the selected Bedarfsplan-first concept.
- The first Routine activates without confirmation. Only later successor changes require review, in one comparison surface.
- Stage 5 uses the selected product-stack day overview, opens the regular Chat from navigation, and compiles one non-repetitive sequence from day transitions and product protocols.

Scope and authority:

- Preserve the five-stage sequence: Bedarf → Verfeinerung → Produkte → Routine → Anwendung.
- Preserve owner scoping, immutable need/portfolio/Routine versions, compare-and-swap revisions, explicit stale/conflict recovery, non-executable pending/unknown products, frozen Stage 4 cadence, and fail-closed Stage 5 compilation.
- All UI copy remains German.
- No category or cadence expansion beyond the already-supported deterministic product-load rules.
- This artifact authorizes local implementation and verification in the task worktree. It does not authorize remote migration execution, runtime-gate activation, production repair/write, commit, push, PR, merge, or deployment.

Non-goals:

- No redesign of Stages 1 or 2.
- No new product category, product-fit authority, catalog policy, calendar, streak, completion tracker, or Stage 5 V2 activation.
- No automatic acceptance or historical rewriting of an unreviewed category.
- No fuzzy copy deduplication and no semantic Routine hash changes solely for product imagery.

Done when:

- Every reported case has an evidence-backed diagnosis, an implementation contract, and red-capable verification.
- The selected Stage 4 A and Stage 5 3 mockups, plus the Stage 3 authority checkpoint/product-disposition mockup, are retained as planning evidence.
- The database transition, resume/retry semantics, legacy behavior, rollout/rollback path, error states, and responsive journeys are explicit.
- One read-only Claude plan review at `high` is reconciled in this file.
- Nick reviews the final evidence and explicitly signs off the complete Stage 3→4→5 journey before implementation starts.

## Approved product direction

Nick has approved the journey in which Stage 3:

1. asks for every owned/used product and frequency in the union of:
   - categories reported as currently used; and
   - Basis/Optional categories rendered in the accepted Bedarfsplan;
2. recomputes only the supported product-load-dependent need effects after inventory capture;
3. skips ahead invisibly when the Bedarfsplan is unchanged;
4. pauses on an explicit Bedarfsplan checkpoint when category, tier, role, or cadence materially changes;
5. accepts or rejects that exact fingerprinted proposal before product-fit review; and
6. reviews every captured product, including an honest `not_used` result for products outside the final plan.

Nick also selected:

- **Stage 4 A — Bedarfsplan 1:1:** one category card per final Bedarfsplan category, real product imagery, compact role/purpose detail inside the card.
- **Stage 5 3 — Produktstapel:** day tiles lead with the number/type of products, stable day label, one compact fact, restrained category accents, and explicit partial/unavailable status.

There is no remaining supplemental-category policy decision: **Stage 4 never introduces or asks the user to accept a category. Stage 3 is the sole authority checkpoint.**

## Reported-case ledger

| ID | Stage | Reported symptom | Diagnosis / chosen treatment |
| --- | --- | --- | --- |
| S3-01 | 3 | A category can appear only after the Bedarfsplan. | Current product-load overlay appends Deep Cleansing/Scalp Care after capture. Replace the hidden overlay with the explicit Stage 3 need-revision checkpoint. |
| S3-02 | 3 | Stage 3 should ask about all products the user uses plus Basis/Optional categories. | The entry adapter already builds this union. Preserve it and add coverage tests. |
| S3-03 | 3 | Products outside the final Bedarfsplan can escape product review. | Current subjects come only from role assignments/gaps. Add one inventory-only disposition for every unassigned captured product. |
| S4-01 | 4 | First Routine asks for confirmation. | Preserve direct initial activation and normalize the narrow legacy pending-initial shape. |
| S4-02 | 4 | Confirmation appears in hero and slide-up sheet. | Later changes use one comparison sheet; overview only opens it and never duplicates the accept action. |
| S4-03 | 4 | Oil/category mismatch and duplicated category cards. | The inspected journey did contain one Oil Bedarfsplan category with two roles; Stage 4 rendered two cards. Group roles inside one category card and enforce exact final Bedarfsplan category/order equality. |
| S4-04 | 4 | No images. | Catalog images exist, but the Routine semantic payload/read DTO omits them. Add bounded presentation-only hydration. |
| S4-05 | 4 | Routine page/cards are visually unacceptable. | Implement only selected concept A and its responsive/loading/gap states. |
| S5-01 | 5 | Day overview is copy-heavy. | Implement only selected concept 3 without calendar/tracking semantics. |
| S5-02 | 5 | Chat destination is inaccessible. | `/chat` already renders the regular Chat; reproduce and remove duplicate viewport/bottom-nav ownership. |
| S5-03 | 5 | Wetting/towel-drying and similar actions repeat. | Compiler transitions and product protocols both own the same physical state change. Add semantic action ownership. |
| S5-04 | 5 | Generic and product copy contains inconsistencies/duplicates. | Audit complete rendered sequences by day/protocol, not isolated strings. |

## Current-source findings

### Stage 3 inventory is broad enough, but authority is not

- `stage3OrderedCategories` already returns refined `renderedOrder` plus current-use-only categories in canonical category order.
- Stage 2 already records current product categories and oil purposes in the refined snapshot.
- The original needs calculation intentionally does not use product-load frequency: `hasProductLoadSignal = false`, and scalp buildup source facts are empty.
- Stage 3 currently recomputes only Deep Cleansing and Scalp Care through `product-load-resolution.ts`.
- `applyProductLoadResolution` appends a supplemental category, marks its capture complete, creates uncovered roles, and moves toward decisions. The user never reviews a changed Bedarfsplan or captures a product for the new category.
- `deriveStage3DecisionSubjects` covers role assignments and uncovered roles only. A captured product with no final role receives no result.
- The newly merged fit-comparison UI is role-based and should be extended, not replaced.
- Product price already exists as catalog commerce data (`price_eur`, `currency`, and freshness metadata), and the Stage 3 authority query already reads `price_eur`; the public comparison presentation currently strips it. Packaging size is not a structured catalog field and must not be inferred from product names or URLs at render time.
- Portfolio schema v3 already supports retained owned products for replacement decisions; Routine intentionally ignores them. Inventory-only dispositions require an explicit new portfolio contract rather than overloading executable items.

### Stage 3 persistence seam

- `personal_plan_need_versions` is immutable. Refined siblings share the same initial parent and are idempotently keyed by input hash.
- `personal_plans.current_refined_need_version_id` is the current authority pointer.
- Product drafts are mutable and owner-scoped, but their `pass` constraint currently allows only `product_capture`, `product_decisions`, and `ready_for_routine`.
- `personal_plan_complete_refinement_draft` changes the current refined pointer, stales other active product drafts, increments plan revision, and enqueues a `refined_need` Routine source event.
- The Stage 3 save RPC is CAS-protected but cannot atomically change the refined pointer and rebase the same draft. A dedicated service-only transaction is required.
- Refined need events are intentionally terminal while Stage 3 is pending and settle when a Routine compiled from that refined version is activated. The new accepted Stage 3 revision must preserve this source-event lifecycle.

### Stage 4 and Stage 5

- A read-only production inspection previously found three legacy plans with pending/no-active first proposals; all matched base-null first-proposal shape.
- An initial-aware completion RPC already activates the first Routine and delegates to immutable successor proposals when an active Routine exists. The route only selects it when `PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL=true`; that gate is default-off, so the default production code path still creates the unwanted first confirmation.
- Stage 4 currently renders per Routine role item, which expands one category into multiple cards.
- Product images are present in Stage 3/catalog data but absent from the Routine semantic payload/read view.
- Latest `origin/main` (`ef0ecfb8`, production closure PR #386) now suppresses the observed dry→wet transition when the ordinary Shampoo block contains its canonical `wet` section, and adds a regression proving one visible wetting instruction while retaining the fallback for exact workflows that omit preparation. This closes the reported wetting duplicate in current source. The implementation is deliberately narrow (`stepKey === "wet"` plus `action === "section"`), so the remaining full-sequence audit still covers towel-drying, rinsing, generic `Danach`, heat preparation, repeated purpose copy, and unresolved/fallback states rather than assuming every duplicate class is solved.
- `/chat` already routes to the regular `ChatContainer`; shell, container, and input each reserve viewport/bottom navigation space.

## Implementation contracts

### 1. Stage 3 need-authority checkpoint

Add `need_revision_review` between `product_capture` and `product_decisions` in the TypeScript contract, database check constraint, loader, UI phase mapping, analytics, and resume logic.

Add a draft-owned, versioned envelope (final names may follow local conventions):

```ts
type Stage3InventoryAuthorityV1 = {
  schemaVersion: 1
  stage2RefinedNeedVersionId: string
  inventorySnapshotFingerprint: string
  status: "not_needed" | "pending" | "accepted" | "rejected"
  proposalFingerprint: string | null
  proposedInputHash: string | null
  proposedOutputSnapshot: InitialNeedPlanSnapshot | null
  materialDelta: Stage3NeedMaterialDelta[]
  resolvedFingerprint: string | null
}
```

Rules:

- The server derives `inventorySnapshotFingerprint` from stable product identity, category, frequency, relevant role/purpose, source refined input hash, and computation version. The client never authors it. This deliberately replaces/extends the narrower existing `capturedFrequencyFingerprint` helper/field in the legacy product-load overlay; the two must not coexist under the same meaning.
- The proposal builder starts from the Stage 2 refined snapshot and applies only the existing supported product-load rules. It emits a complete valid refined snapshot, not a Stage 4 overlay.
- A material comparator covers rendered category membership/order, need tier, required roles, cadence/frequency, and execution status. Copy-only/reason-order changes do not trigger the checkpoint.
- With no material delta: persist `not_needed`, remove any legacy overlay, and enter `product_decisions` without showing a screen.
- With a material delta: persist `pending`, enter `need_revision_review`, and render the exact delta/reasons. No fit bundle is loaded yet.
- `accept` and `reject` are semantic PATCH operations guarded by expected draft revision and expected proposal fingerprint.
- Reopening/editing inventory clears the resolved fingerprint and all authority-dependent decisions, recomputes the proposal, and reopens the checkpoint only when the new fingerprint materially differs.

Atomic accept/reject RPC:

- Create one additive service-role-only `SECURITY DEFINER` RPC with explicit `REVOKE`/`GRANT`, fixed `search_path`, owner/plan checks, bounded JSON inputs, and no browser access.
- Lock the owner plan and draft; verify active status, expected revision, current refined source, pending fingerprint, original Stage 2 refined lineage, and current initial parent.
- On accept, insert/reuse the immutable refined sibling, validate its lineage and hash, update the plan's current refined pointer, increment plan revision, enqueue the `refined_need` source event, and atomically rebase the same active product draft to the accepted version.
- Rebuild the draft's authority snapshot, ordered categories, requirements/authority versions, cursor, and payload from the accepted snapshot; remove `productLoadResolution`; preserve captured products; clear decisions whose evidence references the old refined version.
- Mark only other conflicting active drafts stale. Never mutate historical need, portfolio, or Routine versions.
- On reject, leave the current refined pointer unchanged, store the rejected fingerprint, remove the legacy overlay, and enter product decisions against the unchanged authority.
- Return canonical draft + outcome. Unknown-response retry first reloads canonical state and treats a matching accepted/rejected fingerprint as success; mismatched state is a conflict.

### 2. Every captured product receives a result

Keep the existing role-fit comparison for final Bedarfsplan roles and add a separate inventory disposition contract:

```ts
type Stage3InventoryDispositionV1 = {
  schemaVersion: 1
  dispositionKey: string
  capturedProductId: string
  category: PersonalPlanCategory
  planStatus: "not_used"
  reason: "category_not_in_final_plan" | "not_assigned_to_final_role"
  acknowledged: boolean
  authorityFingerprint: string
}
```

Rules:

- Each captured product is covered exactly once at product level: either it participates in one or more role-fit subjects, or it gets one inventory-only disposition.
- Within each final Bedarfsplan category, role-fit subjects appear first in role order, followed by extra unassigned products in capture order. Current-use-only categories follow the final Bedarfsplan categories in the existing canonical inventory order.
- Inventory-only UI states: product image/identity, `Nicht Teil deiner Routine`, short reason, and `Bleibt unter „Meine Produkte“ gespeichert`.
- It offers only acknowledgement/continue. It never searches for an alternative, assigns a role, creates a planned purchase, or makes the product executable.
- Catalog-owned products project into retained presentation data. Pending/manual identities remain pending presentation data with `role: null`. Both stay in `user_products`; neither enters `ownedProducts` consumed by Routine.
- Add portfolio schema v4 for explicit inventory dispositions/retained presentation. This is intentionally a new frozen schema because `not_used` inventory is a new completion authority contract, not merely an optional rendering field. Do not reinterpret frozen v1–v3 snapshots.
- Completion blocks until every role subject and inventory disposition is current and resolved against the final refined fingerprint.

Comparison-card presentation metadata remains outside fit authority:

- Add structured net-content fields to the catalog/intake contract (numeric value plus constrained unit, rendered as one compact label such as `300 ml`). Do not parse the package size from a name or retailer URL in the application.
- Expose current catalog price/currency and structured package size through the Stage 3 comparison presentation DTO for both the owned product and each alternative. Neither field participates in fit scoring, recommendation ordering, authority fingerprints, or the saved keep/replace decision.
- Render available size and price as two compact facts. Missing or stale commerce data is omitted rather than guessed; price freshness follows the existing verified commerce contract.
- Alternative navigation is presentation-only. Changing the focused alternative atomically updates image, identity, size, price, CTA, counter, outcome preview, and every purple comparison marker. Only the explicit keep/replace CTA persists a decision.

### 3. Legacy and rollout behavior

Database rollout is additive first: extend every effective pass guard, add the RPC, and preserve existing rows. Application rollout follows behind one Stage 3 server-side start gate.

Use a temporary default-off gate named `PERSONAL_PLAN_STAGE3_INVENTORY_AUTHORITY_V2` (or the nearest repository-conventional name). It controls only whether an unmarked draft starts the new checkpoint; it never hides a draft that already carries the v2 authority envelope. The separate Stage 4 auto-activation gate is removed in Slice C because first activation becomes canonical behavior, not an experiment.

The pass change has five evidence sites, not one: TypeScript `STAGE3_PASS_VALUES`; the table `CHECK`; the original save-RPC guard; and the two later historical `personal_plan_stage3_current_refined_source_guard` definitions. Do not edit migration history. The new additive migration must drop/recreate the table constraint and `CREATE OR REPLACE` the effective save RPC with the four values, then tests must prove both database guards and the TypeScript parser accept `need_revision_review`. Use one new unique migration version; do not repeat the repository's two near-identical historical guard migrations.

- Gate off: do not create a new hidden overlay. Conservatively keep the Stage 2 Bedarfsplan authority and retain unassigned inventory outside Routine.
- Gate on: new/active capture drafts use the explicit checkpoint.
- A draft already marked with the new authority envelope always resumes the new path even if the start gate is later disabled, so rollback cannot strand it.
- Active legacy `product_capture` drafts transition normally after capture.
- Active legacy `product_decisions` drafts with a material `productLoadResolution` are CAS-repaired to `need_revision_review`, preserve captures/roles, remove the overlay, and clear old authority decisions. Drafts without a material overlay continue normally.
- Completed historical snapshots remain immutable. Stage 4/5 load-time validation compares Routine categories with the source refined Bedarfsplan. An unreviewed legacy supplement fails closed and routes to an idempotent Stage 3 authority-repair continuation seeded from the frozen captured inventory; it is never auto-accepted. Resolving and completing that continuation creates a normal successor proposal because an active Routine already exists.
- Read-only production preflight counts active legacy overlays and completed current Routine mismatches before release. If any row cannot satisfy owner/plan/version/fingerprint invariants, activation stops for investigation.
- After v2 is fully released, all active legacy overlays are resolved, and monitoring shows no rollback need, use a separate cleanup PR to remove the old overlay-producing transition and the temporary start gate. Keep only backward parsers/read guards required for immutable historical snapshots. Cleanup is not implied by activation.

### 4. Stage 4 authority, lifecycle, and presentation

- Make the existing initial-aware RPC the canonical completion call: remove the route-level `PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL` branch and always call `personal_plan_complete_draft_activate_initial_v1`. That RPC already delegates to the successor lifecycle when an active Routine exists. Remove the now-obsolete default-off gate and its release tests/config after the new path is verified. No first-open confirmation CTA/sheet is rendered.
- Normalize only the exact legacy initial shape: no active Routine, pending proposal is pending, base is null, candidate matches user/plan, and source links are valid. Migration is idempotent and production execution remains separately authorized.
- Later successor proposals never auto-open on routine entry. Overview shows `Änderungen verfügbar` → `Änderungen prüfen`; only the comparison sheet can accept/reject.
- Stage 4 primary category keys and order must equal the final refined `renderedOrder` exactly and be unique. Multiple Routine role items are grouped inside one category view model/card.
- Any source mismatch is a blocking authority-repair state, not a hidden card or silently executable item.
- Add a presentation-only hydration layer in `loadPersonalPlanRoutineView`: collect catalog IDs, perform one bounded owner-safe read, and attach current image/name facts outside the semantic payload/hash.
- Image fallback is a small category illustration/neutral product placeholder. Pending or missing identity remains explicit and non-executable.
- Implement only selected concept A across desktop/mobile, loading, complete, missing-product, pending, optional/later, multi-role, later-change, stale, and unavailable states.

### 5. Stage 5 day overview, Chat, and instruction ownership

- Extend the application view adapter with deterministic day visual identity and product thumbnail/placeholder summaries. Do not put dates, completion, tracking, or streak semantics into the model.
- Implement only selected concept 3 as a virtual product shelf. Exact products stand on the shelf with their catalog images; planned purchases remain visibly provisional; an unresolved detail uses an honest empty slot rather than a fake bottle. Tiles keep the stable day label, one compact product/step or cadence fact, and explicit partial/unavailable status.
- Keep `/chat` as regular Chat. At 390×844, exactly one shell layer owns bottom-nav/viewport clearance; message history, composer, keyboard, loading, empty, offline/error, and long-conversation states remain reachable.
- Add stable semantic metadata to productless transitions and product protocols, such as required state, achieved state, and `physicalActionKind`. Do not reuse the existing application-view `actionKey`, which is a rendered per-step identity. Exact/family product protocol owns a physical action when its retained executable step achieves the required state; the outer compiler inserts only missing transitions.
- Never deduplicate by fuzzy German text. Preserve quantities, placement, timing, rinse/no-rinse, heat, contraindication, and other safety/authority detail.
- Audit complete compiled journeys for wetting, squeezing/towel-drying, rinsing, generic `Danach`, heat preparation, styling, repeated purpose copy, pending/unresolved states, and fallback text across every supported day type.

## Target map

| Concern | Primary targets | Produces |
| --- | --- | --- |
| Stage 3 contracts/order | `src/lib/personal-plan/products/contracts.ts`, `state-machine.ts`, `stage2-entry-adapter.ts`, new need-revision module | New pass/envelope/disposition, deterministic material delta and subject order. |
| Product-load authority | `product-load-resolution.ts`, `needs.ts` only where shared facts are appropriate | Complete fingerprinted proposed refined snapshot; no Stage 4 overlay. |
| Stage 3 API/gateway | `gateway.ts`, `http-gateway.ts`, `production-persistence-gateway.ts`, Stage 3 route | Semantic accept/reject, canonical recovery, fit loading only after checkpoint. |
| Stage 3 persistence | `stage3-persistence-supabase.ts`, additive migration/RPC | Atomic refined-pointer + same-draft rebase, rejection, idempotency, security grants. |
| Stage 3 UI | `stage3-products-flow.tsx`, new checkpoint/disposition components, recovery/controller/analytics | Resumable checkpoint and every-product coverage. |
| Portfolio | `portfolio.ts`, portfolio contracts/parser/presentation API | Schema v4 with retained/non-executable inventory presentation. |
| Initial/later Routine lifecycle | Stage 3 complete/stager, Routine client/page/sheet, additive legacy migration | No initial confirmation; one later comparison surface. |
| Stage 4 projection/images | Routine compiler/view/repository and `src/components/routine/personal-plan/**` | Exact category grouping + presentation-only images + selected concept A. |
| Stage 5 overview | application view adapter/overview/day card | Selected product-stack model and responsive UI. |
| Chat shell | authenticated shell, chat container/input, `/chat` tests | One viewport owner and reachable regular Chat. |
| Stage 5 sequence | application compilers, shared templates, protocol adapter/contracts, application renderers | Semantic action ownership and revised full-journey German copy. |

## Ordered implementation and PR slices

Do not use one mega-PR. Use four reviewable slices. Slice A is independent and may ship first after implementation authorization. Slices C/D may be developed after their red tests, but their cross-stage activation depends on Slice B so the hidden-category path can never remain live underneath the new presentation.

### Slice A — regular Chat viewport

1. Reproduce authenticated `/anwendung` → `/chat` at 390×844, including keyboard and long history.
2. Write the red viewport/composer test, then make exactly one shell layer own bottom-navigation clearance. Preserve the regular Chat route and all non-Personal-Plan layouts.
3. Verify mobile empty/history/loading/offline/error/keyboard states. This slice has no Stage 3/database dependency and should be a small standalone PR.

### Slice B — Stage 3 authority and portfolio v4

4. **Write red authority/coverage tests.** Cover category union, material/no-op proposal, accept/reject, stale fingerprint, unknown-response recovery, inventory edit reopening, every-product coverage, no alternative/executable item for inventory-only products, and completion blocking.
5. **Add the additive database contract.** Generate one uniquely versioned migration with the repo Supabase workflow; replace the effective table/RPC pass guards; add the service-only atomic resolver; test owner isolation, CAS, idempotency, lineage, payload bounds, grants, and partial-write absence. Run local migration validation/advisors; do not execute remotely without a separate gate.
6. **Implement deterministic proposal + state machine.** Replace hidden overlay promotion with the complete proposed refined snapshot and explicit pass. Preserve the supported Deep Cleansing/Scalp Care rules and stable material comparison.
7. **Wire production gateway/API/recovery.** Server-authored fingerprints/snapshots only; no fit bundles before resolution; canonical replay after lost accept/reject responses.
8. **Implement the Stage 3 checkpoint and inventory-only result.** Match retained desktop/mobile evidence, including sticky-action scroll and accessibility. Extend the existing fit comparison; do not replace it.
9. **Add portfolio v4 and legacy repair.** Project retained/pending non-executable inventory, repair active overlay drafts, detect completed cross-stage mismatches, create the authority-repair continuation, and prove immutable history is unchanged and nothing is auto-accepted.
10. Verify Stage 3 no-op/accept/reject/resume/conflict/legacy paths in fixture and authenticated rendered journeys. Review this slice before Stage 4/5 activation.

### Slice C — Stage 4 lifecycle and selected Routine UI

11. Write red lifecycle tests, then make the initial-aware RPC canonical and remove the default-off auto-activation gate. Add the narrow idempotent legacy pending-initial migration and successor-only confirmation assertions.
12. Write red category/view tests for exact final `renderedOrder`, uniqueness, multi-role grouping, fail-closed mismatch, one bounded owner-safe presentation image read, and fallback identity.
13. Implement the category-grouped view model and presentation hydration independently of React styling.
14. Implement selected concept A across desktop/mobile complete, gap, pending, optional/later, multi-role, later-change, conflict, loading, and authority-repair states. Keep one later comparison sheet.
15. Verify the full first-Routine and successor journeys, migration repeatability/security, accessibility, and overflow in a dedicated PR.

### Slice D — Stage 5 overview, sequence copy, and action ownership

16. Preserve the shipped ordinary/exact wetting regression from PR #386, then write red compiled-sequence tests for the remaining towel-drying, rinse, heat-preparation, and other modeled physical actions. The regressions must exercise the real shared Shampoo/Leave-in templates, not only helper-authored protocols.
17. Implement `physicalActionKind`/required/achieved-state ownership only for reproduced residual collisions; retain the shipped narrow wetting behavior until the semantic replacement is proven equivalent. Preserve all product-specific amount, placement, timing, rinse, heat, and safety detail.
18. Extend the view adapter and implement selected product-stack concept 3 across complete, partial, unavailable, and selected-day states.
19. Audit/revise German copy in complete rendered Waschtag, Auffrisch-Tag, treatment/reset, heat, missing-product, pending, and fallback journeys. Treat CTA strings in this plan as target copy, not claims about current source.
20. Verify desktop/mobile overview→sequence→back and no duplicated physical action, then run this slice through a dedicated PR review.

### Integrated readiness

21. On all approved slice heads together, run migration/security checks, focused/full tests, typecheck/lint/build, authenticated desktop/mobile Stage 3→4→5→Chat journeys, accessibility/overflow, and the repository review router. Publication, remote migration, runtime-gate activation, and production repair remain separate authorizations.

## Designed user journey

### Stage 3: inventory → final Bedarfsplan → products

1. Stage 3 opens with the category union already derived from Stage 2. The user can correct product kinds, then adds every exact product and frequency per category; multiple products are allowed where category policy allows it.
2. Finishing inventory saves one canonical fingerprint.
3. If product load changes nothing material, the system moves directly to product review without a confirmation screen.
4. If it changes the Bedarfsplan, the checkpoint says what changed, why it became knowable only now, and the exact tier/cadence. `Ergänzung übernehmen` accepts; `Bedarfsplan beibehalten` rejects.
5. A save conflict reloads the latest proposal; an unknown response first checks whether that exact fingerprint already resolved. The user never double-accepts or loses captured products.
6. Product review covers final roles with the existing comparison. Any extra/current-only product gets the retained result: `Nicht Teil deiner Routine` and `Bleibt unter „Meine Produkte“ gespeichert`.
7. Only after every role and product is resolved can Stage 3 create the portfolio/Routine handoff.

### Stage 4: first Routine and later changes

1. The first Routine is already active on `/routine`; no confirmation framing appears.
2. Basis, Optional, and Later sections mirror the final reviewed Bedarfsplan. Every category appears once. Real image/product identity leads; cadence and multiple purposes are compact details.
3. Missing/pending products remain visibly non-executable. A legacy authority mismatch blocks and returns to the Stage 3 correction checkpoint.
4. A later source/edit creates a successor while the current Routine stays active. `Änderungen prüfen` opens one `Vorher → Nachher` comparison sheet. Accept replaces; reject preserves; stale/conflict reloads current truth.

### Stage 5 and Chat

1. `/anwendung` shows product-stack day tiles with stable labels and honest partial/unavailable status.
2. Selecting a day opens one ordered application sequence. Each physical transition appears once; product-specific amount, placement, timing, rinse, and safety detail remains.
3. Back returns to the day chooser with context preserved.
4. `Chat` opens the regular conversation with history, messages, composer, keyboard, and bottom navigation all reachable.

Critical recovery states:

- stale Stage 2/refined source → reload current authority before any further save;
- rejected proposal → unchanged Bedarfsplan + product review;
- edited inventory after resolution → new fingerprint/checkpoint if material;
- pending/manual product → retained/pending, never executable;
- legacy unreviewed Routine supplement → fail closed + authority correction, never silent acceptance;
- missing image → neutral presentation fallback only;
- unavailable Stage 5 day → exact missing dependency, no fake complete flow;
- offline/unknown mutation → canonical status check before retry.

User-journey sign-off: **confirmed by Nick on 2026-08-13 after reviewing the final interactive Stage 3→5 mockup and requesting implementation.**

## Planning evidence

- Stage 3 authority checkpoint/product disposition source: [`artifacts/personal-plan-stage4-stage5-ux/stage3-inventory-authority-checkpoint.html`](artifacts/personal-plan-stage4-stage5-ux/stage3-inventory-authority-checkpoint.html)
- Stage 3 desktop: [`artifacts/personal-plan-stage4-stage5-ux/stage3-inventory-authority-checkpoint-desktop.png`](artifacts/personal-plan-stage4-stage5-ux/stage3-inventory-authority-checkpoint-desktop.png)
- Stage 3 mobile checkpoint: [`artifacts/personal-plan-stage4-stage5-ux/stage3-need-revision-mobile.png`](artifacts/personal-plan-stage4-stage5-ux/stage3-need-revision-mobile.png)
- Stage 3 mobile inventory-only result: [`artifacts/personal-plan-stage4-stage5-ux/stage3-inventory-only-mobile.png`](artifacts/personal-plan-stage4-stage5-ux/stage3-inventory-only-mobile.png)
- Stage 4 five concepts: [`artifacts/personal-plan-stage4-stage5-ux/stage4-routine-concepts.html`](artifacts/personal-plan-stage4-stage5-ux/stage4-routine-concepts.html)
- Selected Stage 4 A: [`stage4-recommended-desktop.png`](artifacts/personal-plan-stage4-stage5-ux/stage4-recommended-desktop.png), [`stage4-recommended-mobile.png`](artifacts/personal-plan-stage4-stage5-ux/stage4-recommended-mobile.png)
- Stage 5 five concepts: [`artifacts/personal-plan-stage4-stage5-ux/stage5-day-overview-concepts.html`](artifacts/personal-plan-stage4-stage5-ux/stage5-day-overview-concepts.html)
- Selected Stage 5 3: [`stage5-selected-product-stack-desktop.png`](artifacts/personal-plan-stage4-stage5-ux/stage5-selected-product-stack-desktop.png), [`stage5-selected-product-stack-mobile.png`](artifacts/personal-plan-stage4-stage5-ux/stage5-selected-product-stack-mobile.png)
- Updated selected Stage 3→4→5 states after the production product-fit release: [`artifacts/personal-plan-stage4-stage5-ux/updated-selected-mockups.html`](artifacts/personal-plan-stage4-stage5-ux/updated-selected-mockups.html), with [desktop](artifacts/personal-plan-stage4-stage5-ux/updated-selected-mockups-desktop.png) and [mobile](artifacts/personal-plan-stage4-stage5-ux/updated-selected-mockups-mobile.png) captures. This evidence distinguishes `Aktiv`, `Noch kaufen` / `Vorläufig`, and `Nicht verwendet` while preserving Stage 4 A and Stage 5 3.
- Stage 3 alternative-switch evidence: [Bali Curls focused](artifacts/personal-plan-stage4-stage5-ux/updated-stage3-product-fit.png) and [Garnier focused](artifacts/personal-plan-stage4-stage5-ux/updated-stage3-product-fit-alternative-2.png). The focused identity, image, size, verified price, counter, CTA, downstream preview, and both purple rail markers move as one local presentation state; navigation alone does not persist a product decision.
- Selected Stage 5 shelf evidence: [virtual day shelf](artifacts/personal-plan-stage4-stage5-ux/updated-stage5-product-stack.png), with catalog product images for known products and an honest open slot for unresolved details.
- Feedback incorporated: Stage 4 A accepted; Stage 5 3 accepted; Stage 3 inventory/authority/product-coverage journey accepted in principle. The 2026-08-13 polish pass reduced repeated explanatory copy, enlarged the real Stage 5 product thumbnails, replaced fake product stand-ins with honest open-detail placeholders, established the virtual-shelf direction, and added synchronized price/size alternative switching to the Stage 3 prototype.
- Prototype verification on 2026-08-13: desktop and 390 px mobile had zero horizontal overflow and zero failed product images; next/back returned the complete Stage 3 focus state exactly. Example pack sizes and prices were checked against current product pages. Production must still enforce catalog freshness and omit stale or missing price rather than silently showing an outdated snapshot.
- Evidence still requiring final review in this pass: the rendered Stage 3 checkpoint, inventory-only result, and updated cross-stage product-status states above.

## Verification

Automated red-capable assertions:

- union = current-use categories ∪ final Basis/Optional categories, with stable order;
- hidden `productLoadResolution` cannot add an executable/visible Routine category;
- no-op proposal skips UI; material proposal pauses; accept/reject are fingerprinted and idempotent;
- accept atomically changes current refined pointer + same draft; rejection changes neither pointer nor immutable need versions;
- stale/foreign/oversized/mismatched RPC inputs fail without partial writes;
- every captured product has role coverage or one inventory disposition;
- alternative focus updates every presentation field and comparison marker together without saving intent; price/size never affect authority fingerprints or recommendation order;
- retained/pending inventory never enters Routine-owned products or Stage 5 executable blocks;
- completed historical versions remain byte-for-byte unchanged;
- first Routine active/no pending/no confirmation; only successor has one resolution surface;
- Stage 4 category keys/order equal final `renderedOrder` and are unique;
- one bounded owner-safe presentation image query with missing/inactive fallbacks;
- every compiled day has one semantic owner for wetting, towel-drying, rinse, and other modeled state transitions;
- regular Chat composer stays within visual viewport above bottom navigation.

Focused baseline and implementation verification use guarded Node tests:

```sh
node --import ./tests/server-only-register.cjs --import tsx --test <focused Stage 3/4/5/chat tests>
```

Planning baseline on refreshed `d0a4ca8c`: **140/140 focused Stage 3/4/5/navigation tests pass**. Several passing assertions intentionally encode the current unwanted behavior (for example product-load overlays and adjacent cards for one category), so implementation begins by replacing those assertions with the red journey contracts above rather than treating the green baseline as product correctness.

After implementation, run repository typecheck/lint/build plus migration/security checks through `implementation-loop` → `ready-check` → `request-code-review`.

Rendered verification:

- desktop + 390×844: Stage 3 no-op, material accept, material reject, resume/conflict, inventory-only owned and pending result;
- desktop + mobile: first Stage 4, multi-role category, missing/pending image, later comparison, stale/legacy authority repair;
- desktop + mobile: every Stage 5 tile/state and selected full sequence with no duplicated action;
- authenticated mobile `/anwendung` → `Chat`, including empty/history/loading/offline/keyboard/long-message states.

Read-only release preflight:

- recount eligible pending/no-active legacy initial proposals;
- count active drafts with legacy product-load overlays by pass and whether decisions exist;
- count current completed Routine/portfolio category mismatches against source refined `renderedOrder`;
- sample only non-identifying IDs/fingerprints and abort on any row outside the documented repair invariants.

## Review ledger and handoff

- Branch: `codex/personal-plan-stage4-stage5-ux-plan`
- Worktree: `.worktrees/personal-plan-stage4-stage5-ux-plan`
- Task-worktree base: fast-forwarded to `origin/main` `ef0ecfb8` before implementation. Its Stage 5 V2 catalog closure and wetting-deduplication behavior are incorporated above.
- Visual review: Stage 3 authority/disposition, Stage 4 A, synchronized product-comparison metadata, and Stage 5 virtual shelf confirmed.
- Counterpart review: completed once at `high`, read-only, with verdict **approve with revisions**. Findings were verified against current source and reconciled below; no second review is required.
- Stop point: local implementation and verification are authorized; commit, push, PR, migration apply, runtime activation, production writes, merge, deploy, and cleanup remain separately gated.
- Artifact disposition: chosen plan/mockups `commit` when implementation is later authorized; reviewer output remains outside the repository.

Counterpart findings:

| Finding | Disposition |
| --- | --- |
| Initial activation was described as available without naming its default-off route gate. | **Accepted.** Plan now makes the initial-aware RPC canonical, removes `PERSONAL_PLAN_STAGE4_AUTO_ACTIVATE_INITIAL`, and preserves successor delegation inside the RPC. |
| New pass was described as one database check despite multiple SQL/TS guards. | **Accepted.** All evidence sites are enumerated; implementation uses one additive migration to replace effective DB definitions without editing history. |
| New inventory fingerprint name collided with the legacy `capturedFrequencyFingerprint`. | **Accepted.** New contract uses `inventorySnapshotFingerprint` and explicitly supersedes the narrower legacy meaning. |
| Proposed Stage 5 `actionKey` collided with rendered step identity. | **Accepted.** Semantic metadata is named `physicalActionKind`. |
| Full duplicate-wetting regression was described as if committed. | **Accepted.** Finding now distinguishes structural/transient reproduction from the red committed fixture required in Slice D. |
| Independent Chat/Stage 4/Stage 5 work should not be serialized behind the Stage 3 migration. | **Accepted with authority constraint.** Work is split into four PR slices; Chat is fully independent, while Stage 4/5 activation waits for Stage 3 cross-stage authority protection. |
| Owner choice: auto-activation rollout. | **Resolved:** remove the default-off Stage 4 gate and always use the existing initial-aware/delegating RPC. |
| Owner choice: portfolio v3 extension or v4. | **Resolved:** v4, because inventory disposition changes completion authority and frozen semantics. |
| Owner choice: mega-PR or split. | **Resolved:** four PR slices plus integrated readiness; large UI/backend tasks are decomposed inside their slices. |
| Old overlay cleanup was implicit. | **Accepted.** Added an explicit post-rollout cleanup PR after legacy resolution and monitoring; historical parsers remain. |

## Local implementation receipt — 2026-08-13

Implemented in the task worktree without commit, push, migration application, runtime activation, or production writes.

Behavior delivered:

- Stage 3 inventory authority is explicit, resumable, fingerprinted, and default-off for unmarked drafts; every captured product receives either role-fit review or a non-executable retained-inventory disposition.
- Product comparison cards expose fresh verified price and structured pack size as presentation-only facts; alternative navigation moves identity, commerce facts, CTA, counter, and rail markers together.
- Stage 4 activates the first Routine canonically without confirmation, groups each final Bedarfsplan category once, hydrates catalog images outside semantic hashes, and keeps successor review in one user-opened surface.
- Legacy category mismatches fail closed in Stage 4 and Stage 5. One owner-scoped repair continuation is terminally idempotent; a valid corrected successor is surfaced for review without mutating the historical Routine or completed draft.
- Stage 5 uses the selected virtual product shelf, propagates catalog images into the day preview/detail path, preserves regular Chat, and removes the reproduced towel-drying duplication without fuzzy text deletion.

Verification on the final local tree:

- `npm run test:node`: **3730/3730 pass**.
- focused blocker regression suite: **101/101 pass**.
- `npm run typecheck`: pass.
- `npm run lint`: pass with 0 errors and 4 unrelated existing warnings.
- `npm run build`: pass using the root development environment.
- Playwright `tests/personal-plan-stage3.spec.ts`: **2/2 pass** at the configured mobile/desktop journeys.
- `git diff --check`: pass.
- Internal final blocker re-review: no remaining actionable P1/P2 findings after four red-to-green fixes.

Residual gates:

- The four additive Supabase migrations were statically reviewed/tested only; no local or remote migration was applied.
- The required external Claude whole-diff review was attempted at `high`, read-only, but produced no report because the local Claude session quota was exhausted until 17:40 CEST. This remains an explicit publication gate.
- A fresh authenticated production-data Stage 3→4→5 walkthrough remains separate from fixture/Labs/browser proof and from any release activation.
