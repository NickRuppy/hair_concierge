# Personal Plan — five-stage product journey

**Status:** overarching product direction captured from Nick on 2026-08-07; Stage 1 is separately approved and in implementation; Stage 2 is fully planned and signed off; Stages 3–5 still require their own grilling, reviewed evidence, counterpart review, and explicit sign-off

**Outcome:** turn the paid Personal Plan experience into a coherent progression from an immediate quiz-based reward, through refinement and exact-product decisions, into a persistent routine blueprint and executable application guidance

**Source context:**

- `plans/2026-08-06-personal-plan-stage1-bedarf-implementation.md` is the Stage-1 implementation authority once it is committed from the active Stage-1 workstream.
- `plans/2026-08-02-personal-plan-computation-spec.md` remains the current cross-stage computation and product-state input.
- `docs/personal-plan/categories/*/decision.md` remains the category-specific authority.
- `plans/2026-08-02-personal-plan-app-implementation-v2.md` and `plans/mockups/2026-07-30-promise-product-journey.html` are historical planning inputs. Their old three-stage terminology and compressed onboarding sequence are superseded by the five-stage direction below wherever they conflict.

## 1. Chosen direction

The paid journey has five distinct user jobs:

1. **Bedarf:** show the user an immediate, useful quiz-based ideal plan.
2. **Verfeinerung:** ask only the behavioral and conditional questions needed to make that plan personal and reliable.
3. **Produkte:** compare the user's actual products with the requirements, recommend exact products where needed, and record the user's decisions.
4. **Routine:** show one persistent, reopenable blueprint of the products the user has chosen to use.
5. **Anwendungsplan:** turn that blueprint into day-type-specific, step-by-step application guidance.

Each stage has a different cognitive weight. Stage 1 is the reward. Stage 2 feels light and conversational. Stage 3 is the deliberate decision-making phase. Stage 4 gives closure and ownership. Stage 5 makes the result executable in everyday life.

This replaces the earlier compressed three-stage vocabulary:

| Earlier concept | New stage |
| --- | --- |
| Quiz-only Bedarfsplan | Stage 1 — Bedarf |
| Missing-input and habit questions scattered before or inside the old flow | Stage 2 — Verfeinerung |
| Exact-product reconciliation in the old Stage 2 | Stage 3 — Produkte |
| No separately named output between product decisions and application | Stage 4 — Routine |
| Day-type compiler and application guidance in the old Stage 3 | Stage 5 — Anwendungsplan |

## 2. Product-wide invariants

1. The user sees a meaningful paid result before answering another question.
2. Stage 1 remains an immutable quiz-only snapshot. Later answers create a refined result; they do not rewrite what the user originally saw.
3. Category need and exact-product fit remain separate decisions. Owning a product never determines whether the category is inherently needed.
4. Stage 2 is the single final general questionnaire for the complete onboarding journey. It collects every still-needed high-signal non-product-specific fact for product decisions, routine compilation, and application guidance, including which product categories the user currently uses, the general wet-wash rhythm, semantic current-use purpose where required, and every triggered contextual clarification. Stages 3–5 introduce no new general onboarding questionnaire. Exact-product identity and that exact product's reported frequency belong to Stage 3 because they are intrinsic to product reconciliation, not a continuation of general refinement. Every refinement question must have a named deterministic computation, selection, safety, cadence, or instruction consequence. Do not ask an old onboarding question merely because it already exists, and do not collect a preference that the V1 runtime cannot act on.
5. Stage 3 evaluates products per semantic role, not only per broad category. One verified product may cover several roles; several products may be needed only where the category authority confirms distinct jobs.
6. Product comparisons distinguish `passt sehr gut`, `passt mit Einschränkung`, `wechseln empfohlen`, and `noch in Prüfung`. Missing product facts stay unknown rather than becoming false positives or false failures.
7. A safe exact recommendation is direct: one recommended product per uncovered role, with bounded alternatives where the category contract permits them. Chat is not the product-selection path.
8. Choosing a future replacement does not make it owned. Shopping intent, active inventory, pending review, and confirmed in-hand use remain separate states.
9. Stage 4 is visually static and reopenable, but its active content is versioned. Later confirmed changes create a successor rather than silently rewriting the user's routine.
10. Stage 5 compiles executable instructions only from confirmed in-hand products. A shopping-list item may appear as a future gap or bridge state, but not as something the user can already apply.
11. No stage invents exact timing, safety, suitability, or product claims that are not supported by the category authority and verified product facts.
12. All customer-facing copy is German. The working German stage names remain subject to the later copy pass.

## 3. Scope and non-goals

### In scope for the overarching journey

- the five-stage information architecture and handoffs;
- the distinction between the preliminary need plan, refined need state, exact-product decisions, active routine, and application plan;
- resume, pending, error, and incomplete states across onboarding;
- the persistent Stage-4 Routine and Stage-5 Anwendungsplan destinations after onboarding;
- the state boundaries between owned products, overrides, future replacements, shopping-list items, and products under review;
- the planning split required to turn each independently reviewable stage into an implementation plan.

### Non-goals of this document

- changing the approved Stage-1 implementation or its visual evidence;
- selecting the exact Stage-2 question list before the question-to-consequence audit;
- finalizing Stage-3 comparison layout, actions, or product-state copy before mockup review;
- defining the final day-type taxonomy and scheduling rules for Stage 5;
- implementing code, migrations, analytics, feature activation, deployment, or legacy-user migration;
- making Chat, a diary, or product shopping the primary product experience.

## 4. Designed user journey

### Actor and entry condition

