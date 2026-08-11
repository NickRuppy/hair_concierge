# Personal Plan post-payment remediation

Status: architecture, optional-category direction, rendered evidence, designed journey, and recommended two-slice delivery shape confirmed by Nick on 2026-08-11; two Claude Opus/high review passes completed and locally reconciled. Implementation is authorized through a review-ready local branch. Publication, production writes, migration/catalog apply, deployment, and activation remain unauthorized.

## 1. Outcome and source context

Make the authenticated post-payment journey usable and valuable from the first reward through Anwendung:

- one light, visual readiness transition;
- no repeated product-category confirmation;
- immediate and editable exact-product capture;
- one non-blocking save boundary per category;
- assessment-ready catalog search with complete product identities;
- an ideal-versus-owned product comparison that explains fit;
- honest pending and uncovered states;
- no invented positive mask assessment;
- the first generated Routine active by default, with no confirmation modal;
- a redesigned Routine overview that preserves the selected products and populates Anwendung.

Primary source: [2026-08-11 production debug intake](../docs/feedback/2026-08-11-personal-plan-post-payment-debug-run.md), PP-01 through PP-13.

Relevant prior direction:

- [current UX investigation](./2026-08-10-personal-plan-ux-investigation.md)
- [five-stage product journey](./2026-08-07-personal-plan-five-stage-product-journey.md)
- [Stage 3 implementation plan](./2026-08-07-personal-plan-stage3-products-implementation.md)
- [Stage 4 implementation plan](./2026-08-07-personal-plan-stage4-routine-implementation.md)
- [guarded OGX canonical merge](./2026-08-11-ogx-canonical-merge.md)

Planning contract:

- Outcome: the selected owned products move reliably through Stage 3 into an immediately active, high-value Routine and a non-empty Anwendung; every interaction makes its state obvious.
- Constraints: preserve Stage 1 Bedarf → Stage 2 refinement → Stage 3 exact products → Stage 4 Routine → Stage 5 Anwendung; keep current authority/CAS and fail-closed execution rules; all UI copy stays German; unverified products remain non-executable; later Routine successor proposals remain immutable and explicitly accepted/rejected.
- Non-goals: quiz redesign, shopping/checkout work, automatic product-intake approval, broad catalog cleanup outside affected identities/readiness rules, production data repair, deployment, migration application, feature-flag changes, or universal rollout.
- Done when: PP-01 through PP-13 each has a verified implementation outcome; desktop/mobile evidence is approved; a faithful owner-scoped Stage 1→5 regression proves selected products, immediate first-Routine activation, and populated Anwendung; counterpart review, ready-check, and repository review are complete.

## 2. Confirmed diagnosis

| Finding | Evidence-backed diagnosis | Planned outcome |
| --- | --- | --- |
| PP-01 | Normal flow can show readiness, the real Stage 1 result, a separate Stage 2 invitation, and a conditional Stage 2→3 bridge. The bridge is required only for resume/error; the other transition copy is redundant. | One readiness page; Stage 1 CTA opens the first Stage 2 question; bridge only for recovery. |
| PP-02 | Stage 3 `Deine Produktarten` is seeded from Stage 2 `currentProductCategories`. Unchanged confirmation has no new data job. | Skip it by default; offer an on-demand `Produktarten ändern` correction action. |
| PP-03 | Search currently renders split `displayName` and brand. Live OGX catalog names are still incomplete for Biotin, Rosemary, and Keratin; the Renewing canonical row is fixed, but the active draft retained a stale duplicated display snapshot. | One complete visible/accessibility identity; canonicalize affected rows; rehydrate current catalog identity before Stage 3 completion. |
| PP-04 | Search results never expose a selected state (`aria-selected` remains false). Shampoo can enter persistence immediately; other products jump straight to frequency without an explicit acknowledgment. | Immediate selected card/check state and an in-place frequency panel. |
| PP-05 | Each product capture and category finalization is an individual expected-revision write; the UI intentionally blocks while it saves. | One atomic category replacement queued from `Weiter`; next category opens immediately; completion waits for the queue. |
| PP-06 | The slider component itself supports pointer, touch, and keyboard input, but `onValueChange` persists and locks the screen. | Slider changes local state only; explicit `Weiter` commits; no auto-advance. |
| PP-07 | Search checks active category identity only. Assessment readiness is a later and stricter contract, so a selectable match can still lack specs/protocols. | Selectable catalog results must satisfy assessment readiness; manual/not-ready products enter an explicit temporary analysis state. |
| PP-08 | Authority evaluation already produces criteria, but UI flattens them into generic cards and omits the approved `Soll/Deins/Empfehlung` comparison. | Category-specific ideal-versus-owned rows with pass/fail/unknown and a concrete consequence. |
| PP-09 | `Lücke im Plan markieren` means `leave_uncovered` → `unassigned`, not pending review. | Use outcome copy: `Ohne Produkt fortfahren`; use `Auf Analyse warten` only for actual pending analysis. |
| PP-10 | An uncovered mask role can receive an `ideal` authority result; the UI substitutes category label `Maske` for the absent product name, creating `Maske / Maske / Passt sehr gut`. | Typed subject kinds; an uncovered role never renders as an owned product or positive product verdict. |
| PP-11 | Stage 3 completion deliberately creates a pending initial proposal. The client auto-opens the confirmation sheet even when no active Routine exists. | Atomically activate the first Routine; reserve proposals for later changes. |
| PP-12 | Current Routine cards mix traffic-light decoration, operational status, empty required slots, and product content. The selected-product compiler works for a valid completed draft, so disappearance must be guarded at the Stage 3 completion boundary, not visually hidden. | Neutral, product-led Routine layout plus full transfer regression and boundary diagnostics. |
| PP-13 | Stage 5 requires an active Routine. The current first-Routine confirmation gate alone can block Anwendung. | First completion activates Routine and immediately makes populated Anwendung reachable. |

