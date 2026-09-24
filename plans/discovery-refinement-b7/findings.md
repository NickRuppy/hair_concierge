# Discovery toolkit — batch 7 findings (field feedback 2026-09-24)

Status: findings only. Brainstorm → spec → refinement plan follow.
Source: Nick's field notes after the first real calls. Code evidence on `origin/main` `ee11a80b`.

## Overview

| # | Finding | Area | Size | Shape |
|---|---|---|---|---|
| F1 | Participant should pick her own main problem | Quiz (participant) | M | needs decision: discovery-only vs. production quiz |
| F2 | Search needs the arrow button | Checklist | S | clear fix |
| F3 | Routine-relevant habits (heat, styling, washing) never asked before the call | Quiz / checklist | L | **brainstorm** |
| F4 | Sprays are hard to classify | Checklist classifier | S–M | brainstorm (small) |
| F5 | "Compose her routine back to her" confirm flow | Checklist | L | **brainstorm** (merges with F3/F6) |
| F6 | Product use frequency is never asked | Checklist | M | merges with F5 |
| F7 | Conditioner as pre-wash option (like oil) | Checklist usage | S | clear fix |
| F8 | Show her quiz answers on the cockpit | Admin cockpit | S | clear fix |
| F9 | Main-problem section: "we heard you, here is how we address it" | Admin cockpit | M | brainstorm (research mostly exists) |

---

## F1 — Main-problem priority

**Nick:** when ≥2 problems are selected, a modal asks "Wenn du dich auf eins konzentrieren müsstest — was ist dein Hauptproblem?". The routine should then explicitly address it.

**Today:**
- Concerns step: `src/components/quiz/quiz-concerns-question.tsx` (step 8 of the **standard `/quiz`** — discovery participants take the same quiz as the production funnel, `src/lib/discovery/participant.ts:15`). No max selection.
- Stored as unordered `hair_profiles.concerns text[]`; no priority/rank field anywhere in the schema.
- A "main problem" **is** computed today, but by the system, not the user: `resolvePrimaryQuizConcern` (`src/lib/quiz/need-lane.ts:115-126`) sorts by fixed base weights (breakage 60 > dryness 50 > damage 40 > tangling 30 > split ends 20 > frizz 10) plus pull/finger-test and chemical-treatment bonuses.
- That value is then presented as if she said it: result narrative `"Du hast gesagt, dass dich vor allem … stört"` (`src/lib/quiz/result-narrative.ts:434`), also drives the offer preview (`offer-preview.ts:113,243`) and the need lane (`need-lane.ts`, e.g. `bond_repair`, `deep_moisture`).
- Customer.io gets the full array only (`src/lib/customerio/quiz-traits.ts:127-128`) — emails do not carry a primary concern today.
- Personal-plan routine (`src/lib/personal-plan/needs.ts:113-127`) only uses concerns for a structural-damage score (breakage/damage/split ends) and the hair-loss boundary; no "main problem" steering.

**Gap:** someone with frizz + breakage always gets "breakage" as her headline even if frizz is what bothers her. The copy then claims she said so.

**Open questions:**
- Q1a Discovery-only or production quiz too? (Same component; production affects funnel conversion + result page + offer preview.)
- Q1b Does her pick replace the computed primary everywhere (narrative, lane, offer), or only feed the cockpit/routine emphasis?
- Q1c "Explicitly addressed in the routine" — cockpit emphasis (F9) or a real engine change in `personal-plan` (TDD territory)?

## F2 — Search needs the arrow button

**Today:** `ScanSearchSheet` (`src/components/scan/scan-search-sheet.tsx`) already searches **as you type** — but only our own catalog (~350 products; 250 ms debounce, ≥2 chars, `:479-507`). The **dm lane** only runs on Enter/arrow (`handleSubmit`, `:512-535`). In the discovery flow the dm lane is enabled (`src/app/beratung/produkte/page.tsx:70`).

**Gap:** most participant products are not in our catalog → list stays empty until the arrow is pressed → feels like "nothing happens".

**Fix direction:** auto-fire the dm lane too (longer debounce, e.g. ~600 ms, ≥3 chars, cancel stale requests), keep Enter as an instant trigger, drop or demote the arrow. Check dm lane cost/rate limits and the `scan_retailer_search` analytics (it would now fire per pause, not per submit). Shared with the Produkt-Scan search → decide: discovery-only prop or both.

## F3 — Routine-relevant questions missing before the call

**Nick:** in a call he told her what to do, but she never entered heat protection or styling frequency, which changes the routine. Where do we draw the line between pre-paywall quiz, onboarding and refinement?