The actor is an authenticated Personal Plan buyer with a saved paid-quiz artifact. The gated Personal Plan journey opens after payment readiness. Existing legacy audiences remain outside the new path until separately migrated.

### Stage 1 — Bedarf

**User job:** “Show me what my hair needs and make the purchase feel worthwhile immediately.”

1. The user enters the paid experience and sees no intervening questionnaire.
2. The system computes or resumes the immutable quiz-only initial-need snapshot.
3. Page A, `Deine Basis`, shows every product category the user should confidently use. Each card explains:
   - the category or semantic role;
   - the target product type;
   - the quiz-grounded reason it belongs in this person's plan;
   - only the cadence or trigger that the quiz can resolve truthfully;
   - a preliminary current-best product preview where the Stage-1 contract safely permits it.
4. If optional categories exist, page B uses the same design and presents `Zusätzlich sinnvoll`. It distinguishes useful additions from foundational requirements. If none exist, the page is omitted.
5. The user can inspect card detail without making a product choice.
6. The stage ends with the short transition: `Deine Grundlage steht. Jetzt machen wir sie zu deiner.` The next action explains that a few answers will refine the result.

**Stage output:** immutable quiz-only need snapshot plus typed unknown or deferred facts for later stages.

### Stage 2 — Verfeinerung

**User job:** “Ask me only what you still need to make this fit my real life.”

1. The visual weight becomes lighter and question-led, reusing the strongest interaction patterns from the live onboarding flow. The route has two coherent blocks rather than one undifferentiated question list.
2. **Block A — `Was du heute benutzt`:** the user first selects every product category they currently use on one grouped, scrollable multi-select screen. V1 lists only the ten plan-owned categories: Shampoo, Conditioner, Leave-in, Hitzeschutz, Öl, Maske, Kopfhautpflege, Trockenshampoo, Bondbuilder, and Tiefenreinigung. It does not collect unsupported Styling, Serum, legacy Scrub, or free-text `Other` inventory. `Für deinen Plan relevant` contains the Stage-1 categories with a need tier other than `not_needed`; `Außerdem in deinem Regal` contains the remaining supported categories. The plan itself never preselects ownership. Only answers already saved in the current new Stage-2 draft are restored. The screen catches supported owned extras without reviving the old `Basisprodukte / Extras` semantics. Explicitly selecting none is valid and sends Stage 3 directly to uncovered plan roles rather than forcing a fake owned product.
3. Immediately after the category checklist, Stage 2 asks the one general frequency exception: `Wie oft wäschst du deine Haare normalerweise?` This wet-wash rhythm is a routine-level input rather than an exact-product fact. It is required to resolve refined Shampoo cadence, the Dry-Shampoo bridge, and Mask allocation, and it contributes to the later Deep-Cleansing calculation. Deep-Cleansing need may remain typed-provisional until Stage 3 supplies the relevant exact-product frequencies. The answer set includes an explicit `does_not_wash` value.
4. Block A then asks only the non-frequency current-use details required for selected categories, in the stable plan category order: documented semantic purpose or placement where it changes a downstream decision. For Oil, `Wofür verwendest du Haaröl?` is a multi-select across pre-wash lengths, damp leave-on care, dry finish, and scalp use; it does not force one global primary purpose. Stage 2 does not ask how often any selected product category is used.
5. Conditionals form one predictable chain immediately after the wet-wash rhythm. When the paid quiz contains `irritated`, first ask the two-level safety clarification (`mild_sensitive_or_itchy` versus `burning_painful_or_inflamed`); the latter pauses cosmetic Scalp-Care guidance. Next offer the Dry-Shampoo bridge only when refined scalp/wash logic supports it and the user did not report existing Dry-Shampoo use; existing use counts as acceptance. Visible hair colour follows immediately for an existing user or newly accepted bridge (`hell/blond`, `braun`, `dunkel`), strictly for later tint matching rather than chemical-colour care. Oil-use detail then follows when Oil was selected. There is no miscellaneous conditional-question block at the end. The older provisional generic buildup question is omitted: the confirmed Deep-Cleansing and Scalp-Care rules derive load from existing quiz facts plus the exact-product identity/frequency captured in Stage 3 and retain honest unknowns when those facts are missing. A conditional that truly requires exact product identity or exact-product frequency belongs to the matching Stage-3 product flow instead.
6. **Block B — `Wie du dein Haar behandelst`:** the route follows the user's real post-wash chronology: one combined towel-handling page, drying route(s), any additional Heat tools, event detail, detangling/styling context, then night protection. The towel page keeps material and handling as separate atomic answers underneath, but reveals the conditional handling choice on the same screen and skips it for `no_towel`; material must not be used as a proxy for technique. Drying and Heat form one event-based cluster rather than the legacy duplicate questions. For each selected heated use event, capture both its frequency and Heat-protection consistency (`always | sometimes | no | unsure`); ordinary airflow does not automatically create a Heat-protection need. Normalize those answers into the Stage-1 plan domain's `ordinary_airflow | airflow_shaping | direct_contact_heat | unclassified` events rather than one aggregate Heat frequency or protection boolean. Replace the legacy brush-type inventory with a behavior/context multi-select such as wet/damp detangling with slip, dry detangling, brushing while blow-drying, fingers only, or no regular brushing; the no-brushing answer is exclusive. Night protection is asked of every user as the final behavior page, using the existing semantic multi-select plus an explicit mutually exclusive no-protection answer.
7. Stage 2 does not add a legacy-onboarding migration or partial-reconfirmation path. Even a user who completed the old live onboarding answers the complete new relevant Stage-2 path, and the completed new answers overwrite the corresponding legacy canonical fields. Only answers saved inside this new versioned Stage-2 draft are restored and skipped during same-journey resume. A question appears only when its answer changes a named category need, role, suitability constraint, cadence, application rule, or product-selection constraint.
8. Each page contains one focused user decision or one natural multi-select. The only compact compound pages are towel material plus its conditional handling choice, and a selected Heat event's frequency plus its conditional protection consistency. A dependent follow-up immediately follows its parent instead of being grouped with an unrelated question merely to reduce the displayed step count.
9. Where useful, the UI briefly explains the consequence of the answer without turning the stage into another result presentation.
10. Answers save continuously. Leaving and returning resumes at the first unresolved relevant question in the computed path.
11. When every required Stage-2 fact is complete, the system computes and persists a separate refined need state. The initial Stage-1 snapshot remains intact, and this recomputation stays backstage. Any rule that legitimately depends on exact-product identity or reported product frequency retains a typed unresolved dependency for Stage 3 rather than guessing or forcing that fact back into Stage 2.
12. The route includes any confirmed behavior fact that only changes Stage-5 application, so no second general questionnaire interrupts the later product, Routine, or Anwendungsplan stages.
13. Completion is a hard gate. The user may leave and resume, and the completed Stage-1 result remains accessible, but Stage 3 cannot start until every currently relevant Stage-2 question is valid and saved. There is no `skip` route that advances with typed gaps.
14. Before Stage 3 starts, the user may edit the Stage-2 draft normally. Once any Stage-3 work exists, editing a Stage-2 answer requires an explicit warning that the entire unfinished Stage-3 draft will restart. On confirmation, discard that draft and return to Stage-3 Pass 1; do not build field-level dependency invalidation. The immutable Stage-1 snapshot is unaffected.
15. The stage ends with a brief neutral bridge into deliberate product decisions. It does not show a refinement result, a change summary, or explanations of what changed. The user continues directly into Stage 3, where the newly computed need state is applied to their specific products. Working intent: `Jetzt schauen wir uns deine Produkte an.` Exact copy is pending.