### Owner-scoped read-only production evidence

The lead visible in the first screenshot currently resolves to one Personal Plan with:

- completed Stage 2 categories `shampoo` and `conditioner`;
- an active Stage 3 draft still in `product_capture`, revision 3;
- the OGX Renewing canonical product ID captured at `weekly_3_4x`;
- no captured Conditioner and no Stage 3 decisions;
- `mask` recorded only as an uncovered role;
- no portfolio version, Routine version, Routine proposal, active Routine pointer, or pending Routine pointer.

Therefore the database truth for that owner never crossed Stage 3 completion. It cannot legitimately populate Routine or Anwendung. The later Routine screenshots cannot be reconciled to that owner’s immutable history from current production state; implementation must add a faithful owner-linked regression and enough non-identifying boundary evidence to distinguish session/owner mismatch from a client-only navigation defect. No production rows were changed during this read.

## 3. Chosen direction

### Confirmed decisions

1. **Persistence boundary — confirmed by architecture decision:** use immediate local UI state plus one serialized, atomic checkpoint per completed product category. Individual selection and slider changes do not write. `Weiter` enqueues a replay-safe category replacement against the expected revision, advances immediately, and the final review action drains the queue before Stage 3 completion.
2. **Optional unowned categories — confirmed:** keep them outside the active Routine in a separate `Später ergänzen` area.

The category checkpoint is the best-practice boundary for this resumable, authenticated wizard because a category is the smallest coherent domain aggregate: product choice, cadence, pending/uncovered decision, and assessment status must agree. Saving each interaction creates visible latency, partial states, and difficult revision conflicts. Saving the whole stage only at the end enlarges the failure domain and loses useful resume progress. Category-level checkpoints retain responsive interaction and bounded recovery without weakening CAS, immutable history, or completion validation.

Architecture invariants:

- interaction state updates synchronously in the client and remains editable while persistence is pending;
- each `Weiter` produces one `replace_capture_category` command containing the full category snapshot; replay safety uses expected-revision CAS plus exact-snapshot equality, not a new key without a durable server-side store;
- one serialized queue owns the expected-revision chain, so concurrent client writes cannot race each other;
- navigation to the next category is optimistic, but Stage 3 completion is a hard drain barrier;
- pending category commands are cached in versioned `localStorage` envelopes keyed by owner/plan/draft, containing only category, candidate IDs, cadence, expected revision, authority fingerprint, and timestamp—not display identity; envelopes expire after 24 hours, clear on acknowledgment/completion/logout, and must rehydrate current authority/catalog identity before replay;
- a failed/conflicted command retains the local snapshot, identifies the affected category, and offers at most one automatic exact-replay reconciliation before explicit retry or authority reload, without silently discarding later local work;
- the server revalidates category authority, canonical product identity, readiness, and revision on every category checkpoint and again at completion.

### Reconciled architectural decisions after counterpart review

