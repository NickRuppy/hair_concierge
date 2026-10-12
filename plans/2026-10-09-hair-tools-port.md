# Hair Tools port — third Feinschliff module „Deine Tools" (Rev. 5, 2026-10-09)

Worktree `.worktrees/hair-tools-port`, branch `codex/hair-tools-port`, base `404db24f` (= origin/main on 2026-10-09). Rev. 2–3b reconciled three Codex rounds (ledger §11). Rev. 4 applied Nick's rulings (temperature dropped, Diffusor = plain blow-drying, Profil two cards). Rev. 5 applies the final structure: Tools before Gewohnheiten, things asked once, wash-day order inside every section, Ziele folded into Haar-Check.

## 1. Outcome and source context

Hair Tools Phase 1 was fully built in August on `codex/personal-plan-hair-tools-current-shape` and shipped as PR #465 (head `d698e5bf`, never merged, now 178+ commits behind). Main since restructured every surface the branch plugged into. This plan ports the reviewed engine onto main and re-wires its integration against main's model. After merge nothing requires a follow-up PR to be user-complete (Nick 2026-10-09).

Sources of record (copied from the old worktree into this one by Task 1, unchanged unless noted):

- Rulings ledger: `plans/2026-08-24-hair-tools-d1-d9-rulings.md` (D1–D9, R1–R4, post-ship review). Amended by §5 of this plan (Task 12).
- Category docs: `docs/personal-plan/categories/tools/{decision,conditional-guidance-matrix,option-pool,product-spec,evidence,fixtures,input-mapping,product-candidates}.md`.
- Old plan/handoff/receipt: `plans/2026-08-12-…`, `plans/2026-08-21-…` (×2), `plans/2026-08-22-…` — historical; this plan supersedes their integration sections (Routine V2 replaced by read-time derivation; the overview regrouped chronologically).
- Evidence memo: `plans/2026-10-09-hair-tools-port-evidence-blowdry-heat.md` — Föhn and Diffusor stay „nicht nötig".
- Mockups: August tool trip (`plans/mockups/2026-08-12-…html`, `plans/mockups/ws4-2026-08-25/`); port mockup `plans/mockups/2026-10-09-hair-tools-port/index.html` (Rev. 5 rework: Tools before Gewohnheiten, chronological groups).
- Status investigation 2026-10-09 — facts cited inline as `main:<path>:<line>` / `OLD:<path>:<line>`.

## 2. Chosen direction

Port, don't merge. Copy the additive engine files, then re-implement the integration against main:

1. **Third Feinschliff module `tools`** („Deine Tools"), **asked before Gewohnheiten**: module order Produkte → Deine Tools → Gewohnheiten (steps 3, 4, 5). Meter 4 → 5. One SQL migration teaches the three module-aware RPCs the new module.
2. **Things are asked once, in Deine Tools.** Gewohnheiten keeps only behaviors: Abtrocknen (technique), Trocknen (routes, offered only for owned airflow tools plus Lufttrocknen), per owned heat tool „Wie oft?" + „Hitzeschutz?", and (Rev. 6, last) the night wear „Nachts". The three thing-questions (weitere Hitze-Tools, Handtuch-Material, Nachtschutz) leave the path when the flag is on; their care-facts fields are **derived from the tool inventory by a fixed mapping**, so the plan engine, Beratung, backfill and legacy columns keep reading the same facts.
3. **Wash-day order everywhere** (Nick 2026-10-09): overview sections, pages inside a section, Profil rows, chips, and the Produkte category list follow the sequence waschen → abtrocknen → entwirren → trocknen/stylen → fixieren → Nachtschutz.
4. **Drying page polish**: „Gewöhnlich föhnen / auch mit Rundbürste", „Mit Diffusor / Aufsatz für Locken/Wellen", no „Nichts davon"; stored empty answers stay valid. **Diffusor counts as plain blow-drying** (no Hitzeschutz question, tier `not_needed`). No temperature question.
5. **Tool ownership saved through the central-profile door** as per-page `care_habits` keys plus the derived thing-fields (no migration); brushes projected into `brushesCombs` (H2). A provenance-aware oracle decides what counts as reported ownership (D5).
6. **Tool content is derived at read time, never versioned** (Stage-1 cards, Routine tool section, Anwendung tool blocks from current facts + active V1 routine). No routine payload V2, no recompute on tools completion.
7. **Tool-Checkpoint** once on the tools module's return to `/routine`; the banner then offers Gewohnheiten.
8. **Profil**: Haar-Check (quiz answers + Ziele row), Produkte, Deine Tools, Gewohnheiten (five behavior rows: Abtrocknen, Trocknen, Hitze-Häufigkeit, Hitzeschutz, Nachts). Styling, Alltag and Ziele cards retire when tools apply.
9. **One rollout flag** `PERSONAL_PLAN_TOOLS_ROLLOUT=off|admin|all` gates everything new. **Rev. 6: the flag defaults on** (unset or any value other than `off`/`admin` = `all`; `off` in any case is the emergency switch; `admin` is kept as an optional stage and is not used in the default rollout). Rollback is a flag flip; a pre-port code rollback needs the new care keys cleared through the facts door AND the tool answers downgraded in the refinement drafts (both done by `tools-rollback-clear-facts.ts --apply`; fix wave F2).
10. **Completed drafts tolerate a grown path**; module completion is replay-safe. A member who later adds a heat tool sees Gewohnheiten reopen with just that tool's two questions.
11. Dropped: Routine V2 + decoders, Stage-3 checkpoint, fork-screen assumptions, „Feinschliff überarbeiten", internal/field-test rollout tiers, D8 decoders and their tests, temperature question, preselection-as-band-aid (replaced by derivation).

## 3. Scope and non-goals

In scope: §2; the pre-existing module-completion retry gap; labs; analytics; docs/ledger.

Non-goals: fixture 114 / deferred-fact marker; W01 refresh spray + Stielkamm; Phase 2 exact-product catalog; cross-family asset identity; C05; onboarding retirement; any Hitzeschutz tier change beyond the Diffusor; Beratung intake beyond the shared Diffusor predicate.

Must remain unchanged: Stage 1–3 behavior with the flag off; the `user_facts_save_v1` door and provenance rules (#648); the derived legacy columns' meaning; routine payloads (`schemaVersion: 1`, immutable rows untouched); the initial-version input hash; heat-protectant tiers for every source except the Diffusor.

## 4. Shared exact values (authoritative)

| Name | Value |
| --- | --- |
| Modules / steps | `STAGE2_MODULES = ["products","tools","habits"]`; labels „Deine Produkte" 3, „Deine Tools" 4, „Deine Gewohnheiten" 5; `TOTAL_STEPS = 5`, `totalSteps = 2 + applicable` |
| Module status enum | `open \| complete \| not_applicable` |
| Path order (flag on) | products block → `tools_overview` → `tools:<pageKey>` (chronological, below) → `towel_handling` (technique only) → `drying_routes` → `heat:<source>` per derived source. `additional_heat_tools` and `night_protection` are not on the path |
| Overview sections (chronological) | 1 „Waschen & Auftragen" [wash_application]; 2 „Abtrocknen & Entwirren" [drying_textiles, brushes_combs]; 3 „Trocknen & Stylen" [airflow, heated_styling, heatless_styling, securing_sectioning]; 4 „Nachtschutz" [night_protection]. Page order inside a section as listed; two-page families keep `:1` before `:2`. Overview copy unchanged („Was hast du schon?", ratified lead, „Nichts davon") |
| Tool question ids | `tools_overview`; `tools:<pageKey>` for `wash_application:1`, `drying_textiles:1`, `brushes_combs:1`, `brushes_combs:2`, `airflow:1`, `heated_styling:1`, `heatless_styling:1`, `securing_sectioning:1`, `securing_sectioning:2`, `night_protection:1` |
| Overview answer | `toolFamiliesWithSomething: ToolFamily[]` (sections → families via `toolFamiliesForSections`) |
| Form answers (draft) | `toolForms: Partial<Record<ToolFormPageKey, ToolReportedForm[]>>` per page; `toolFormsByFamily(answers)` unions pages in canonical order |
| Care-habits keys (new) | `toolFamiliesWithSomething`; one key per page `toolForms_<family>_<n>`; `brushesCombs` derived (`user` iff both brush pages `user`) |
| Derived thing-fields (flag on) | `careFactsFromToolInventory(inventory)` → `additionalHeatTools` (from airflow + heated_styling forms via the heat-source map), `towel.material` (drying_textiles: microfiber_towel→`mikrofaser`, frottee→`frottee`, drying_wrap/smooth_cotton_cloth→`mikrofaser`-equivalent per existing vocabulary, none→`no_towel`), `nightProtection` (night_protection forms → existing `NIGHT_PROTECTIONS` vocabulary, none→`none`). Written by `toCareHabitsPatch` with the source page's provenance; the Gewohnheiten questions for these fields are skipped when derived |
| Heat-source map (tool form → `Stage2HeatEventSource`) | blow_dryer→`ordinary_blow_dry` (becomes `diffuser_airflow_shaping` only via the drying route „Mit Diffusor"); dryer_brush→`dryer_brush`; hot_air_styler, air multi-styler→`hot_air_styler`; straightener, heated_brush→`straightener`; curling_wand, curling_or_wave_iron, wave_iron, automatic_curler, Lockenzange, beheizter Multi-Styler→`curling_or_wave_iron`; thermal_rollers→`thermal_rollers`; heatless forms→none. Defaults chosen by the main session; Nick vetoes at ready-check (exact OLD form ids verified in Task 4) |
| Drying page (flag on) | `air_dry` „Lufttrocknen" always; `ordinary_blow_dry` „Gewöhnlich föhnen / auch mit Rundbürste" iff an airflow form is owned; `diffuser_or_airflow_shaping` „Mit Diffusor / Aufsatz für Locken/Wellen" iff the diffuser form is owned; no „Nichts davon"; ≥ 1 required for new answers; stored `[]` stays valid |
| Towel technique | asked iff `towel.material !== "no_towel"` (existing prune rule) |
| Diffusor rule (flag on) | `requiresStage2HeatProtection("diffuser_airflow_shaping") === false`; tier `not_needed`; stored consistency ignored on read; Beratung intake and backfill follow the predicate |
| Assumption rules (new) | `assume:tools_overview:derived_from_care` → `toolFamiliesForSections(defaultToolSectionsFromCare(care))` (may be `[]`); `assume:tools_form:derived_from_care` (explicit `tools:*` wildcard) → `(defaultToolFormsFromCare(care)[page.family] ?? []) ∩ page.options`; Diffusor heat rule writes `{frequency}` only; existing rules for the derived fields stay as fallbacks when tools are off |
| Existing members | inventory pre-filled from their care facts via the existing `projectToolInventoryFromCareFacts` (provenance `derived`, shown pre-ticked, not saved until confirmed); Gewohnheiten stays complete; adding a heat tool later reopens only that tool's `heat:<source>` questions |
| Facts ↔ answers round-trip | `read.ts:toRefinementAnswers` and `known-care-answers.ts` reconstruct nested `toolForms[pageKey]` before validation; `from-refinement-draft.ts` expands them back |
| Reported-ownership oracle | `reportedToolInventory(...)` (draft) / `reportedToolInventoryFromFacts(...)` (facts): a page is reported iff its own key/id has `user` provenance, or the overview is `user` and the family is unticked (→ `[]`); assumed/derived never enter the inventory (D5) |
| Read-time tool view | `tools/read-view.ts buildToolView({careHabits, fieldProvenance, needSnapshot, routine, hasOptionalPage, toolsEnabled})` → `{stage1Cards, routineSection, applicationGuidance}`; `needSnapshot` supplies `ToolProfileFacts` + `scalpApplicationJob`; pure, `null` when off |
| Produkte category display order | shampoo, deep_cleansing_shampoo, scalp_care, conditioner, mask, bondbuilder, leave_in, heat_protectant, oil, dry_shampoo (display only; enum unchanged) |
| Flag | `PERSONAL_PLAN_TOOLS_ROLLOUT` ∈ `off` (any case; emergency switch) \| `admin` (any case; `profiles.is_admin`; optional stage) \| `all` (default: unset, empty or any other value); resolved server-side into `toolsEnabled` |
| Trigger context | `deriveStage2TriggerContext(snapshot, { toolsEnabled })` — required second argument |
| Recompute trigger | unchanged: only `habits` completion runs the recompute lane |
| Module completion replay | complete draft + matching `expectedRevision` → stored terminal handoff; non-closing with matching `projectedAtRevision` → stored projection, no second facts write; RPC lineage check (`20260825130000:66`) in force otherwise |
| Checkpoint copy | kicker „Deine Tools"; title „Das hast du schon"; lead „Damit planen wir ab jetzt deine Routine."; CTA „Weiter zu deiner Routine" → `/routine`; secondary „Etwas fehlt? Tools ergänzen" → `/plan-start?refine=tools`; groups in chronological section order |
| Banner copy | tools open: „Letzter Schritt: Deine Tools." is wrong now — tools: „Als Nächstes: Deine Tools." / 3 min; habits open after tools: „Letzter Schritt: deine Gewohnheiten." / 3 min; habits open with tools not applicable: today's copy |
| Profil (tools applicable) | card order Haar-Check (quiz rows + „Deine Haarziele" row, own editor), Produkte, „Deine Tools" (photo chips in the four chronological groups; „Was du schon hast, aus deinem Feinschliff."; badge „N Tools"; „Deine Tools bearbeiten"), „Gewohnheiten" (rows Abtrocknen, Trocknen, Hitze-Häufigkeit, Hitzeschutz, Nachts; the two heat rows collapse to one row „Keine Hitze" without heat tools, and „Nachts" is absent for hair too short to tie; „Wie du trocknest und stylst, aus deinem Feinschliff."; „Gewohnheiten bearbeiten"). Tools not applicable → today's cards (Ziele folded into Haar-Check in both cases) |
| Haarprofil rows | Haar-Analyse, Dein Plan, Deine Produkte, Deine Tools, Deine Gewohnheiten |
| Migration | `supabase/migrations/20261009170000_personal_plan_stage2_tools_module.sql`, additive, applied before the code deploy |
| Brush mapping (→ `brushesCombs`) | `wide_tooth_comb→wide_tooth_comb`, `detangling_brush→detangling`, `paddle_brush→paddle`, `round_brush→round`, `boar_bristle→boar_bristle`, `fingers→fingers`; others dropped from the legacy slot only |

## 5. Decision coverage

Decision coverage: **confirmed**. Journey sign-off: Nick accepted the Rev. 5 structure („Okay, I think I like that") with the wash-day ordering rule; on the reworked mockup. Implemented and verified 2026-10-11 — receipt `plans/receipts/2026-10-11-hair-tools-port-ready-check.md`.

### 5.1 Confirmed with Nick (2026-10-09)

- Port onto fresh main; P1 option A with migration; P2 checkpoint on return; P4 ship to all after admin walkthrough; module name „Deine Tools".
- Temperature question dropped („if it's only optional, let's drop it"); Diffusor is basic blow-drying („gooodd").
- Profil option (b): behaviors vs things; then the Rev. 5 structure: Tools first, things asked once, Gewohnheiten = behaviors only.
- Wash-day order inside every section („roughly inspired by the chronological order in which you would apply these products").
- Ziele row moves into Haar-Check.
- August rulings D1–D9, R1–R4 stand; overview regrouping and the three removed Gewohnheiten questions amend D-series rulings on question structure (recorded in the ledger addendum).

### 5.2 Inherited from evidence or contract

- Facts door, per-key provenance protection (#648), H2 brushes from inventory, O2.
- Habits completion exits to `/routine` with recompute; routine versions immutable; D5 derived-never-fulfils; R1; evidence memo; resolver needs a rule per question.
- Plan compute ignores night protection, towel material and brush (care-habits SoT facts) → tools completion needs no recompute even though it derives those fields.

### 5.3 Implementation defaults

- Static three-module model; `not_applicable`; read-time derivation; stored `[]` drying stays valid; stored Diffusor consistency ignored; per-page keys; admin helper; `POST stage-2/complete {module}`; replay rules; Profil composition switch on `toolsApplicable` (fail open); rollback script via RPC null patch.
- Heat-source map defaults (§4) and the towel/night vocabulary mapping — vetoable at ready-check.
- Pre-fill of the inventory for existing members is a UI starting value, never a saved answer (D3a).

### 5.4 Open consequential assumptions

None. Parked out of scope: fixture 114, W01/Stielkamm, Phase 2, C05, cross-family identity.

Coverage acknowledgement: Nick's rulings 2026-10-09 (listed in §5.1) on the mockup and journey of §6/§7. Internal revalidation: Rev. 5; Codex rounds 1–3 valid (Rev. 5 moves questions between modules and adds one derivation mapping; no new storage mechanism). Undiscussed consequential assumptions affecting this handoff: none.

## 6. Designed user journey

Actor: Lena, paying member with an accepted plan, Produkte done, flag `all`.

1. `/routine` banner „Als Nächstes: Deine Tools." (3 von 5) → `/plan-start?refine=tools`.
2. **Überblick** „Was hast du schon?": Waschen & Auftragen / Abtrocknen & Entwirren / Trocknen & Stylen / Nachtschutz, pre-ticked from anything her profile already implies; she ticks Abtrocknen & Entwirren, Trocknen & Stylen, Nachtschutz.
3. Photo pages in that order: Handtücher (Mikrofaser-Handtuch) → Bürsten & Kämme (Rundbürste, Grobzinkiger Kamm) → Haartrockner & Luftstyler (Föhn, Warmluftbürste) → Hitzestyling (Glätteisen) → Heatless (Nichts davon) → Fixieren (Nichts davon) → Nachtschutz (Glatter Kissenbezug). Last page completes the tools module (facts through the door; derived fields: Hitze-Tools = Warmluftbürste + Glätteisen, Handtuch = Mikrofaser, Nachtschutz = Kissenbezug).
4. **Tool-Checkpoint** „Das hast du schon", groups in the same order; „Weiter zu deiner Routine" → `/routine` (4 von 5), banner „Letzter Schritt: deine Gewohnheiten."
5. **Gewohnheiten**: Abtrocknen (Sanft ausdrücken) → Trocknen (Lufttrocknen / Gewöhnlich föhnen; „Mit Diffusor" absent because she owns none) → Warmluftbürste: Wie oft? Hitzeschutz? → Glätteisen: Wie oft? Hitzeschutz? Done: facts written, version projected, routine recomputed → `/routine` with „Plan aktualisiert", 5 von 5, no banner.
6. Routine shows the tool section; Anwendung Waschtag shows tool blocks (Handtuch before Leave-in, Hitzeschutz before Glätteisen). Profil: Haar-Check (incl. Ziele), Produkte, Deine Tools (chips in four groups), Gewohnheiten (Abtrocknen, Trocknen, Hitze-Häufigkeit, Hitzeschutz, Nachts).

Variants and recovery:

- Flag `off` / non-admin: no tools module; Gewohnheiten as today (incl. the three thing-questions); meter „x von 4"; Profil as today except Ziele inside Haar-Check.
- Existing member, Gewohnheiten already complete, flag turns on: no banner for habits; banner „Als Nächstes: Deine Tools."; inventory pre-ticked from her answers; after confirming, Gewohnheiten stays complete unless a new heat tool appeared, in which case only that tool's two questions open.
- Member without heat tools: Gewohnheiten = Abtrocknen + Trocknen (Lufttrocknen only if no airflow tool); Profil Gewohnheiten shows „Keine Hitze" as third row.
- Direct-accept member: tools assumed from care facts (`assumed`); Stage-1 tool cards derived/unverified (D5); Profil „Noch nicht angegeben".
- Completion failure or lost response: retry via `POST stage-2/complete {module}`; replay returns the stored result; checkpoint shows.
- Save/facts conflict: existing recovery copy.

## 7. Planning evidence

- `plans/mockups/2026-10-09-hair-tools-port/index.html` (+ README): banner, Haarprofil (5 rows, Tools before Gewohnheiten), overview (four chronological sections), photo page, checkpoint (chronological groups), Gewohnheiten drying page, Profil (Haar-Check with Ziele, Deine Tools, Gewohnheiten). Rev. 5 rework in progress; prior versions reviewed by Nick today.
- `plans/2026-10-09-hair-tools-port-evidence-blowdry-heat.md`.
- August tool-trip and Bildkarten evidence reused.
- No prototype: oracle, mapping and read-time view are deterministic functions with fixtures.

## 8. Ordered tasks

Owner tiers: S = Sonnet, O = Opus, M = main session. Task numbers stable; Task 7 retired.

**Task 1 — Engine copy, compile-clean subset (S).** Copy byte-identical from the old worktree: `src/lib/personal-plan/tools/**` (10), `src/lib/personal-plan/volume-direction.ts`, `components/personal-plan-tools/tool-thumb.tsx`; docs (8), plans (5), mockups (32), images (53 + 32), scripts (2), `.gitignore` allow-list lines; engine-only tests `tests/personal-plan-tools-{assets,routes,fixtures,contract-ws1,volume-direction}.test.ts`, `tests/personal-plan/tools-contracts.test.ts`, `tests/personal-plan-tools.test.ts`. Not copied here: UI components, `app/labs/personal-plan-tools/*`, decoders, retired tests, `tests/personal-plan-stage2-answer-schema-snapshot.test.ts`. Allowed edits: import/type renames only, in the receipt. Completion: `npm run typecheck` green; copied tests green. **Note:** the overview regrouping (§4) is applied in Task 4, not here; Task 1 keeps the engine byte-identical.
Produces: engine API.

**Task 2 — Module model, `not_applicable`, migration, grown-path tolerance (S; SQL reviewed by M).**
- `refinement/types.ts:120` `STAGE2_MODULES = ["products","tools","habits"]`; module status enum += `not_applicable`.
- `question-path.ts`: module map `tools_overview`/`tools:*` → `tools` (`getStage2QuestionModule` must not throw for them); `getStage2ModulePathStates` init for three modules; a module with zero path questions → `not_applicable`.
- `refinement-status.ts`: `TOTAL_STEPS = 5`, `totalSteps = 2 + applicable` (schema `z.number().int().min(4).max(5)`), `modules.length(3)`, status enum += `not_applicable`; banner and `firstOpenStage2Module` skip `not_applicable`.
- `module-status.ts:60` `stage2AssumptionsActive` ignores `not_applicable`; `stage2-refinement-service.ts:428`, `rebase-projection.ts:211`, `fixture-gateway.ts`: closing check = every module `complete || not_applicable`.
- `module-scope.ts:99` explicit entry for a `not_applicable` module resolves like `refine:false`; `stage2-optional-entry.ts:74` and `optional-entry/route.ts` reject it (`invalid_module`); `refinement-status/dismiss` enum follows.
- Grown path: `stage2SessionFromPersistedDraft` (`stage2-refinement-service.ts:162-176`) builds the session without the „complete requires isComplete" throw for persisted rows (fixture/new sessions keep it); status stays `complete`; `module-scope.ts:176,222` bridge only when `status === "complete" && firstUnresolvedQuestionId === null`; first save reopens via existing `persistence.reopen` (`service.ts:336-339`).
- `hair-profile-section.ts`: rows Haar-Analyse, Dein Plan, Deine Produkte (3), Deine Tools (4), Deine Gewohnheiten (5); `routine-refinement-banner.tsx` copy per §4 (tools: „Als Nächstes: Deine Tools." / 3; habits after tools: „Letzter Schritt: deine Gewohnheiten." / 3; habits with tools not applicable: today's copy); `refinement-question.tsx` section labels + telemetry section `"tools"`.
- Migration `20261009170000_personal_plan_stage2_tools_module.sql`: `CREATE OR REPLACE` of `personal_plan_complete_stage2_module` (accept `'tools'`; `stage3_handoff := p_module = 'products'` unchanged), `personal_plan_open_optional_refinement_v1` (accept `'tools'`), `personal_plan_rebase_on_facts` (`unnest(ARRAY['products','tools','habits'])`, fallback unchanged). Add the file to `tests/personal-plan-pglite-migration.fixtures.ts` `MIGRATIONS` (`:72`) and the rebase chain (`:303`).
- Tests: `tests/personal-plan-stage2-question-path-modules.test.ts`, `tests/personal-plan/refinement/{refinement-status,module-status}.test.ts`, `tests/personal-plan-stage2-session.test.ts` (grown-path complete draft loads), `tests/personal-plan/persistence/stage2-refinement-service.test.ts` (load + reopen on save), `tests/personal-plan-start-resume.test.tsx` (not `unavailable`), `tests/personal-plan-stage2-module-entry.test.tsx`, `tests/personal-plan-profil-haarprofil.test.tsx` (row order), `tests/personal-plan-stage4-ui.test.tsx:1162`, `tests/personal-plan/persistence/stage2-module-completion.test.ts:545` (closing with `not_applicable`), `tests/personal-plan-optional-entry-route.test.ts`, `tests/personal-plan-refinement-status-route.test.ts`, `tests/personal-plan-refinement-banner-dismiss-route.test.ts`, PGlite `tests/personal-plan-complete-stage2-module-migration.test.ts`, `…rebase-on-facts-migration.test.ts`, `…refinement-recompute-activation-migration.test.ts`, `…create-initial-keeps-rebased-head-migration.test.ts`.
Consumes: Task 1. Produces: three-module contract in order products/tools/habits; `not_applicable`; grown-path tolerance.

**Task 3 — Rollout flag + trigger context (S).**
- `release.ts`: `resolvePersonalPlanToolsRollout(env)` (§4 flag row), `canAccessPersonalPlanTools({rollout, isAdmin})`; `rollout-access.ts`: `isPersonalPlanToolsEnabledForUser(userId, client)` via new `lib/auth/is-admin-user.ts` (wraps the existing `profiles.is_admin` read from `require-admin.ts:15-25`; errors → false).
- `deriveStage2TriggerContext(snapshot, { toolsEnabled })` becomes a required second argument so the compiler lists every caller. Real value at: `production-persistence-gateway.ts:54,76`; `rebase-projection.ts:85,104`; `stage2-refinement-supabase.ts:45`; `stage2-optional-entry.ts:158,229`; `refinement-status-read.ts:134`; `module1-stage3-resume.ts:58`; `proposal-service.ts:327`; `direct-acceptance/{defaults.ts:54, accept.ts}`; `snapshot-adapter.ts:227`; routes `stage-2`, `stage-2/complete`, `accept-ideal-plan`, `stage-1`, `refinement-presentation`, `refinement-status`; pages `plan-start`, `routine`, `anwendung`, `profile`. Explicitly tools-off with a code comment: `stage1-service.ts:191`, `sync-plan-with-facts.ts:113`, `freemium/plan-provisioning.ts:168`, `accept.ts:599`, `scan/scanner-context.ts:618,709,722`, `discovery/load-ideal-routine.ts:263`, `free-snapshot-service.ts:167`, labs except `/labs/personal-plan-tools`, `scripts/mobile/*`, `scripts/user-facts/plan-hash-audit.ts`.
- Tests: `tests/personal-plan-tools-rollout*.test.ts` re-based to the new shape (Rev. 6: unset/unknown → all, `off`/`OFF` → off, `admin`/`ADMIN` with/without `is_admin`; under `admin` identity errors fail closed); `tests/personal-plan-tools.test.ts` (resolver); boundary tests per server surface asserting no `tools:*` ids, no tool views and today's Gewohnheiten when off; `tests/personal-plan/persistence/stage1-service.test.ts`, `tests/personal-plan/facts-recompute/sync-plan-with-facts.test.ts`, `tests/freemium-plan-provisioning.test.ts` assert product-only snapshots.
Consumes: Task 2. Produces: `toolsEnabled` at every path derivation.

**Task 4 — Tool questions, per-page answers, derived thing-fields, care keys (O).**
- Engine: regroup `TOOL_OVERVIEW_SECTIONS` and `TOOL_FORM_PAGES` order to §4 (docs-only commit updates `decision.md`/`option-pool.md` section tables); verify `TOOL_REPORTED_FORMS_BY_FAMILY` ids for the heat-source and towel/night maps and record them in `tools/facts.ts`.
- Path (`question-path.ts`): tools block before the habits block; `towel_handling` asks technique only when `towel.material` is derived; `drying_routes` options filtered by owned airflow forms; `additional_heat_tools` and `night_protection` off the path when derived; `heat:<source>` sources = `getSelectedStage2HeatEventSources` over the derived `additionalHeatTools` + drying routes (unchanged function, new input).
- `careFactsFromToolInventory` (§4) + `toCareHabitsPatch` writes derived fields with the source page's provenance; `toFieldProvenance` maps them; `known-care-answers` treats derived fields as known iff their source page is `user`.
- Assumption rules per §4; `selectStage2Answers`, `session.ts`, schema keys, `read.ts`, oracles as Rev. 4.
- Existing-member pre-fill via `projectToolInventoryFromCareFacts` as UI starting value.
- Tests: Rev. 4 list plus `tests/personal-plan/tools-facts.test.ts` (inventory → facts mapping, round trip with `projectToolInventoryFromCareFacts`, every form mapped or explicitly none), `tests/personal-plan-stage2-question-path.test.ts` (block order; thing-questions absent when derived; drying options filtered; adding a heat tool reopens only its `heat:` questions), `tests/user-facts-adversarial-derivation.test.ts` (derived fields feed the same legacy columns).
Consumes: Tasks 2–3.

**Task 5 — Tool question UI + replay-safe completion (S).** Copy `components/personal-plan-refinement/tool-inventory.tsx` from OLD; `refinement-question.tsx`/`refinement-options.tsx` render `tools_overview` (four chronological sections) and `tools:*` pages (chronological order), pre-fill from `projectToolInventoryFromCareFacts` shown as a starting value only, „Nichts davon" semantics, `isLocalAnswerComplete`, `getAnswerForQuestion`, `getQuestionFamily`. Completion: `POST /api/personal-plan/stage-2/complete` accepts `{module?, expectedRevision}`; the PATCH module block (`stage-2/route.ts:270-296`) becomes a shared server function used by both; `http-gateway.ts` gains `completeModule`; `stage2-refinement-service.ts:390-490` gains the §4 replay rules (closing replay on a `complete` draft returns the terminal handoff; non-closing replay with a matching projection skips `writeCareHabitsFacts` and returns the stored projection; the RPC lineage check stays in force otherwise). Labs `/labs/personal-plan-stage-2?scenario=module-tools`. Tests: `tests/personal-plan-stage2-refinement-ui.test.tsx` (tool pages; retry path), `tests/personal-plan-stage2-module-entry.test.tsx` (tools entry walks only its module), `tests/personal-plan-production-client.test.ts` (http gateway `completeModule`), `tests/personal-plan-api-stage2.test.ts` (retry; closing delegation; response lost after commit → replay), `tests/personal-plan/persistence/stage2-module-completion.test.ts` (replay never writes facts twice), Playwright `tests/personal-plan-stage2-refinement.spec.ts` new case „tools module entry".
Consumes: Task 4.

**Task 6 — Drying page polish, Diffusor rule, labels, Produkte order (S; TDD for the tier).**
- Copy (flag on): `refinement-options.tsx` drying labels/subtitles per §4; `lib/profile/section-config.ts:20-30` labels; `mobile/profile-service.ts`; the drying page loses „Nichts davon"; `refinement-question.tsx:132` local completeness requires ≥ 1 for `drying_routes` (new answers only; stored `[]` stays valid); update `tests/personal-plan-stage2-refinement.spec.ts:430`. The drying-options filter by owned airflow forms is produced by Task 4 (path); this task renders it.
- Diffusor (flag on): `heat-events.ts:52` `requiresStage2HeatProtection` returns false for `diffuser_airflow_shaping`; `question-path.ts:335-345` and `projectStage2HeatEvents` ignore a stored Diffusor `protectionConsistency` instead of throwing; `assumed-defaults.ts` Diffusor rule writes `{frequency}` only; `categories/heat-protectant.ts:58-109` treats a Diffusor event as `not_needed`; `derive-legacy-columns.ts` / SQL derivation unaffected; `legacy-columns-to-care-habits.ts:143` emits no Diffusor consistency; discovery intake `components/discovery/intake/heat-flow.ts` and `lib/discovery/heat-styling.ts` follow the predicate (skip the protection step for the Diffusor, tolerate stored values).
- Profil labels in `section-config.ts`: Abtrocknen (`towel_technique`), Trocknen (`drying_method`), Hitze-Häufigkeit (`heat_styling`), Hitzeschutz (`uses_heat_protection`).
- Produkte category display order per §4 in `refinement-options.tsx` and any Profil/Stage-1 list that enumerates categories by hand (display only; enum untouched).
- Tests first: `tests/personal-plan/categories/heat-protectant*.test.ts` (Diffusor-only → `not_needed`; Diffusor + Glätteisen → `basis`; Warmluftbürste unchanged `optional`), `tests/personal-plan-stage2-heat-events.test.ts` (OLD +27 re-based), `tests/personal-plan-stage2-question-path.test.ts` (Diffusor event valid without consistency; stored consistency tolerated), `tests/personal-plan-stage2-refinement-ui.test.tsx` (no protection block after Diffusor; drying page without „Nichts davon"), discovery intake tests, `tests/profile-section-config.test.ts` (labels), options-order snapshot.
Consumes: Tasks 2–4.

**Task 7 — retired.**

**Task 8 — Read-time tool view: Stage 1 + Routine (O).** `tools/read-view.ts` `buildToolView` (§4) over the engine; `stage1-adapter`/`compute-stage1.ts` (+29 OLD lines re-based) add tool cards as presentation-only fields (snapshot validator tolerates additive fields; `inputHash` untouched); `api/personal-plan/stage-1/route.ts` + `snapshot-adapter.ts` + `need-plan-screen.tsx`/`need-card.tsx` + copied `tool-block.tsx` render them (`derived` marking, D5). Routine: `routine/load-view.ts` composes `toolView.routineSection` from `loadUserFacts` + the routine-linked refined need snapshot (`routine/repository.ts:111`) next to the active V1 payload (no payload change); `routine-page.tsx`/`personal-plan-routine-client.tsx`/`routine-editor.tsx` render the copied `routine-tool-section.tsx` with `ToolThumb`; `app/routine/page.tsx` passes `toolsEnabled`. Tests: port `tests/personal-plan-tools-{stage1,routine,day-graph}.test.*` (drop `directAcceptanceAssumptions`), new `tests/personal-plan/tools-read-view.test.ts` (same facts → same view; flag off → null; assumed forms excluded), `tests/personal-plan-stage4-*` (V1 payload untouched; tool section present iff view), `tests/personal-plan/compute-stage1.test.ts`.
Consumes: Tasks 4, 6.

**Task 9 — Anwendung tool blocks (S).** `application-view-adapter.ts` consumes `toolView.applicationGuidance` (OLD +249/−44 re-based on `readApplicationCatalogRows`/`normalizeApplicationRoutineProducts`), copied `tool-use-block.tsx`, `application-day-card.tsx`, `application-day.tsx` (keep `overviewHref`), `application-types.ts`, `anwendung/page.tsx` (`toolsEnabled`; premium + keepsake derive tools from facts, example never); tool blocks ordered by the day sequence (the engine's anchor graph). Tests: port `tests/personal-plan-tools-application.test.tsx`, `tests/personal-plan-stage5-view-adapter.test.ts`; Playwright `tests/personal-plan-application-transition.spec.ts` stays green.
Consumes: Task 8.

**Task 10 — Tool-Checkpoint on module return + labs (O).** `plan-start-flow.tsx` `onModuleComplete` for `tools` → host stage `tools_checkpoint` holding `{session}`; renders copied `tool-checkpoint.tsx` from the draft-side oracle over `payload.session`, groups in chronological section order, §4 copy; CTA → `openRoutineHref("/routine")` (the Routine then shows the habits banner); secondary → `/plan-start?refine=tools`. Remove the Stage-3 checkpoint hook. Labs: copy `app/labs/personal-plan-tools/*` and adapt to the read-time view; `/labs/feinschliff-journey`: steps idealplan → routine → module-products → stage3 → module-tools → checkpoint → module-habits → hair-profile, 5-step meters (`fixtures.ts:245-255`, `journey-client.tsx:230,273,328`). Tests: `tests/personal-plan-start-resume.test.tsx` (checkpoint once after tools, never after habits; retry path reaches it), `tests/personal-plan-module1-stage3-resume.test.tsx`, `tests/personal-plan-stage3-flow.test.tsx` (checkpoint removed from Stage 3).
Consumes: Tasks 5, 8.

**Task 11 — Profil (S).** `refinement-presentation/route.ts` returns a `tools` block from `loadUserFacts` via `reportedToolInventoryFromFacts` (`user` provenance only; `null` → „Noch nicht angegeben"). `section-config.ts`: `goals` field re-homed into the `quiz` section (keeps `editTarget {kind:"profile-edit-goals"}` as a row-level link; the Ziele card is removed in both flag states); new section keys `habits` (meta per §4; fields `towel_technique`, `drying_method`, `heat_styling`, `uses_heat_protection` in that order with `editTarget {kind:"refine", module:"habits"}`; the last two collapse to one row „Keine Hitze" when no heat tool is owned) and `tools` (meta per §4; field `owned_tools` → photo chips grouped in the four chronological sections; `editTarget {kind:"refine", module:"tools"}`). `profile/page.tsx`: `toolsApplicable` from `refinementStatus.modules` (fail open); when applicable render cards Haar-Check, Produkte, Deine Tools, Gewohnheiten and skip `styling`/`routine`; otherwise today's cards (minus the Ziele card); `goToSectionStep("tools", refineHref("tools"))`. `/labs/profile-haarprofil` 5 steps. Tests: `tests/personal-plan-refinement-presentation-route.test.ts`, `tests/profile-section-config.test.ts`, `tests/profile-plan-owner-surfaces.test.tsx` (flag on: four cards in order, chips from facts, „Keine Hitze" variant; off: today's cards with Ziele inside Haar-Check), `tests/personal-plan-profil-haarprofil.test.tsx`.
Consumes: Tasks 2, 4, 6.

**Task 12 — Analytics, copy sweep, rollback script, docs (S).** Port OLD `lib/analytics/{events,destinations/posthog,routes}.ts` additions re-based on main; „Idealplan" → „Plan" in copied engine copy (`tool-checkpoint.tsx`, `tools/presentation.ts`, `tools/labels.ts`, `tool-block.tsx`, `tools/routes.ts`); per-family page titles in `labels.ts` (replaces `Welche ${familyLabel} nutzt du?`); `scripts/personal-plan/tools-rollback-clear-facts.ts` (per user: `user_facts_save_v1` patch with `null` for every new care key under `app.user_facts_writer`; idempotent; dry-run default) + PGlite test on the migrated schema; ledger addendum „2026-10-09 port rulings" (P1–P4, temperature dropped with memo link, Diffusor, Profil (b) → Rev. 5 structure, ordering rule, Ziele, F1–F14, R2-1…R2-4, R3-1/R3-2, §2 read-time note); `docs/personal-plan/categories/tools/decision.md` v5 note (module placement + order, storage via care facts, derived thing-fields, overview regrouping); `docs/local-qa-access.md` labs entries; `tests/ci-workflow-orchestration.test.ts:319` if the spec list changes. Tests: analytics + copy snapshots; rollback PGlite test (repeat run is a no-op).
Consumes: all prior.

**Task 13 — ready-check (M + S).** §9; Codex whole-branch review; fix; resolve artifacts; stop before `/ship`.

## 9. Verification

Automated: `npm run test:personal-plan`, `test:personal-plan:nested`, `test:node`, `ci:verify`, `test:playwright:personal-plan-stage3:journey`; PGlite migration suites incl. the new migration and the rollback script; rule-ID fixture harness; grep guards (routine payload producers/parsers only; heat-route enums).

Manual/browser (flag `all`, dev login): §6 journey on a fresh plan account (tools in chronological order → checkpoint → Gewohnheiten with behaviors only → Routine/Anwendung → Profil four cards in order); flag `off` (today's Feinschliff and Profil, Ziele inside Haar-Check); existing complete-draft account after flag flip (pre-ticked inventory, no habits banner); add a Glätteisen later → only its two questions reopen; direct-accept account; „Deine Tools bearbeiten"; completion retry. Screenshots into `plans/mockups/2026-10-09-hair-tools-port/ready-check/`.

Live-state checks: 3 August test drafts (2 users); 4 Diffusor users' stored consistency tolerated; derived-field parity for the 92 members with care facts (dry-run: inventory pre-fill → `careFactsFromToolInventory` reproduces their stored `additionalHeatTools`/`towel.material`/`nightProtection`).

Migration before code deploy (additive); Nick's copy pass on invented strings (banner, checkpoint, card descriptions) and on the heat-source map at ready-check.

## 10. Review and handoff

- Branch `codex/hair-tools-port`; no push without „ship it".
- Codex plan review rounds 1–3 done; one Codex whole-branch review before push.
- Deploy (Rev. 6): apply migration `20261009170000_personal_plan_stage2_tools_module.sql`, then deploy (the module is live for all, flag defaults on), then Nick's production walkthrough. `admin` remains available as an optional stage. Rollback: flag `off` (any case); pre-port code rollback only after `tools-rollback-clear-facts.ts --apply` (facts + drafts).
- Risks: heat-source map ambiguity (vetoable defaults); derived-field parity for existing members (dry-run check above); one extra facts read per Routine/Anwendung/Stage-1 view.
- Artifacts: plan, mockups, evidence memo, ledger addendum, docs — `commit`; scratchpad notes — `discard`; old worktree retained until merge, then PR #465 closed as superseded.
- Stop point: verified, whole-branch-reviewed local worktree.

## 11. Findings ledger

Round 1 (`01a120be…`): F1–F14 accepted and closed (F5 moot after the temperature drop; F12 superseded by the Profil restructure). Round 2 (`01a120d4…`): R2-1…R2-4 accepted and closed (R2-3 → read-time derivation). Round 3 (`01a120e1…`): R3-1, R3-2 accepted; R3-P adopted as clarification. Full tables with evidence are in the Rev. 3b–4 history of this file (git) and summarised in the ledger addendum (Task 12).

Whole-branch Codex review 2026-10-11 (session `01a129b6…`, tree `c4d83e0e`): 3 majors (flag-off facts expansion, rollback leaving tool answers in drafts, „Tools ergänzen" trapped on the checkpoint) → fixed test-first (`e13b24ae`, `2821a396`, `a58e14de`), scoped re-review: all addressed. Final gates green on the merged tree `aec3f743`.

Rev. 4–5 owner rulings (not findings): temperature dropped; Diffusor = blow-drying; Profil (b) → Rev. 5 structure; wash-day order; Ziele into Haar-Check. Counterpart review closed; Rev. 5 moves questions between modules, adds one derivation mapping and an ordering rule, and introduces no new storage mechanism.

## 12. Rev. 6 — pre-ship batch (2026-10-11, after Nick's walkthrough of the rulings)

Nick reviewed every implementation ruling (ledger addendum). Outcomes:

- **Night care is split like everything else: things vs behavior.** Deine Tools keeps the night things page („Was nutzt du nachts?": Seiden-/Satinkissenbezug, Bonnet, Spitzen-Schoner, weiches Haargummi/Scrunchie, Nichts davon). Gewohnheiten gets a LAST question „Wie trägst du dein Haar nachts?" — single choice: Offen / Locker zusammengebunden / Pineapple („locker oben auf dem Kopf"); skipped when the quiz hair length cannot be tied (short); Gewohnheiten order Abtrocknen → Trocknen → Hitze → Nachts. Stored facts: the night things stay derived from the tools page; the technique (`loose_tied` / `pineapple`, or none for „Offen") comes from the new question and is merged into the existing `nightProtection` list so the routine's Pineapple step and tip keep working. Existing `pineapple`/`loose_tied` answers pre-select the new question, and the member confirms with one tap, the same as the pre-ticked tool inventory. Members who already completed Gewohnheiten see the night question the next time they enter that module; their module status stays complete. Profil Gewohnheiten card gets a fifth row „Nachts". Mockup screens 5b/6 updated. Rationale (UX): one job per module stays learnable; mixing the exclusive wear choice with additive things on one screen is the old mixed question we removed.
- **Flag defaults to on.** `PERSONAL_PLAN_TOOLS_ROLLOUT` unset → `all`; `off` (any case) stays as the emergency switch; the `admin` value is kept as an optional stage and is not used in the default rollout. Tests that assumed „unset = off" set the env explicitly.
- **Consistency with quiz/Feinschliff conventions** (review 2026-10-11): square checkbox on multi-select tool cards; „Nichts davon" as a proper card with checkbox + one-line description; page lead „Wähle alles aus, was du nutzt. Mehrfachauswahl möglich."; Profil tools card copy aligned („Noch offen — tippen zum Ergänzen", „Keine Tools angegeben" instead of „0 Tools"/„Nichts davon" body; checkpoint empty state „Keine Tools angegeben. Du kannst sie jederzeit ergänzen.").
- Confirmed as-is: answer-only cards (Frottee, Diffusor), heat-tool → heat-source mapping, confirmed-vs-derived ownership marking, Stage-1 tool cards from facts, legacy brush pre-fill, Beratung Diffusor effect, tile grouping, towel priority, Profil status gate, assumption parity, flag-off reopen behavior, stored Diffusor Hitzeschutz ignored.
- Deferred by Nick: switching the chat's brush read from the mirror column to the facts store (onboarding retirement). Rollback is the flag only; the script stays unused.