**Stage output:** versioned high-signal refinement answers, category-level current-routine inventory, general wet-wash rhythm, semantic current-use role facts, a refined need/role projection, supported reusable product-selection constraints, and an explicit list of exact-product unknowns reserved for Stage 3. No missing general behavioral or contextual user answer may first surface during Stage 3. V1 does not collect a budget because the current selector has no meaningful high-end/price-tier decision logic. It also does not ask a generic desired-time or minimal-versus-extensive-routine preference because no V1 compiler behavior currently acts on those answers. These inputs belong to later capabilities rather than decorative onboarding data.

#### Stage-2 ordered question contract

The path uses only the two stable section labels `Was du heute benutzt` and `Wie du dein Haar behandelst`; it never shows a mutable `Frage X von Y` total. Each answered page saves before advancing, and changing a parent answer removes now-irrelevant descendant answers from the draft before recomputation.

| Order | Question / stored fact | Format and trigger | Named consequence |
|---|---|---|---|
| A1 | `Welche Produktarten nutzt du aktuell?` → `current_product_categories` | Grouped multi-select of exactly the ten V1 plan categories; everyone; explicit none is exclusive | Defines Stage-3 Pass-1 inventory and known current category coverage; does not imply fit |
| A2 | `Wie oft wäschst du deine Haare normalerweise nass?` → `wet_wash_frequency` | Single select using `ProductFrequency` plus `does_not_wash`; everyone | Resolves Shampoo cadence comparison, Dry-Shampoo bridge eligibility, Mask allocation, and part of later Deep-Cleansing load |
| A3 | `Wie fühlt sich die gereizte Kopfhaut aktuell an?` → `scalp_irritation_detail` | `mild_sensitive_or_itchy` versus `burning_painful_or_inflamed`; only when paid quiz contains `irritated` | Chooses the conservative Scalp-Care route or pauses cosmetic scalp guidance |
| A4 | `Möchtest du Trockenshampoo nutzen, um Tage bis zur nächsten Haarwäsche zu überbrücken?` → `dry_shampoo_bridge_preference` | Accept/decline; only when refined scalp/wash logic indicates the bridge and current categories exclude Dry Shampoo | Resolves the deferred Dry-Shampoo need; existing use counts as accepted without asking |
| A5 | `Welche sichtbare Haarfarbe hast du am Ansatz?` → `dry_shampoo_visible_hair_color` | `hell/blond`, `braun`, `dunkel`; only for existing or newly accepted Dry-Shampoo use | Enables later tint/residue fit; never substitutes for chemical-colour status |
| A6 | `Wofür verwendest du Haaröl?` → `oil_purposes` | Multi-select: pre-wash lengths, damp leave-on care, dry finish, scalp; only when Oil is selected | Creates semantic Oil roles for one active product per purpose in Stage 3 |
| B1 | `Womit und wie trocknest du dein Haar direkt nach der Wäsche?` → `towel_material`, `towel_technique` | One page: material first, then technique when material is not `no_towel`; everyone | Adds only evidence-backed mechanical/frizz context and deterministic Stage-5 handling guidance |
| B2 | `Wie trocknest du dein Haar normalerweise?` → `drying_routes` | Natural multi-select: air-dry, ordinary blow-dry, diffuser/airflow shaping; everyone | Removes legacy duplication, supplies application context, and creates normalized airflow events |
| B3 | `Welche weiteren Hitzetools nutzt du?` → `additional_heat_tools` | Multi-select of supported direct/airflow styling tools plus exclusive none; everyone | Completes the event set without repeating dryer/diffuser |
| B4…n | `Wie oft nutzt du {event} – und wie konsequent Hitzeschutz?` → `heat_events[]` | One page per selected heated event; `ProductFrequency` for every event and `always | sometimes | no | unsure` protection only for `airflow_shaping` or `direct_contact_heat` | Resolves Heat tier, Heat-protectant need and coverage uncertainty, application rule, and event-specific cadence |
| B5 | `Wie entwirrst oder bürstest du dein Haar normalerweise?` → `detangling_styling_contexts` | Multi-select: wet/damp with slip, wet/damp without slip, dry detangling, while blow-drying, fingers only; explicit no regular brushing is exclusive; everyone | Supplies texture-aware mechanical-risk and Stage-5 detangling/styling instructions without judging a tool name alone |
| B6 | `Wie schützt du dein Haar nachts?` → `night_protection` | Existing semantic multi-select plus exclusive no protection; everyone | Distinguishes an explicit behavior gap from unknown and controls Stage-5 night guidance |