**Today:**
- Quiz writes only diagnostics to `hair_profiles` (structure, thickness, density, length, finger/pull test, scalp, treatment, concerns, goals — `src/lib/quiz/link-to-profile.ts:32-84`). No habits.
- Feinschliff (post-paywall, `src/lib/personal-plan/refinement/question-path.ts:47-149`) asks: current product categories, wash frequency, scalp irritation detail, dry-shampoo bridge, oil purposes, towel handling, drying routes, extra heat tools, **per heat source: frequency + heat-protection consistency**, night protection. Stored in `personal_plan_refinement_drafts.answers`, not `hair_profiles`.
- Impact on the routine engine:
  - **High:** heat tools/drying route + heat frequency → heat-protectant basis/optional/not needed (`categories/heat-protectant.ts:58-109`), leave-in upgrade on recurring heat (`categories/leave-in.ts:83-90`), damage score (`needs.ts`).
  - **High/medium:** wash frequency → shampoo cadence + dry-shampoo bridge (`categories/shampoo.ts:64-158`).
  - **Medium:** current product categories / oil purposes → current load.
  - **Low:** towel, scalp-irritation detail, night protection.
- In the discovery cockpit every habit field is `unknown` (`INITIAL_UNKNOWN_ROUTINE_CONTEXT`). Consequence: **heat protectant is silently omitted** from the Idealroutine (`load-ideal-routine.ts:180` skips `deferred_until_post_plan_onboarding`), and shampoo cadence falls back to the scalp-oiliness default. This is exactly the gap from the call.

**Observation:** the product checklist already captures most of "current product categories" and "oil purposes". What is really missing for the routine is small: **wash frequency** and **heat (drying route, hot tools, how often, protected?)** — roughly the 3–4 high-impact Feinschliff questions.

**Related program state (check before designing):** central user-profile program (`hair_profiles` as SoT for habits, plan Rev. 10) and the retire-onboarding / freemium question-placement decisions touch the same fields.

## F4 — Sprays are hard to classify

**Today (`src/lib/discovery/classify.ts`, `src/lib/scan/enrichment/suggest-category.ts`):**
- "Sprühkur"/"Sprühpflege"/"Leave-in" → `leave_in` (`classify.ts:229`).
- "Hitzeschutz"/"Heat Protect" → `heat_protectant`.
- No rule for a generic "Spray" → `T12_unknown` → "Was ist das?" with the 10 chips + „Weiß ich nicht".
- Styling products (hairspray, styling sprays, mousse, gels) are **outside our 10 supported categories** (`KNOWN_UNSUPPORTED_PRODUCT_CATEGORY_KEYS`, `src/lib/product-identity/index.ts:19-27`) — there is no chip that fits them.
- Overnight sprays have no home either.

**Open questions:** does a "Spray" get its own usage question ("Wofür nutzt du das Spray?" → Hitzeschutz / Pflege, bleibt drin / Styling & Halt / über Nacht)? Do we need a visible "Styling (nicht bewertet)" bucket so styling products stop landing in „Kategorie offen"?

## F5 — "Compose her routine back to her"

**Nick:** after entering products, we propose her routine ("Du hast vermutlich einen Waschtag, einen Pflegetag und Tage ohne Wäsche"), which categories she likely uses and how often; she approves/edits. Should feel intelligent and double-checks her entries.

**Today:** the review screen (`src/components/discovery/intake/discovery-intake-review.tsx`) lists products + usage and confirms missing categories; no routine structure, no frequencies. Building blocks exist: `ProductFrequency` vocabulary (`src/lib/vocabulary/frequencies.ts`), cadence labels (`src/lib/discovery/cadence-label.ts`), usage roles from batch 5.

**Note:** this is the natural home for F3 and F6: a "Deine Routine" step can ask wash frequency, heat use and per-product frequency as *confirmations of a proposal* instead of a questionnaire.

## F6 — Product use frequency not asked

**Today:** the only "Wie oft" is `shampoo_use`, which is really a type split (regular vs. deep-cleansing). No per-product frequency anywhere in the checklist. Engine vocabulary exists (`ProductFrequency` with min/max per week).

## F7 — Conditioner as pre-wash

**Today:** pre-wash exists only on the oil question (`classify.ts:102-104`, role `pre_wash_fibre_treatment`). `care_use` offers conditioner / mask / leave-in only. Usage-role CHECK `discovery_intake_items_usage_role_pair` only pairs roles with `oil`/`scalp_care` → adding a conditioner pre-wash role needs a migration + cockpit/application handling (does the application-guidance pipeline have a pre-wash protocol for conditioner?).

## F8 — Quiz answers on the cockpit