1. **Search readiness:** do not call `owned_assessment` eligibility at search time because ownership is established only after capture. Introduce one set-based `assessment_status` projection that returns active identity plus category-specific verified facts/protocol readiness in the search query. `ready` results are selectable; `pending_analysis` results stay visible but route to the temporary wait state. No per-result readiness queries are allowed.
2. **Readiness rollout:** the current production helper reports required-table presence for 100% of active products in every populated supported category (deep-cleansing shampoo currently has no active products), but that helper checks row existence rather than complete authority facts. Implementation begins with an aggregate, category-specific effective-evaluability audit. The measured ready/pending distribution is brought back to Nick before rollout; no arbitrary readiness percentage is treated as approved.
3. **Uncovered-role semantics:** fix PP-10 in the shared projection and every affected authority, not only mask presentation. Version Shampoo, Conditioner, Leave-in, Mask, Deep-cleansing Shampoo, and Bondbuilder authorities so a subject without a captured product can expose an ideal recommendation profile but never persist a positive owned-product verdict. Keep the integrated-carrier Heat-protectant case semantically distinct while preventing the generic product-name fallback. Active in-flight Stage 3 drafts on affected v1 authorities are invalidated and rebuilt; completed immutable evidence is not rewritten.
4. **First Routine audit:** the initial Routine version is its own immutable creation record. Do not create an accepted or pending proposal for first completion. Proposals remain change-review artifacts for successor versions only.
5. **Optional layout:** owned optional products remain in `Optional`; unowned optional roles appear in a third `Später ergänzen` section.
6. **Delivery shape — recommended, pending journey sign-off:** use two stacked review slices under this plan: Slice A covers transitions and Stage 3 capture/search/fit (Tasks 1–4); Slice B covers atomic first activation, Routine, and Anwendung (Tasks 5–6). Both remain behind the same evidence/sign-off gate; neither is production-activated independently, and the full Stage 1→5 gate runs on the combined head.
7. **Initial-activation kill switch:** add a new versioned completion RPC and an app-side default-off auto-activation flag. Migration-first is safe because the old app keeps calling the old RPC. The new app calls the new RPC only for the authorized field-test cohort while the flag is on; turning it off immediately restores pending-first-proposal behavior without a compensating migration.

### Journey and interaction

1. Keep one readiness/reward screen with a small visual plan preview, one sentence (`Das empfehlen wir für dein Haar. Basierend auf deinen Quiz-Antworten.`), and `Bedarfsplan ansehen`.
2. On the actual Bedarfsplan, use `Jetzt auf meine Produkte abstimmen` to start refinement directly at its first question. Do not show the happy-path Stage 2 invitation.
3. Stage 2 owns the product-category answer. Stage 3 opens directly at `Welches Shampoo nutzt du?`; `Produktarten ändern` is an on-demand correction entry, not a mandatory page.
4. Search selection immediately marks the full product identity selected and opens the editable slider in place.
5. Product and frequency stay local until `Weiter`. `Weiter` enqueues one atomic category replacement, advances immediately, and exposes a subtle saving status. Final `Produkte prüfen` waits for all queued writes and presents one retryable failure boundary if necessary.

### Catalog and assessment

1. A selectable Stage 3 catalog result must be active and have `assessment_status=ready` from the set-based category-specific facts/protocol projection. The ownership-dependent `owned_assessment` helper is not used before capture.
2. Conform to the guarded OGX identity plan: render brand separately and a canonical title containing product line plus saleable product name; the accessible name concatenates all parts exactly once. The search RPC joins `product_line_id → product_lines` so line identity is not inferred from a lossy name string.
3. A missing/manual/not-ready product becomes `Analyse läuft`; `Auf Analyse warten` persists a temporary non-executable state. It is never framed as permanent exclusion.
4. Active drafts rehydrate canonical catalog identity at completion so stale display snapshots do not leak into the portfolio/Routine after a catalog correction.
5. The remaining incomplete OGX names are a guarded catalog-data slice. Code, migration/package, preflight, and postcondition proof may be prepared; applying it to production remains a separate authorization.

### Product fit

1. Keep the existing subject discriminant. Pending remains represented by `identity.kind=pending_submission`, authority `status=pending`, and UI projection `kind=pending`; do not encode the same state in a third subject arm.
2. Owned-product feedback renders rows with `Ideal für dich` and `Dein Produkt`, each criterion carrying pass/fail/unknown. A replacement summary appears only when it changes the next action.
3. Uncovered roles show `Dieser Bedarf ist noch offen` and an ideal profile, never a product verdict. Actions are `Passendes Produkt suchen` and `Ohne Produkt fortfahren`.
4. Pending products show `Analyse läuft`, `Auf Analyse warten`, and `Anderes Produkt wählen`.

### Routine and Anwendung

1. A new versioned Stage 3 completion RPC creates the first immutable Routine version and atomically sets it active when no active Routine exists. It creates no proposal row, leaves the pending pointer null, and consumes capture-time `user_product` outbox rows in the same transaction so source sync cannot immediately stage a duplicate successor; the existing completion transaction already consumes its `portfolio_version` row and retains that assertion.
2. Later editor/source-sync/acquisition changes still stage successor proposals against the active version and require explicit accept/reject.
3. The Routine page is the Bedarfsplan resolved with exact products: neutral cards, complete identity, short purpose, cadence, timing, fit state, and expandable application detail.
4. The active Routine shows executable products only. Required uncovered Basis roles are explicit blocking attention states. Owned optional products remain under `Optional`; optional unowned categories live in a separate third `Später ergänzen` area.
5. The first primary CTA is `Anwendung ansehen`; secondary is `Routine anpassen`.

## 4. Scope and non-goals

In scope:

- `/plan-bereit`, `/plan-start`, Stage 2→3 handoff, Stage 3 capture/review, initial Stage 4 activation, Routine overview, Stage 5 reachability;
- Stage 3 search identity/readiness contract and consumption of the separately owned OGX identity correction package;
- additive set-based search RPC plus versioned initial-activation completion RPC and its default-off app flag;
- unit, integration, DB, browser, responsive, accessibility, and faithful owner-flow regression coverage;
- read-only production fingerprints required to verify the diagnosis.