After B6, no further onboarding question may appear in Stages 3–5. The system validates the condition graph, saves the completed Stage-2 answer version, recomputes the refined need state backstage, and shows only the neutral Stage-3 Pass-1 bridge. A saved draft supports exit/resume but never unlocks that bridge until all relevant answers are complete.

### Stage 3 — Produkte

**User job:** “Tell me whether my actual products do the jobs I need, recommend exact replacements or additions, and let me decide what I will really use.”

1. Stage 3 has two explicit passes. It consumes the category-level current-routine inventory and general follow-up facts already completed in Stage 2. It does not repeat the category checklist or introduce a missing general habit, use-case, safety, budget, exclusion, or application questionnaire.
2. **Pass 1 — `Deine Produkte erfassen`:** the user identifies every exact product they currently use in the selected categories and records that product's reported frequency, using catalog search plus the existing manual/photo intake path. The product-frequency answer is intrinsic to the identified product rather than a return to general refinement. Unknown products enter `noch in Prüfung` without blocking capture of the remaining inventory.
3. Where Stage 2 captured several semantic purposes, Pass 1 asks which exact product covers each purpose and records its product-specific frequency where relevant. One verified product may be assigned to several purposes; different products may cover different purposes. Oil uses one primary/active product per purpose, never one global primary Oil; additional owned Oils remain visible alternatives and do not enter executable guidance automatically.
4. Only after Pass 1 has captured the complete current inventory does the system recompute the final product-aware need, role, load, and fit projection. This resolves legitimate frequency-dependent rules such as Deep Cleansing before any user-facing fit verdict is treated as final. The system does not show the refined result yet.
5. **Pass 2 — `Was passt – und was ändern wir?`:** the flow provides one product-decision state per relevant category. The default order stays aligned with Stage 1, but the required depth adapts to the verdict:
   - a clear fit receives a compact confirmation with an optional detail affordance;
   - a limitation, mismatch, uncovered role, pending product, multi-role allocation, or other real decision receives the full comparison page;
   - if many or all products need attention, the user proceeds through the full pages because those decisions are valuable rather than artificial onboarding friction.
6. A full category page contains three conceptual sections:
   - **Dein Bedarf:** a concise restatement of what this category or role must do for the user;
   - **Dein Produkt:** the entered owned product, the verified requirements it fulfils, its limitations, and any unknown facts;
   - **Chaarlies Empfehlung:** the one ideal or best-safe exact product for an uncovered role, with the same requirement axes so the comparison is legible.
7. Requirement rows show supported fit states rather than automatically giving the recommended product all checkmarks. A recommendation may be ideal, supportive with an explicit limitation, unavailable, or still under review.
8. The page must handle single-product categories, multi-role categories, several owned products, one product covering several roles, and owned products in categories that the refined plan does not need.
9. A compact clear-fit state confirms which owned product will remain active and why it is sufficient. The user can skim and continue without opening the full comparison, but may inspect the same requirement evidence on demand.
10. Depending on the evidence and inventory state, the user can:
   - confirm a fitting owned product for the routine;
   - knowingly keep a mismatching product as an advised override;
   - add the recommended replacement or addition to the shopping list;
   - state that the recommended product is already owned;
   - inspect or choose a bounded validated alternative;
   - submit another product for review;
   - defer the decision if the final Stage-4 completion policy allows it.
11. `Ich wechsle` cannot silently mean “I own and use the replacement now.” The final actions must distinguish future intent, shopping-list placement, acquisition, and activation.
12. The exact recommendation remains stable unless the user changes a relevant answer, chooses an alternative, removes it, or marks it acquired.
13. Both product-stage passes save after every product or category decision and resume deterministically in the correct pass.
14. After every required product decision is complete, the user sees the first refined result after the immutable Stage-1 Bedarfsplan. This product-aware result applies the Stage-2 answers, complete Pass-1 inventory, and Pass-2 decisions; no equivalent result is shown between Stages 2 and 3 or between the two Stage-3 passes. Its exact information hierarchy and its confirmation boundary with the persistent Stage-4 Routine remain part of the Stage-3 grilling.
15. The stage ends with the transition: `Jetzt finalisieren wir deine Routine.` Exact copy is pending.

**Stage output:** one proposed product portfolio containing role assignments, active in-hand products, explicit overrides, shopping-list decisions, pending products, uncovered roles, and the product facts used for each verdict.

### Stage 4 — Routine

**User job:** “Give me one clear blueprint of the product routine I have decided to follow.”