**Today:** cockpit sections top→bottom: preflight banner, notices, `DiscoveryIntakeProducts`, Idealroutine, `DiscoveryCallCockpit`, OutsideRoutine (`src/app/admin/beratung/[enrollmentId]/page.tsx:198-222`). Raw quiz answers are never shown; the preflight only lists *missing* questions (`preflight.ts:23-50`, reads `leads.quiz_answers`).

**Fix direction:** a compact "Quiz-Antworten" section at the top (label → her answer, German labels from the quiz definitions), plus her main problem (F1) highlighted.

## F9 — Main-problem research section on the cockpit

**Nick:** for every possible problem we need proper research and a recipe ("these people should rather use a leave-in, a mask, a butter…"), shown on the cockpit so he can say "we heard your problem and we can address it".

**Today — research largely exists:** `docs/research/goal-concern-levers/` (2026-06-26) with an evidence-rated lever map per concern (`synthesis.md`: first split, primary levers, conditional levers, weak-first levers, profile modifiers, conflicts, safety boundary). It is loaded as chat-agent guidance (`src/lib/agent-v2/guidance/package-index.ts`), but there is no structured/deterministic form the cockpit could render.

**Gaps:**
- Concern codes differ: research uses `dryness, frizz, tangling, hair_damage, split_ends, breakage, hair_loss, thinning, dandruff, oily_scalp`; the quiz uses `dry_lengths, frizz_flyaways, low_shine, lost_shape, low_volume_or_weighed_down, hair_loss_or_thinning, …`. `low_shine`, `lost_shape`, `low_volume_or_weighed_down` map to research *goals* (`shine`, `curl_definition`, `volume`), not concerns.
- Research is lever-level (conditioner, leave-in, less heat, trim), not product-category recipes with profile modifiers in a structured table.
- "Butter" is not one of our categories.
- Medical-adjacent concerns (hair loss/thinning) must stay a boundary, not a recipe.

**Direction:** a deterministic `concern → recipe` table derived from the existing research (primary categories, conditional categories with profile modifiers, non-product levers, weak-first "avoid" list, boundary), rendered as a cockpit section "Ihr Hauptproblem", ideally showing whether her current products and the Idealroutine cover each lever. Needs a domain-review pass (hair-care-expert lane) for the three goal-mapped concerns and the category mapping.

---

## Proposed grouping for the plan

- **7a — clear fixes (can ship while we brainstorm):** F2 dm auto-search, F7 conditioner pre-wash, F8 quiz answers on the cockpit.
- **7b — main problem:** F1 (priority modal) + F9 (cockpit recipe section).
- **7c — "Deine Routine" step:** F3 + F5 + F6 (+ F4 spray question) — the big brainstorm: which habit questions move before the call, and in which form.

---

## Rulings (Nick, 2026-09-24)

- **F1.1** Priority modal ships **everywhere** (shared `/quiz`: production funnels + discovery) — coherence across funnels.
- **F1.2** The inferred primary concern is **retired**. Only the user-stated main problem is trusted: it drives headline, result narrative, offer preview and need lane. The damage assessment still sees all selected concerns. Applied consequences: exactly one concern selected → it is the main problem; none selected / legacy profiles without a stated pick → no invented main problem (neutral copy).
- **F1.3** No routine-engine or user-facing change for "addressing" the main problem now. Internal only: one-time research of a recipe per quiz problem, rendered as a cockpit section (F9).
- **F2** Search behaviour locked (applies to **both** the discovery checklist and the production scan search — shared `ScanSearchSheet`). Basis: best-practice research (Baymard mobile submit button + autocomplete, Algolia debouncing sources, Meilisearch typeahead/typo tolerance, Typesense fuzzy search, AbortController race handling).
  1. Own catalog stays live as-you-type (250 ms, ≥2 chars).
  2. dm lane **auto-fires** after a typing pause (~500 ms, ≥3 chars); results **append below** own-catalog results with a loading row — never reorder in place.
  3. Superseded requests are **really cancelled** (`AbortController`) on both lanes, on top of the existing token guard.
  4. Arrow button **stays visible but optional**; arrow and Enter fire the dm lane immediately.
  5. Input: `enterKeyHint="search"`, `autoCorrect="off"`, `autoCapitalize="none"`, `spellCheck={false}`.
  6. Own-catalog match gets typo tolerance (Damerau-Levenshtein, 1 edit for short tokens, 2 for longer).
  7. dm lane gets its **own rate-limit bucket** (separate from `SCAN_RATE_LIMIT`), plus a client-side query→results cache so a repeated query is not refetched.
  Note: the research lane itself suggested keeping dm submit-only (unknown cost); overruled — the extra tap is the problem, dm has no per-request price, guardrails 3+7 cover load.