Out of scope:

- changing recommendation science or category authority thresholds;
- auto-approving manual products or weakening non-executable pending states;
- deleting product history or immutable snapshots;
- converting Stage 5 into a tracker/calendar/questionnaire;
- merging, applying migrations/catalog packages, deployment, changing any production flag value, field-test preparation/reset, production activation, or cleanup.

## 5. Target map

| Surface | Primary files / seams |
| --- | --- |
| Readiness and Stage 2 entry | `src/app/plan-bereit/personal-plan-ready-client.tsx`, `src/app/plan-bereit/transition.ts`, `src/components/personal-plan-start/plan-start-flow.tsx`, `src/components/personal-plan-refinement/refinement-flow.tsx` |
| Stage 2 category authority | `src/lib/personal-plan/refinement/question-path.ts`, `src/lib/personal-plan/refinement/session.ts`, `src/lib/personal-plan/refinement/stage1-adapter.ts`, `src/lib/personal-plan/products/stage2-entry-adapter.ts` |
| Stage 3 UI/state | `src/components/personal-plan-products/index.tsx`, `src/components/personal-plan-products/stage3-products-flow.tsx`, `src/components/ui/slider.tsx`, `src/lib/personal-plan/products/state-machine.ts` |
| Stage 3 persistence | `src/app/api/personal-plan/stage-3/route.ts`, `src/app/api/personal-plan/stage-3/complete/route.ts`, `src/lib/personal-plan/products/production-persistence-gateway.ts`, `src/lib/personal-plan/products/stage3-persistence-supabase.ts` |
| Search identity/readiness | `src/lib/personal-plan/products/inventory-search.ts`, `src/lib/product-identity/index.ts`, `src/lib/product-catalog/eligibility.ts`, `src/lib/personal-plan/products/authority/catalog-facts.ts`, `src/lib/product-intake/spec-readiness.ts` |
| Fit authority/projection | `src/lib/personal-plan/products/authority/shared.ts`, category authorities under `src/lib/personal-plan/products/authority/categories/`, `src/lib/personal-plan/products/portfolio.ts` |
| Initial Routine activation | new additive migration created with `supabase migration new`; `personal_plan_complete_product_draft_and_stage_routine`, `src/lib/personal-plan/routine-proposal-stager.ts`, `src/lib/personal-plan/journey-access.ts` |
| Routine UI | `src/components/routine/personal-plan/routine-page.tsx`, `routine-item-card.tsx`, `routine-section.tsx`, `routine-status.tsx`, `routine-proposal-sheet.tsx`, `personal-plan-routine-client.tsx` |
| Anwendung | `src/app/anwendung/page.tsx`, `src/lib/personal-plan/routine/application-adapter.ts`, `src/lib/routines/personal-plan/application/compiler.ts`, `src/components/application/application-view-adapter.ts` |
| Tests | `tests/personal-plan-ready-transition.test.ts`, `personal-plan-start-resume.test.tsx`, `personal-plan-stage3-components.test.tsx`, `personal-plan-stage3-flow.test.tsx`, Stage 3 persistence/authority tests, `personal-plan-stage4-interaction-ui.test.tsx`, `personal-plan-routine-candidate-compiler.test.ts`, `personal-plan-stage5-compiler.test.ts`, `personal-plan-stage1-5.spec.ts` |

## 6. Designed user journey

Actor and entry: a paid, authenticated Personal Plan owner reaches `/plan-bereit` after the plan artifact is ready.

1. One reward screen shows a visual preview and says only that the recommendation is based on quiz answers. `Bedarfsplan ansehen` opens the real Bedarf result.
2. Bedarf shows Basis/Optional needs. Its final CTA, `Jetzt auf meine Produkte abstimmen`, begins Stage 2 at the first real refinement question; there is no second invitation screen.
3. Stage 2 asks current product categories once and completes the remaining refinement questions. On success, Stage 3 opens directly at the first selected category’s search. A failed/resumed authority handoff shows the existing explicit recovery bridge.
4. Search results show complete product identities. Selecting one immediately marks it selected and opens the frequency slider on the same page. The user can drag, tap, or use the keyboard and change the value repeatedly. Nothing auto-advances.
5. `Weiter` confirms that category locally, starts one background save, and opens the next category. A saving indicator remains non-blocking. If a write fails, the local selection stays visible and the user gets one retry/reload action before dependent completion.
6. Assessment-ready products proceed to fit review. A manual or not-yet-ready identity shows `Analyse läuft`; `Auf Analyse warten` keeps it temporary and non-executable.
7. Product review compares the ideal need with the owned product criterion by criterion. Mismatches explain what differs; good fits remain compact. An uncovered category is shown as an open need, not a fake product, with `Passendes Produkt suchen` or `Ohne Produkt fortfahren`.
8. Completing Stage 3 atomically creates and activates the owner’s first Routine. The Routine page opens directly—no modal and no confirmation action.
9. Routine shows only active/executable product cards in Basis/Optional order, with exact identity, purpose, cadence, timing, fit state, and expandable application details. Required missing Basis items are explicit; optional unowned categories are separated under `Später ergänzen`.
10. `Anwendung ansehen` opens a populated Stage 5 day/reference view compiled from the active Routine. If no complete day can be compiled, the page gives a specific recovery reason and route rather than an empty result.
11. Later Routine edits or source changes create a successor proposal with meaningful before/after differences and explicit accept/reject; this does not affect the first-onboarding path.