1. The user reviews a final product/routine overview derived from the confirmed Stage-3 decisions.
2. The page returns to the calmer result-card language of Stage 1, but now the cards are filled with exact chosen products rather than only ideal categories and target types.
3. The overview prioritizes:
   - product and role;
   - whether it is currently in hand, intentionally retained as an override, pending, or planned for purchase;
   - the planned category cadence or trigger;
   - concise status and next action where the routine still has a gap.
4. Detailed “why this category belongs” education stays secondary because Stage 1 already taught it. A short rationale remains accessible for trust and later recall.
5. The user confirms the complete proposal. Confirmation makes that exact version the active routine snapshot.
6. The page becomes a persistent `Routine` destination in the authenticated product and can be reopened without replaying onboarding.
7. Future relevant changes create a proposed successor with a visible delta. The active snapshot remains stable until the user confirms the change.
8. The transition introduces the next job: `Du weißt jetzt, welche Produkte zu deiner Routine gehören. Als Nächstes zeigen wir dir, wie du sie anwendest.` Exact copy is pending.

**Stage output:** confirmed, immutable active routine version plus explicit unresolved/future-shopping states.

### Stage 5 — Anwendungsplan

**User job:** “Show me exactly what to do on the kind of day I am having.”

1. The user reaches a persistent `Anwendungsplan` page containing the day types supported by the confirmed routine.
2. Each day-type card explains its purpose and cadence or trigger. The final taxonomy is still open; current candidates include normal wash day, intensive-care wash, clarifying wash, refresh/care without washing, and rest.
3. Selecting a day type opens a dedicated page. This supersedes the earlier assumption that the whole runbook merely folds open inside the overview card.
4. The dedicated day page presents the complete product sequence in chronological order.
5. The user can move step by step through the products and instructions for that day. Each step shows only verified guidance: preparation, amount where supported, placement, active action, waiting time where known, and rinse/leave-in completion.
6. Unknown exact timing is stated honestly, for example `Dauer laut Produkt`, rather than invented.
7. Shopping-list and pending products do not become executable steps. Where necessary, the day page uses the confirmed current product or shows an honest gap/bridge state.
8. Errors or missing protocol data do not erase the routine. The page retains safe known order and identifies the specific unresolved instruction.
9. After onboarding, Routine answers “what belongs in my plan?” and Anwendungsplan answers “what do I do today?” Both remain reopenable destinations.

**Stage output:** a version-linked library of executable day types and dedicated step-by-step application pages.

### Recovery and meaningful variants across the journey

- Refresh or return: reopen the saved stage and exact saved progress rather than starting over.
- Missing conditional fact: ask only the question that blocks the affected decision; preserve completed answers.
- Unknown product: show `noch in Prüfung`, continue elsewhere, and exclude it from confident product claims and executable guidance.
- No safe exact recommendation: state that the recommendation is being checked rather than promoting a mismatch.
- Owned mismatch: allow an informed override with advice; do not block completion solely to force a purchase.
- Shopping-list item: keep current inventory and executable guidance unchanged until acquisition and confirmation.
- Save failure: retain local progress and retry without duplicating products or decisions.
- Category need changes after refinement: preserve the initial Stage-1 snapshot and apply the current refined requirement in Stage 3 without inserting a generic result/delta screen.
- Long or complex portfolio: provide progress, resume, and clear category completion state without collapsing distinct role decisions.
- No optional Stage-1 categories: skip the optional page without an empty state.

### Completion state

The onboarding journey is complete when the user has seen the immediate quiz-based reward, answered every required refinement question, resolved product decisions to the agreed completion threshold, confirmed an active Routine version, and can open at least one honest executable day type or an explicit incomplete-state explanation in the Anwendungsplan.

## 5. Target map

The exact implementation files remain deliberately unfrozen until each stage is grilled. Planning and implementation should locate or introduce these seams:

- **Stage 1:** active `/plan-start` implementation and `src/lib/personal-plan/` initial-need computation from the approved Stage-1 workstream.
- **Stage 2:** current onboarding question components/store, canonical profile inputs, plan-owned conditional-question policy, refined-snapshot computation and persistence.
- **Stage 3:** onboarding product-category/product-drilldown components, catalog search, product intake, `user_product_usage`, category fit/selector modules, product-choice APIs, shopping-list and override state.
- **Stage 4:** versioned `personal_plans`/`personal_plan_versions`, persistent Routine route, product blueprint components, proposal-delta confirmation.
- **Stage 5:** day-type compiler, verified `product_application_protocols`, dedicated day/runbook routes, and version-linked application rendering.
- **Shared:** audience gate, feature flag, privacy-safe analytics, resume state, German copy, accessibility, and mobile/desktop containment.

## 6. Planning evidence

- The approved Stage-1 evidence remains authoritative only for Stage 1 and its transition.
- `plans/mockups/2026-07-30-promise-product-journey.html` contains useful historical shapes for onboarding questions, product comparison, Routine cards, and application guidance, but it does not confirm this new five-stage sequence.
- `plans/mockups/2026-08-07-personal-plan-stage2-refinement-flow.html` is the first new review artifact. Its 16 selectable states now show the settled Stage-1 invitation; exact ten-category inventory; canonical wet-wash rhythm including explicit no-wash; irritation, conditional Dry-Shampoo bridge, visible-root-colour, and Oil-purpose branches; combined towel handling; nonduplicative drying routes plus additional Heat tools; event-specific frequency/protection; detangling context; universal night protection; save failure/recovery; deterministic new-draft resume; and the direct Stage-3 Pass-1 handoff with no intervening refinement result. It is the Stage-2 journey and visual-rhythm authority; final production copy may still be polished without changing the question contract.
- `plans/2026-08-07-personal-plan-stage2-refinement-implementation.md` is the dedicated Stage-2 implementation authority. It records the exact schemas, conditional path, draft/version boundary, Stage-1 and Stage-3 interfaces, conservative legacy-profile compatibility decision, verification matrix, and independent-build/later-plug-in sequence. Its original and amended high-effort counterpart reviews are reconciled. Nick approved standalone subagent-driven construction from fresh `origin/main`; only the real Stage-1/Supabase/Stage-3 integration remains gated on stable adjacent contracts.
- **Artifact verification 2026-08-07:** inline JavaScript parses; state navigation and DOM order match across all 16 states; the default and declined-bridge/no-Heat conditional routes complete correctly; the category checklist contains exactly ten supported categories; `no_towel` hides technique; critical 375 px and 1180 px split-shell states have no horizontal overflow; and the final headless Chromium pass reported zero console or page errors.
- Further reviewable evidence is required as the remaining consequential decisions are grilled. Across the set, it must still show at minimum:
  - Stage-3 inventory entry and at least the ideal-fit, mismatch/replacement, multi-role, pending, and no-safe-match category states;
  - the Stage-4 Routine with both in-hand and shopping/pending states;
  - the Stage-5 day-type overview and dedicated step-by-step day page;
  - critical 375 px and desktop states.
- **Stage-2 artifact review:** approved by Nick on 2026-08-07 as the visual and interaction direction for ordering, light rhythm, conditionals, recovery, and the neutral Stage-3 handoff. Production copy may be polished without changing the reviewed question contract.
- **Remaining evidence review:** Stage 2 complete; Stages 3–5 pending.
- **Designed-user-journey sign-off:** Stage 2 approved by Nick on 2026-08-07 after the final entry-to-handoff walkthrough; Stages 3–5 not yet ready.

## 7. Consequential decisions for the grilling loop

### Stage 2

1. **Direction settled 2026-08-07; exact audit pending:** retain the existing technique/habit questions only where the answer changes deterministic Stage-5 guidance or another plan decision. Remove or reframe any question that produces only personalized-sounding copy. Add new questions only when a documented category or cross-stage contract requires the answer. Towel material and technique remain atomic facts but share one conditional page; selecting no towel suppresses technique, and material never implies gentle or rough handling. Replace the old brush/comb ownership checklist with a habit/context multi-select, because tool identity alone is not a trustworthy mechanical-stress signal. The answer records wet/damp detangling with slip, dry detangling, brushing during blow-drying, fingers-only handling, and explicit no regular brushing; it does not infer roughness solely from a paddle or round brush. Night protection remains universal rather than profile-conditional; every user supplies the existing semantic multi-select or an explicit no-protection answer, while `unknown` remains distinct from `[]`.
2. Which conditional questions are already fully specified by the ten category authorities, and which remain provisional?
3. Are questions strictly one per page, or can tightly coupled answers share a page?
4. **Corrected and settled 2026-08-07:** Stage 2 recalculates and persists the refined need state but shows no refinement result, delta, or explanation of changes. A brief neutral bridge sends the user directly into exact-product work in Stage 3. The first refined result appears only after the Stage-3 product decisions are complete.
5. **Settled 2026-08-07:** Stage 2 collects every remaining consequence-backed fact, including facts used only for Stage-5 application. Stages 3–5 contain no further onboarding questionnaire.
6. **Settled 2026-08-07:** do not ask for budget in V1. The current selector cannot make a meaningful budget/high-end tradeoff, so collecting it would not satisfy the high-signal rule. Revisit only with explicit price-tier selection logic and catalog support.
7. **Settled 2026-08-07:** do not ask generic ingredient, fragrance, aerosol, format, ethical, or other preference/exclusion questions in V1 when the catalog and selector cannot enforce them reliably. Continue to collect documented safety and behavioral facts that change a real decision. Price, availability, and affiliate disclosure may still be shown in Stage 3 without ranking by a user budget.
8. **Direction settled 2026-08-07; category details pending:** selecting a currently used product category triggers its documented high-signal follow-ups inside Stage 2. These questions describe how the category is actually used and supply downstream need, allocation, cadence, safety, or application logic; they are not deferred to exact-product comparison.
9. **Settled 2026-08-07; Oil authority amendment required:** Oil current-use purpose becomes multi-select in Stage 2: pre-wash lengths, damp leave-on care, dry finish, and scalp use. Stage 3 assigns one primary/active Oil per purpose and may reuse one verified product across several purposes; there is no global primary Oil. Additional owned Oils remain visible alternatives and never enter executable guidance automatically. This supersedes only the existing Oil intake rule that forces one primary use; the confirmed role-specific fit, one-product-per-role assignment, chronology, and no-global-primary semantics remain input to the later Stage-2/3 plan until separately revised.
10. **Settled 2026-08-07:** exclude only the generic `Wie viel Zeit möchtest du investieren?` and minimal-versus-extensive-routine preference from V1 because no current compiler rule acts on them. This does not remove concrete current-behavior questions about washing, Heat, drying, towel use, brushes/combs, night protection, or product-category use.
11. **Settled 2026-08-07:** Stage 2 asks no product-category or bottle-specific frequency. Stage 3 records reported frequency alongside the exact identified product where relevant. The sole Stage-2 frequency exception is the general wet-wash rhythm, including `does_not_wash`, because it must resolve Shampoo cadence, the Dry-Shampoo bridge, and Mask allocation before exact-product intake; it also supplies one required input to the product-frequency-dependent Deep-Cleansing calculation finalized after Stage-3 Pass 1.
12. **Settled 2026-08-07:** Stage 2 asks visible hair colour for tint matching when Dry Shampoo is already used or the user accepts the Dry-Shampoo bridge. The answer options are `hell/blond`, `braun`, and `dunkel`; this is not chemical-colour status or a generic appearance preference, and Stage 3 does not ask it again.
13. **Settled from the confirmed category authorities 2026-08-07:** omit the older provisional generic buildup clarification. Deep-Cleansing and Scalp-Care load are derived from saved quiz facts plus exact-product identity, application target, and frequency from Stage 3. Missing required product facts remain typed unknown rather than prompting a vague buildup self-diagnosis.
14. **Settled 2026-08-07:** organize Block B chronologically as towel handling → drying/Heat → detangling/styling context → night protection. Within the Heat cluster, replace the legacy duplicated sequence with drying route(s) first, then additional Heat tools and an event-detail answer for every heated event. Event detail captures both frequency and Heat-protection consistency (`always | sometimes | no | unsure`). The resulting facts must map explicitly to the Stage-1 plan domain's `ordinary_airflow`, `airflow_shaping`, `direct_contact_heat`, or `unclassified` routes. Do not collapse a user who blow-dries frequently but straightens rarely into one aggregate Heat frequency, or let protected blow-drying hide unprotected direct Heat.
15. **Settled 2026-08-07:** ask the Dry-Shampoo bridge preference only when the refined scalp-and-wash rule indicates a legitimate bridge and the user did not already report Dry-Shampoo use. Existing use resolves the preference as accepted. A newly accepted bridge or existing use immediately triggers the visible-hair-colour question; declining resolves Dry Shampoo as not needed without a Stage-3 page.
16. **Settled 2026-08-07:** when the paid quiz flagged `irritated`, ask the existing two-level irritation safety clarification after the general wet-wash rhythm and before the Dry-Shampoo/Oil conditionals. Do not interrupt the Stage-2 entry with it, but do resolve it before the general behavior block. `burning_painful_or_inflamed` pauses cosmetic Scalp-Care guidance; the flow does not convert it into a cosmetic product answer.