Meaningful variants and recovery:

- resume/error bridge remains for incomplete authority handoff;
- stale revision keeps local selection and reloads current authority;
- incomplete/manual product remains pending and non-executable;
- required uncovered Basis blocks a falsely complete Routine;
- optional uncovered categories do not pollute the active Routine;
- Stage 5 fails closed with a named recovery state if an active executable day cannot be compiled.

User-journey sign-off: **confirmed by Nick on 2026-08-11**.

## 7. Planning evidence

- [interactive responsive remediation artifact](./mockups/2026-08-11-personal-plan-post-payment-remediation-v1.html)
- [desktop composite](./evidence/2026-08-11-personal-plan-post-payment-remediation-v1-desktop.png)
- [mobile composite](./evidence/2026-08-11-personal-plan-post-payment-remediation-v1-mobile.png)

Questions answered by the artifact:

- how one light transition can replace explanatory pages;
- how selection and an editable slider coexist without blocking saves;
- how pending analysis differs from exclusion;
- how ideal-versus-owned fit reads on mobile;
- how uncovered roles avoid fake product feedback;
- how the first active Routine can feel like the paid result on mobile and desktop.

Selected direction: the artifact reflects the chosen direction in section 3.

Evidence-review status: **confirmed by Nick on 2026-08-11**.

Decision-review status: **category checkpoint architecture, `Später ergänzen` placement, visual evidence, complete journey, and two-slice delivery shape confirmed**.

## 8. Ordered tasks

### Task 1 — Collapse redundant transition and category confirmation

Consumes: current paid readiness state, Stage 1 need plan, Stage 2 `currentProductCategories`, current authority snapshot.

Produces: one readiness surface; direct Stage 1→first-question entry; default Stage 2→direct-search handoff; on-demand category correction.

Implementation:

- reduce readiness copy and add the reviewed visual preview;
- retain the already-correct direct Stage 1→first Stage 2 question behavior and add a regression proving the production `directEntry` path never renders `InvitationShell`; do not spend implementation scope deleting labs/dead-path UI;
- skip `ProductKindReviewScreen` when completed Stage 2 categories match current authority;
- expose `Produktarten ändern` as an explicit correction action that recompletes Stage 2 and rebuilds Stage 3 authority.

Completion check: the real chain is named and tested as `/plan-bereit` reward → Bedarfsplan result → first Stage 2 question → direct Stage 3 search; the fresh happy path has one reward transition and no repeated category question; correction/resume tests still rebuild authority and reject stale bootstrap.

Coverage: PP-01, PP-02.

### Task 2 — Replace write-through capture with an atomic category queue

Consumes: selected catalog/manual candidates, local canonical frequency values, expected Stage 3 revision.

Produces: one `replace_capture_category`-style mutation per category containing its complete product/frequency/uncovered set; serialized revision chain; locally retained pending state.

Implementation:

- add failing interaction tests for immediate selected state, editable slider, explicit continue, and no mutation on slider movement;
- introduce a category-local draft model and one atomic replacement mutation instead of per-product write plus separate finalization;
- make the full category snapshot the replay comparison unit; preserve existing CAS and exact-snapshot equality instead of adding an unbacked operation key;
- serialize category saves in a single background queue that owns the expected-revision chain, advance optimistically, write minimal versioned `localStorage` command envelopes for reload/tab-close reconciliation, and drain before `Produkte prüfen`;
- rehydrate every cached candidate and authority fingerprint before replay; discard expired, completed, logged-out, owner/plan/draft-mismatched, retired, merged, or authority-stale envelopes;
- allow at most two PATCH attempts per category inside a 60-second window, including the single automatic exact-replay reconciliation; batch all fit decisions into one PATCH and complete in one request, so the maximum 10-category path is 20 category requests + 1 decision request + 1 completion request = 22 under the existing 30/60-second limit;
- revalidate authority, canonical identity, readiness, and revision on the category write and at final completion;
- reuse the route's existing phase timings and add only the new category-queue/drain phases without PII.

Completion check: two products/frequencies can be edited without a request; one `Weiter` emits one category write; the next category is usable while the queue drains; reload restores/reconciles pending categories; completion is impossible until all writes succeed; retry cannot loop into rate limiting.

Coverage: PP-04, PP-05, PP-06.

### Task 3 — Enforce complete identity and assessment-ready search

Consumes: canonical catalog identity, active lifecycle, category facts/spec/protocol availability, pending manual identity path, aggregate effective-readiness audit.

Produces: full selectable product identity; explicit `assessmentStatus`; temporary pending state; conformance with the guarded OGX identity plan; completion-time identity rehydration.

Implementation:

- make the visible and accessible search result name one complete canonical identity;
- add a service-role-only, set-based `personal_plan_search_assessment_products_v1` RPC that filters active lifecycle/category/query in Postgres, joins brand/product-line/title identity, caps results, and returns `assessment_status` plus reason codes; ready rows are selectable and non-ready rows remain visible as pending-analysis choices;
- define category-specific effective readiness from the actual authority fact requirements, not only required-table existence, and measure aggregate production coverage before enabling the hard gate;
- rename/document the existing `hasVerifiedProductSpecs` contract as required-spec-row presence for its four other consumers; the stricter Personal Plan assessment status remains a separate named contract rather than silently changing shared behavior;
- report the effective ready/pending distribution per category to Nick before rollout; do not ship a mostly empty ready-result experience without his explicit acceptance;
- route not-found/manual products to existing submission intake and a typed pending analysis state;
- re-read canonical product identity by ID before completion and fail closed if identity/category/lifecycle/readiness changed;
- consume the separately owned guarded OGX canonical-merge plan rather than duplicating its correction package; this branch owns display/rehydration behavior and active-draft reconciliation only.

Completion check: one set-based search query returns identity and readiness without per-row spec calls; every selectable result has complete identity and authority-ready facts; missing facts yield pending/manual UX, never `Noch nicht beurteilbar` followed by immediate exclusion; stale active draft names cannot reach a new portfolio/Routine; measured Stage 3 search p95 is no worse than 10% over its recorded baseline and no more than 500 ms server-side on the representative fixture.

Coverage: PP-03, PP-07.

### Task 4 — Rebuild fit review around typed subjects and comparisons

Consumes: category authority criteria, ideal need, owned product facts, pending state, uncovered-role state.

Produces: typed review subject; ideal/owned/optional-recommendation rows; honest actions.

Implementation:

- add table-driven red authority and UI tests proving uncovered Shampoo, Conditioner, Leave-in, Mask, Deep-cleansing Shampoo, and Bondbuilder roles cannot persist or render an owned positive-fit verdict; include the integrated-carrier Heat-protectant case as a separate non-owned need state;
- version all six affected category authorities, make their uncovered branches return recommendation/need evidence without an owned-product verdict, and invalidate/rebuild affected active v1 drafts without rewriting completed immutable history;
- remove the generic `ownedProductName ?? categoryLabel` product fallback and render explicit uncovered-role presentation for every category;
- keep the existing subject discriminant; update authority evaluation, persisted decision, portfolio projection, and UI consumers without adding a redundant pending subject arm;
- project criteria into stable ideal/current/pass-fail-unknown rows and render the reviewed comparison layout;
- use `Ohne Produkt fortfahren` only when no owned product exists; retain a distinct owned-product exclusion label such as `<Produkt> nicht einplanen`; use `Auf Analyse warten` only for real pending review.

Completion check: known mismatch names the exact difference; unknown remains unknown; uncovered roles across all affected authorities have no product name or positive persisted verdict; affected v1 in-flight drafts rebuild deterministically; action labels match subject and persisted state.

Coverage: PP-08, PP-09, PP-10.

### Task 5 — Activate the first Routine atomically and prove product transfer

Consumes: completed current Stage 3 draft, validated canonical portfolio, compiled Routine candidate, absence/presence of active Routine.

Produces: first active immutable Routine or later pending successor proposal; owner-linked completion receipt; Stage 5 reachability.

Implementation:

- preserve both current-refined-source guard migrations already present on `origin/main` (`20260811070307` and `20260811123500`); they differ only by a trailing semicolon, but removing either is outside this task and could diverge from an applied ledger;
- create a new versioned, service-role-only completion RPC through `supabase migration new`; leave the old RPC unchanged for kill-switch fallback;
- in the new RPC: no active Routine → set `active_routine_version_id`, leave `pending_routine_proposal_id` null, and insert no proposal; existing active Routine → retain pending successor behavior;
- make the already-completed replay branch return pointer state consistent with the initial-active path; retain the legacy no-active/pending branch only for old-RPC/rollback state and cover it explicitly rather than deleting it as dead;
- atomically mark capture-time `user_product` outbox rows processed; assert the existing completion-time `portfolio_version` consumption remains intact;
- add named DB tests for service-role-only execution, owner checks, expected revisions, source fingerprint, replay idempotency, legacy fallback, and new initial-active pointers;
- add a default-off application flag selecting the new RPC for authorized field-test owners; migration deploys first, compatible app deploys second, flag activation remains a separate authorization, and flag-off is the immediate rollback;
- remove initial-confirmation sheet/open state and keep the sheet only for successors;
- add a full Stage 2 categories → selected Shampoo/Conditioner/frequency → role decisions → completion → active Routine regression;
- assert exact catalog IDs, names, availability, and `executable` state across draft, portfolio, Routine, and Stage 5 adapter.