- **Settled 2026-08-07 — legacy users:** no migration or priority branch is required for the small existing-user cohort. They complete the same full new Stage-2 path and the new completed answers overwrite old onboarding values. Resume restores only answers already saved inside the new Stage-2 draft; legacy profile values do not silently satisfy or prefill the new journey.
- **Settled 2026-08-07 — category scope:** the Stage-2 inventory contains exactly the ten V1 plan categories and no unsupported/free-text catch-all. An explicit empty inventory is allowed. Every listed category has an implemented downstream question, Stage-3 intake, plan-role, or fit consequence.
- **Settled 2026-08-07 — hard gates:** Stage 1 completion gates Stage 2, complete relevant Stage-2 answers gate Stage 3, and complete required Stage-3 product inputs/decisions gate the first refined result. Exit/resume is supported at each unfinished gate, but bypassing a gate with missing answers is not.
- **Settled 2026-08-07 — editing after Stage 3 starts:** a confirmed Stage-2 change discards and restarts the complete unfinished Stage-3 draft. Warn before the destructive reset. Do not implement partial dependency invalidation; preserve the immutable Stage-1 snapshot.

### Stage 3

17. **Settled 2026-08-07:** the product-category checklist and all triggered non-product-specific current-use follow-ups belong to Stage 2, before refined need computation. The checklist is one grouped, scrollable multi-select: Stage-1 categories under `Für deinen Plan relevant`, remaining supported categories under `Außerdem in deinem Regal`. Only saved inventory is preselected; plan need never implies ownership. Stage 3 starts with exact product identification and owns exact-product frequency.
18. **Settled 2026-08-07:** Stage 3 has two passes. Pass 1 captures the exact product and its reported frequency for the complete selected-category inventory, then recomputes frequency-dependent need and fit. Pass 2 presents the product verdicts and decisions. It never evaluates a category as final before later inventory facts can change that verdict.
19. **Settled 2026-08-07:** every relevant category receives a Pass-2 decision state, but clear fits use compact, skimmable confirmation with optional detail. Limitations, mismatches, uncovered roles, pending/unknown products, multi-role allocation, and other consequential choices receive the full current-versus-ideal comparison. A user whose products mostly need attention receives a correspondingly longer but valuable flow.
20. How are multiple products and multiple semantic roles represented without turning one category page into a matrix the user cannot understand?
21. What exact actions replace the ambiguous `keep / switch / shopping list` model?
22. What is the completion rule for deferred, pending, no-safe-match, and shopping-only roles?
23. How much price, availability, supported exclusions, and affiliate disclosure belongs in the decision page? Budget collection is excluded from V1 until price-tier selection logic exists.
24. What does the refined product-aware result at the end of Stage 3 show, and what additional confirmation turns that result into the persistent Stage-4 Routine without making the two surfaces feel duplicative?

### Stage 4

25. Does Routine show only what is executable now, both current and future states, or an explicit `Jetzt / Nach dem Einkauf` split?
26. How much rationale remains visible in the persistent artifact?
27. Where does Routine live in navigation, and how does a user initiate later product changes?

### Stage 5

28. Which day types exist in V1 and which category rules can introduce them?
29. Is the day page a passive reference, a guided stepper, or a hybrid with optional progress?
30. Does “follow today” create a log in V1, and if so at what granularity?
31. How do unavailable products and partial protocol coverage change the day-type library?

### Cross-stage