Completion check: initial completion returns an active Routine, no proposal, no pending pointer, and no claimable capture-time outbox work; replay is idempotent; later changes still require confirmation; selected products arrive unchanged; Stage 5 is reachable.

Coverage: PP-11, PP-12 functional defect, PP-13.

### Task 6 — Implement the reviewed Routine makeover and complete the Anwendung review

Consumes: active Routine payload, exact products, executable/gap states, reviewed desktop/mobile artifact.

Produces: redesigned Routine page; populated Anwendung evidence; any newly discovered Anwendung defects as explicit regression findings before ship.

Implementation:

- rebuild header, Basis/Optional hierarchy, cards, chips, detail affordance, required gap, and separate `Später ergänzen` treatment from the reviewed artifact;
- use neutral surfaces and semantic state accents only; preserve keyboard, focus, reduced-motion, and bottom-navigation clearance;
- make `Anwendung ansehen` primary and `Routine anpassen` secondary;
- render a named recovery state instead of the current `null` branch when the Routine payload cannot resolve;
- run the faithful populated Stage 5 journey on 390×844 and 1440×900; fix defects within existing Stage 5 contract and record any broader redesign request as a separate decision.

Completion check: Routine matches approved evidence at both viewports; no initial modal appears; active selected products and cadence are visible; Anwendung has a complete day/reference view and recovery states are not empty.

Coverage: PP-12 visual redesign, PP-13 final review.

## 9. Verification

Automated:

- `npm run test:personal-plan` for Stage 3 state/persistence/component coverage;
- `npm run test:personal-plan-stage5` for Routine→Anwendung compiler coverage;
- `npm run test:playwright:personal-plan-stage1-5` for the full browser contract;
- component tests for selected state, slider pointer/keyboard behavior, pending analysis, comparison rows, uncovered mask, and Routine responsive semantics;
- API tests for atomic category replacement, bounded CAS conflict/replay, reload reconciliation, completion identity revalidation, set-based readiness, and initial activation;
- `npm run test:personal-plan-db` using `scripts/test-personal-plan-db.sh`, with Stage 4 assertions added to `supabase/tests/personal_plan_stage4_routine.sql`, for initial-active versus successor-pending branches, consumed outbox work, RLS/privileges, idempotency, and immutable history;
- full Stage 1–5 browser harness with exact Shampoo/Conditioner identities and non-empty Anwendung;
- `npm run ci:verify` and `git diff --check`.

Manual/browser:

- render and compare 390×844 and 1440×900 for every changed surface;
- pointer, touch-equivalent, Arrow/Home/End slider checks;
- throttled network: selection/slider remain responsive and queue status/retry are truthful;
- back/reload/resume during queued save, forced tab close and reopen, conflict, pending analysis, required gap, and later successor proposal;
- console/network review and horizontal-overflow guard;
- populated Routine→Anwendung journey, not an empty/fixture-only page.

Migration/live state:

- preserve the two current-refined-source guard migrations already tracked on `origin/main`; compare the actual remote database ledger before publication instead of inferring applied state from Git;
- compare local/remote migration ledger before publication;
- exact-state OGX/readiness preflight and postcondition proof without implicit apply;
- record the aggregate effective-readiness distribution and Stage 3 search latency baseline; bring any material pending share to Nick before hard-gate rollout;
- production migration/catalog apply, field-test state preparation, deployment, activation, and live authenticated replay each require separate authorization.

Rollback and rollout:

- the affected field-test cohort is already enabled; the existing overall/stage gates are not treated as an immediate Task 5 kill switch;
- the new completion RPC deploys before compatible application code and remains unused by default;
- a new default-off app flag selects initial auto-activation only for the authorized cohort; turning it off immediately returns future completions to the old pending-proposal RPC without invalidating already-active immutable first Routines;
- Slice A and Slice B are reviewed separately but the combined Stage 1→5 head must pass before either is considered rollout-ready.

Evidence-sensitive review:

- Nick reviews the linked artifact and confirms the designed journey;
- the read-only Claude Opus/high review and the required material-revision follow-up are reconciled before implementation handoff;
- implementation-loop invokes ready-check and request-code-review on the complete branch.

## 10. Review and handoff

- Worktree: `.worktrees/personal-plan-post-payment-remediation`
- Branch: `codex/personal-plan-post-payment-remediation`
- Architecture decision: confirmed — atomic queued checkpoint per category; no per-interaction writes and no all-stage-only save; CAS plus exact-snapshot reconciliation rather than an unbacked idempotency key.
- Optional category decision: confirmed — unowned optional categories live under `Später ergänzen`.
- Evidence review: confirmed by Nick on 2026-08-11.
- User-journey sign-off: confirmed by Nick on 2026-08-11.
- Delivery shape: confirmed — two stacked review slices with one combined rollout gate.
- Counterpart plan review: two Opus/high passes completed and locally verified; second-pass blocker reconciliation incorporated.
- Counterpart findings ledger:

  | ID | Type | Evidence | Decision | Plan change | Revalidation |
  | --- | --- | --- | --- | --- | --- |
  | CR-0 | process | Earlier Claude review process returned no report | superseded | Confirmed decisions were incorporated before a clean rerun | completed |
  | CR-1 | blocker | Task 1 targeted `InvitationShell`, but production already uses `directEntry`; real chain ends in duplicate Stage 3 category review | accepted | Task 1 now names/tests the actual surfaces and skips the Stage 3 duplicate | follow-up review + flow test |
  | CR-2 | blocker | `owned_assessment` requires ownership and cannot gate pre-capture search | accepted | Replaced with set-based category `assessment_status` | follow-up review + contract test |
  | CR-3 | blocker | Per-product readiness lookup would be N×tables and had no latency/coverage gate | accepted | One set-based projection, effective-readiness audit, explicit owner rollout decision, latency budget | query-plan/perf proof |
  | CR-4 | blocker | Uncovered mask persists `ideal` from authority, so UI-only repair is false | accepted and expanded by CR-11 | Version affected authorities plus in-flight draft invalidation | authority/DB/UI tests |
  | CR-5 | blocker | Stable operation key had no durable store or RPC contract | accepted | Use existing CAS plus exact-snapshot replay; bounded retry | reload/conflict tests |
  | CR-6 | blocker | Capture-time `user_product` outbox can stage a successor immediately after first activation | accepted | New RPC consumes capture rows and asserts existing portfolio-row consumption | DB/source-sync regression |
  | CR-7 | blocker | Initial-activation RPC did not specify all pointers, proposal status/path, replay, or successor dead branch | accepted | No initial proposal; explicit pointer, replay, and successor semantics | DB harness |
  | CR-8 | correctness | One label cannot describe both uncovered and owned-product exclusion | accepted | Subject-specific German actions | component tests + evidence review |
  | CR-9 | scope | OGX correction and diagnostic receipt duplicated separate ownership or added weak value | accepted | Consume OGX plan; remove receipt | scope audit |
  | CR-10 | decision | Review size spans two high-risk seams | recommended | Two stacked slices; combined rollout gate | Nick confirmation |
  | CR-11 | blocker | Positive uncovered-role verdict exists in six authorities and generic UI fallback | accepted | Version all six affected authorities and fix the shared projection; preserve integrated-carrier semantics separately | table-driven authority/persistence/UI tests |
  | CR-12 | blocker | Evidence PNGs are ignored | accepted | Add exact `plans/evidence` allowlist | `git check-ignore` + status |
  | CR-13 | blocker | Combined-title display conflicted with the guarded OGX plan and omitted `product_lines` | accepted | Brand remains separate; title contains line + saleable name; accessible identity combines once; search RPC joins line | contract/component tests |
  | CR-14 | blocker | Existing field-test gates do not provide an immediate RPC kill switch | accepted | New versioned RPC plus default-off app selection flag; old RPC retained | migration-order and flag-off tests |
  | CR-15 | correctness | Pending subject arm duplicated existing identity/authority/UI state | accepted | Keep current discriminant and status layers | type/contract tests |
  | CR-16 | correctness | Readiness artifact/cache/rate-limit contracts were under-specified | accepted | Named set-based RPC, minimal versioned cache envelope, explicit 22-request maximum | query-plan, reload, request-count tests |
  | CR-17 | correctness | Initial planning believed only `20260811123500` was tracked remotely | superseded by implementation-time Git evidence | `origin/main` contains both guard migrations and they differ only by a trailing semicolon; preserve both and require an actual remote-ledger comparison before publication | Git tree proof now; database ledger proof before publication |
- Artifact disposition: intake, plan, HTML mockup, and approved renders are `commit`; transient counterpart output is `discard` unless intentionally retained.
- Implementation status: complete in the task worktree. All PP-01–PP-13 behaviors are covered by local implementation and verification; the OGX catalog correction remains a prepared operator package and has not been applied.
- Verification receipt after rebasing onto `origin/main`: `test:personal-plan` 1109/1109; `test:personal-plan-stage5` 142/142; database pgTAP 324/324; isolated production-build Stage 1→5 browser journey 2/2; `ci:verify` passed with four pre-existing warnings and no errors; `git diff --check` passed.
- Review disposition: the two completed Opus/high plan reviews remain incorporated. A further implementation review was started after verification and immediately stopped at Nick's request; no output from that aborted run is used.
- Publication stop: implementation completion does not authorize commit/push/PR, migration application, catalog apply, merge, deployment, or production activation.