32. What exactly becomes an immutable version at Stage 1, Stage 2, Stage 4, and after later changes?
33. Can the user skip or exit each stage, and where do they land when the routine is not yet confirmable?
34. What is the rollout unit: one full five-stage release, or separately gated stage slices behind a shared audience flag?

## 8. Ordered planning tasks

### Task 1 — Harden Stage 2 as an independent implementation outcome

**Consumes:** approved Stage-1 output contract and all documented conditional-input requirements.

**Produces:** exact question inventory, question-trigger graph, backstage refinement-snapshot contract, reviewed light-question mockups, implementation plan, and Stage-1/Stage-3 handoff interfaces.

**Complete when:** every question has a named consequence, critical branches are mocked at mobile and desktop widths, counterpart findings are reconciled, and Nick explicitly confirms the Stage-2 journey.

### Task 2 — Harden Stage 3 product reconciliation

**Consumes:** refined category/role projection and product-selection constraints from Stage 2.

**Produces:** two-pass inventory/review model, exact-product-and-frequency capture contract, post-intake recomputation boundary, category/role page hierarchy, verdict and action state machine, shopping/pending/override contracts, reviewed comparison mockups, implementation plan, and Stage-4 proposal payload.

**Complete when:** deterministic examples cover every product state and multi-product exception, the actions cannot conflate intent with ownership, and Nick explicitly confirms the Stage-3 journey.

### Task 3 — Harden the persistent Stage-4 Routine artifact

**Consumes:** complete proposed product portfolio from Stage 3.

**Produces:** confirmed Routine information hierarchy, active-versus-future presentation, version-confirmation flow, persistent navigation/re-entry behavior, reviewed mockups, and implementation plan.

**Complete when:** the artifact clearly answers what the user is using now, what remains unresolved, and what happens after a later change; Nick explicitly confirms the Stage-4 journey.

### Task 4 — Harden the Stage-5 Anwendungsplan

**Consumes:** confirmed in-hand portfolio, category cadence rules, and verified application protocols.

**Produces:** V1 day-type taxonomy, compiler boundary, overview and dedicated day-page interaction, missing-protocol/gap behavior, logging decision, reviewed mockups, and implementation plan.

**Complete when:** representative plan fixtures compile into truthful executable days, the dedicated step sequence is reviewed at mobile and desktop widths, and Nick explicitly confirms the Stage-5 journey.

### Task 5 — Reconcile the full product plan

**Consumes:** approved implementation plans and handoff contracts for Stages 1–5.

**Produces:** one consistent cross-stage interface map, rollout sequence, full designed-user-journey walkthrough, counterpart review ledger, and final artifact disposition.

**Complete when:** no stage uses conflicting terminology or state semantics, every persisted output has one owner and consumer, and Nick explicitly signs off the complete end-to-end journey.

## 9. Verification strategy

### Automated

- deterministic question-trigger and recomputation fixtures;
- category/role fit and selector fixtures for ideal, supportive, mismatch, unknown, and no-safe-match states;
- product-decision state-machine tests proving shopping intent cannot mutate owned inventory;
- immutable-version, resume, retry, and proposed-successor tests;
- day-type compilation tests using only confirmed in-hand products;
- regressions for existing product intake, entitlement, routine inventory, and feature-flag-off behavior.

### Manual/browser

- complete paid-buyer journey at 375 px and representative desktop width;
- conditional-question branching and back/resume behavior;
- short, dense, multi-role, pending, mismatch, override, shopping-only, and no-safe-match portfolios;
- Stage-4 re-entry without onboarding replay;
- Stage-5 overview to dedicated step page, including missing protocol and incomplete product states;
- keyboard, focus, screen-reader labels, copy containment, and loading/error recovery.

### Migration/live-state

- exact existing profile and `user_product_usage` answers are reused without duplication;
- pending review and catalog approval transitions do not rewrite an active routine silently;
- feature flag off preserves the existing buyer destination;
- no legacy audience enters the Personal Plan path through entitlement alone;
- production activation remains separate from implementation and requires its own verified rollout decision.

### Evidence-sensitive review

- validate every displayed hair-care rule against its confirmed category decision/evidence authority;
- keep medical-adjacent scalp and hair-loss boundaries conservative;
- reject product-fit claims when required facts are missing;
- confirm that the UI never implies a purchased or effective product based on a click, shopping-list action, or preliminary preview.

## 10. Review and handoff

- **Current planning worktree:** `.worktrees/personal-plan-five-stage-journey` on `codex/personal-plan-five-stage-journey`, branched from committed Stage-1 planning authority `7b0a0ab1` to avoid touching the dirty running Stage-1 worktree.
- **Stage-1 implementation boundary:** unchanged. This document may clarify the transition and future consumers, but it does not authorize changes to the approved Stage-1 implementation.
- **Review gates:** one high-leverage-question-at-a-time grilling; new five-stage mockup evidence; explicit evidence review; Claude/Opus-high counterpart review of every non-trivial implementation plan; final user-journey sign-off.
- **Rollout risk:** the five stages share state but are independently plan-shaped. Code may be sliced behind one audience flag, but no stage should expose a handoff that its downstream stage cannot yet fulfil.
- **Artifact disposition:** this overarching plan is intended to **commit** after the direction is corrected through grilling; new mockups are **commit** if selected as durable authority; transient exploration and counterpart output are **discard** after findings are reconciled.
- **Stop point:** documentation and grilling only. Do not begin Stage-2–5 implementation, commit, push, open a PR, merge, deploy, activate flags, or write production data without the later explicit workflow authorization.
