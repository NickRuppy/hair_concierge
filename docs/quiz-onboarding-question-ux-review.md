# UX Review: Quiz + Onboarding Information Collection

Checked against the current implementation on March 23, 2026.

Baseline sources:
- `docs/quiz-onboarding-data-collection-inventory.md`
- current quiz, results, welcome, auth, and onboarding components
- current profile mapping and recommendation logic

This review is intentionally product-facing and implementation-aware, but not an implementation spec.

## Executive Summary

- The current flow collects valuable profile data, but it is organized around internal storage and feature rollout history more than user mental models.
- The quiz front-loads low-confidence self-diagnostic tasks, while some of the easiest and most reliable inputs arrive late.
- The flow creates a false sense of completion twice: once on the results screen and again on the welcome screen, even though account creation and four onboarding screens still remain.
- The onboarding sequence starts with low-motivation refinement questions (`density`) instead of user-centered intent (`goals`, `desired_volume`, `plan preference`).
- Several asks cost more UX than their current product value justifies. The biggest examples are `routine_preference` and `current_routine_products`, which are stored and surfaced but do not currently drive strict product matching.
- The biggest upside is not removing data collection. It is re-sequencing, re-grouping, and clarifying the same data so users feel guided instead of re-interrogated.

## Current-State Findings

### 1. The flow asks the hardest questions too early

- The quiz begins with observation-heavy or touch-heavy diagnostics before it has built trust or momentum.
- Easier, high-confidence facts like chemical treatment arrive much later even though they are easier to answer and highly relevant.
- This increases both drop-off risk and false-confidence answers.

### 2. The journey communicates “done” too early

- The results screen reads as a completion moment.
- The welcome screen says only a short next step remains, but the user still has to authenticate and complete multiple onboarding screens.
- This creates emotional friction because the product’s promise and the actual effort no longer match.

### 3. Onboarding is grouped by implementation, not by user intent

- `density` and `mechanical_stress` are refinement inputs.
- `desired_volume`, `goals`, and `routine_preference` are future-state preferences.
- `wash_frequency`, `heat_styling`, `post_wash_actions`, and `current_routine_products` are present-state routine context.
- Today these mental models are mixed or sequenced in a way that feels arbitrary.

### 4. The flow does not clearly separate “decision-critical” from “nice-to-know”

- Strong current recommendation impact:
  - quiz diagnostics
  - `density`
  - `mechanical_stress_factors`
  - `heat_styling`
  - `post_wash_actions`
  - `goals`
- Lower current recommendation impact:
  - `wash_frequency`
  - `routine_preference`
  - `current_routine_products`
  - `desired_volume` mainly as a displayed preference plus derived `volume` goal
- The UX currently treats many of these asks as equally important, which makes the routine screen feel heavier than its actual payoff.

### 5. Empty states are sometimes ambiguous

- Empty arrays can currently mean either “none of these apply” or “the user skipped this section.”
- This is especially true for:
  - `mechanical_stress_factors`
  - `current_routine_products`
  - `post_wash_actions`
  - `goals`
- That ambiguity hurts data quality, not just UX.

## Question-By-Question Audit Matrix

### Quiz

| Ask | Affected fields | Recommended action | Current issue | Why it hurts | Recommended change | Change type | Expected impact |
|---|---|---|---|---|---|---|---|
| `WAS IST DEINE NATUERLICHE HAARTEXTUR?` | `hair_texture` | `keep`, `reword`, `reorder` | The very first question already asks for a semi-technical self-test. | Users have not yet built confidence in the flow, so early uncertainty can lower both completion and answer accuracy. | Keep the question, but move it after at least one easier factual question. Reword toward observable outcome: `Wenn dein Haar ohne Styling trocknet: Welche Form zeigt es am ehesten?` Add helper copy: `Wähle die Antwort, die am ehesten passt.` | Copy + flow | Completion up, confidence up, quality slightly up |
| `WIE DICK SIND DEINE EINZELNEN HAARE?` | `thickness` | `keep`, `explain better` | The sewing-thread comparison is useful but still abstract for many users. | Users often confuse single-strand thickness with density. | Keep the question, but add a short clarifier in plain language: `Gemeint ist ein einzelnes Haar, nicht wie viele Haare du insgesamt hast.` | Copy-only | Confidence up, quality up |
| `DER OBERFLAECHENTEST` | `cuticle_condition` | `keep`, `split`, `explain better` | The test reads like a salon ritual and asks for a lot of procedural precision. | High-effort instructions increase abandonment or guessing. | Keep the signal, but frame it as `Mini-Haarcheck 1 von 2`. Shorten the action steps and simplify the answer language around feel: `glatt`, `etwas rau`, `deutlich rau`. | Copy + layout | Confidence up, quality up |
| `DER ZUGTEST` | `protein_moisture_balance` | `keep`, `split`, `explain better` | The action is easy to do incorrectly, and the outcomes mix observation with expert interpretation. | Users may over-pull, fear damaging their hair, or choose the answer that sounds “best.” | Keep the signal, but frame it as `Mini-Haarcheck 2 von 2`. Separate action from meaning. Example helper line: `Ziehe nur leicht. Uns geht es um die Tendenz, nicht um Perfektion.` | Copy + layout | Confidence up, quality up |
| `WIE IST DEIN KOPFHAUTTYP?` | `scalp_type` | `reword`, `reorder` | The title asks for a type, but the copy asks users to reason from wash cadence and facial skin. | Users answer lifestyle instead of scalp state, and `trocken` overlaps mentally with the later `trockene Schuppen` option. | Reframe around observable behavior: `Wie schnell fetten deine Ansätze nach?` Keep the internal mapping to `scalp_type`, but make the user-facing labels concrete. | Copy + future logic | Confidence up, quality up |
| `HAST DU KOPFHAUTBESCHWERDEN?` | `scalp_condition` when the answer is no | `keep`, `explain better` | The branch is structurally good, but the wording does not clearly distinguish this from the previous scalp question. | Users can read `trocken` and `trockene Schuppen` as the same thing. | Reword to `Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?` so the relationship to scalp type is explicit. | Copy-only | Confidence up, branch clarity up |
| `WELCHE BESCHWERDEN HAST DU?` | `scalp_condition` | `keep`, `reword` | The UI forces a single choice without telling the user to choose the main problem. | Users with mixed symptoms can feel unrepresented and choose arbitrarily. | Keep single-select for now, but change the prompt to `Was ist aktuell dein Hauptproblem?` | Copy-only | Confidence up, quality up |
| `SIND DEINE HAARE CHEMISCH BEHANDELT?` | `chemical_treatment` | `keep`, `reorder` | This is one of the easiest, highest-confidence signals, but it arrives late. | The flow spends momentum on harder questions before it cashes in an easy diagnostic win. | Move this into the first two quiz questions. It is a strong candidate for the new quiz opener. | Flow-only | Completion up, momentum up, quality unchanged or slightly up |

### Onboarding

| Ask | Affected fields | Recommended action | Current issue | Why it hurts | Recommended change | Change type | Expected impact |
|---|---|---|---|---|---|---|---|
| `Wie dicht ist dein {adjective} Haar?` | `density` | `keep`, `reorder` | The question is valid, but it is a poor first onboarding moment right after the user thinks the quiz is finished. | It feels like more diagnostics before the user gets to express goals or preferences. | Move `density` to the final onboarding step as a short `Feintuning` question. Keep the contrast to strand thickness. | Flow-only | Completion up, motivation up, quality unchanged |
| `Wie beanspruchst du dein Haar mechanisch?` | `mechanical_stress_factors` | `keep`, `combine`, `clarify none-state` | Three optional checkboxes do not justify a full standalone screen. | The screen cost is too high for the amount of input, and an empty response is ambiguous. | Combine this with `density` on a final `Feintuning` screen. Add an explicit user-facing none-state such as `Nichts davon regelmäßig`. | Flow + copy + future logic | Completion up, data quality up |
| `Wie oft waeschst du deine Haare?` | `wash_frequency` | `keep`, `lower prominence`, `reword` | It is the only visibly required ask on the crowded routine screen, even though its current product payoff is lower than some neighboring questions. | Requiredness feels arbitrary and increases perceived burden. | Keep it, but phrase it more concretely: `Wie oft wäschst du aktuell meistens?` Group it under `Dein Alltag` instead of giving it lone mandatory status. | Copy + layout | Fairness perception up, completion up |
| `Welche Produkte nutzt du aktuell?` | `current_routine_products` | `keep`, `reorder`, `clarify none-state` | The chip list is long and currently delivers limited recommendation value. | High scanning cost for a lower-value input creates drag. | Move it after behavioral routine questions. Add a clear fallback like `Keine feste Routine` or `Davon nutze ich aktuell nichts regelmäßig`. | Copy + flow + future logic | Completion up, data quality up |
| `Wie oft nutzt du Hitzetools?` | `heat_styling` | `keep`, `reorder`, `raise prominence` | This is more decision-relevant than it looks, but it visually blends into a crowded mixed-purpose screen. | Important inputs should not feel optional by accident. | Move it higher on the routine step and explicitly connect it to product weight and protection. | Copy + layout | Quality up, confidence up |
| `Was machst du nach dem Waschen?` | `post_wash_actions` | `keep`, `reword`, `raise prominence`, `clarify regularity` | The wording sounds like a one-time event even though the data is meant to represent recurring styling context. | Users may under-select or skip it even though it materially affects leave-in logic. | Reword to `Was kommt bei dir nach dem Waschen regelmäßig vor?` and keep multi-select. Make at least one response expected, or add a clear fallback option. | Copy + layout + future logic | Quality up, ambiguity down |
| `Wie detailliert soll deine Routine sein?` | `routine_preference` | `keep`, `reorder`, `reword` | This is a future-state output preference living on a current-state routine screen. | The user has to switch mental models from `Was mache ich?` to `Was wünsche ich mir?` mid-screen. | Move it to the goals screen and rename it to something output-centered such as `Wie aufwendig darf dein Plan sein?` | Copy + flow | Clarity up, completion up |
| `Wie viel Volumen willst du?` | `desired_volume`, derived `volume` goal | `keep`, `move earlier`, `deduplicate` | This is a strong, user-centered question, but it sits too late in the overall flow and duplicates the visible `Mehr Volumen` goal chip. | The best motivation lever arrives after lower-motivation diagnostic refinements, and the duplication wastes attention. | Make this part of the first onboarding screen. Do not also present `Mehr Volumen` as a visible secondary goal on that same path. | Flow + future logic | Motivation up, redundancy down |
| `Was ist dir ausserdem wichtig?` | `goals` | `rework`, `reword`, `clarify selection model` | The current goal list is texture-filtered so aggressively that valid user intent can disappear. | Users may feel the product is telling them what they should want instead of listening. | Replace hard filtering with relevance sorting. Ask one primary goal first: `Womit soll Hair Concierge starten?` Then allow optional extras. Keep texture as ranking, not exclusion. | Copy + flow + future logic | Relevance up, trust up, goal quality up |

## Handoff Findings

| Handoff | Affected fields | Current issue | Why it hurts | Recommended change | Change type | Expected impact |
|---|---|---|---|---|---|---|
| Results screen | All remaining onboarding fields | The screen feels complete, and the share CTA competes with continuation. | Users can mentally exit before the profile is actually complete. | Change the state from `done` to `almost done`: `Dein Profil ist fast fertig`. Show what remains in plain language and demote share until after onboarding completion. | Copy + flow | Completion up significantly |
| Welcome screen | All remaining onboarding fields | The screen repeats the job of the results screen and adds another click. | Extra clicks after a perceived completion point are expensive. | Remove the screen, or repurpose it as the quiz-aware auth transition if auth must remain separate. | Flow-only | Momentum up, completion up |
| Auth interruption | All remaining onboarding fields | The auth screen is generic and makes the user feel like they have left the quiz flow. | Asking for email in the quiz and then dropping the user into a generic auth wall breaks continuity. | Use a quiz-context auth state: `Profil speichern & weitermachen`. Prefill email, preserve quiz context, and default to the most likely action instead of a neutral tab choice. | Copy + flow + future auth logic | Completion up, trust up |
| Onboarding progression | All onboarding fields | Onboarding has no visible progress scaffold, especially on mobile where the left brand panel disappears. | Without progress, multi-screen personalization feels longer and less coherent than it is. | Add a lightweight top stepper with 3 steps and short purpose labels, for example `Ziele`, `Alltag`, `Feintuning`. | Layout + copy | Completion up, orientation up |

## Proposed V2 Flow

The v2 flow keeps the same goal: a complete first profile by the end of quiz + onboarding. The change is not what is collected, but how it is sequenced and explained.

### 1. Landing

- Set a more honest expectation:
  - `2 Minuten Diagnose`
  - `danach noch ca. 1 Minute für Ziele und Alltag`
- Replace `Du kannst nichts falsch machen` with guidance that reduces pressure:
  - `Ich leite dich Schritt für Schritt durch die Analyse.`

### 2. Quiz: Diagnose zuerst, aber in besserer Reihenfolge

Recommended order:

1. `SIND DEINE HAARE CHEMISCH BEHANDELT?`
2. `Wie schnell fetten deine Ansätze nach?` -> maps to `scalp_type`
3. Falls ja: `Hast du zusätzlich Beschwerden wie Schuppen, Juckreiz oder Rötungen?`
4. `Was ist deine natürliche Haartextur?`
5. `Wie dick sind deine einzelnen Haare?`
6. `Mini-Haarcheck 1 von 2: Oberfläche`
7. `Mini-Haarcheck 2 von 2: Zugtest`

Why this order is stronger:

- It opens with easy, factual wins.
- It asks scalp questions while the user is still thinking about observable behavior.
- It keeps the two hardest self-diagnostic checks together as one coherent mini-module.

### 3. Result and continuation

- Keep the profile payoff immediately after the quiz.
- Change the messaging from completion to continuation:
  - `Dein Profil ist fast fertig. Jetzt fehlen noch 3 kurze Schritte für Ziele, Alltag und Feintuning.`
- The primary CTA should directly continue into the quiz-aware auth state.
- If sharing remains important, move it after onboarding completion or reduce its visual weight on this screen.

### 4. Account continuation

- Remove the separate welcome screen as a standalone stop.
- If auth is still required at this point, make it feel like a continuation, not a detour:
  - `Profil speichern & weitermachen`
  - `Noch 3 kurze Schritte bis zu deinem vollständigen Profil`
- Preserve entered email and default to the most likely mode.
- The screen should explain why account creation happens here:
  - `Damit dein Profil gespeichert bleibt und deine Beratung darauf aufbauen kann.`

### 5. Onboarding: three coherent steps

#### Step 1: Ziele & Plan

Collect:
- `desired_volume`
- `goals`
- `routine_preference`

Recommended shape:
- Mandatory: `Wie viel Volumen willst du?`
- Mandatory: `Womit soll Hair Concierge zuerst starten?`
- Optional: `Was ist dir zusätzlich wichtig?`
- Mandatory: `Wie aufwendig darf dein Plan sein?`

Why this goes first:
- It is the most motivating part of onboarding.
- It frames the rest of the questions as personalization, not more testing.

#### Step 2: Dein Alltag

Collect:
- `heat_styling`
- `post_wash_actions`
- `wash_frequency`
- `current_routine_products`

Recommended shape:
- Ask behavior before inventory.
- Make recurring context explicit:
  - `Wie oft nutzt du Hitzetools?`
  - `Was kommt bei dir nach dem Waschen regelmäßig vor?`
  - `Wie oft wäschst du aktuell meistens?`
  - `Welche davon nutzt du regelmäßig?`

Why this grouping works:
- All questions are about current habits.
- The user does not have to switch between present-state and future-state thinking mid-screen.

#### Step 3: Feintuning

Collect:
- `density`
- `mechanical_stress_factors`

Recommended shape:
- Title example: `Zum Schluss noch 2 Dinge für das Feintuning`
- Explain the purpose directly:
  - `Damit Hair Concierge Produktgewicht und Belastung besser einschaetzen kann.`

Why this belongs last:
- These are valuable refiners, but low-emotion asks.
- Ending with a short refinement step is less costly than starting with one.

## Quick Wins Vs Structural Changes

### Quick Wins

- Rewrite scalp wording around observable behavior instead of abstract types.
- Reword the scalp follow-up as an additional complaint check.
- Move `routine_preference` onto the goals screen.
- Add onboarding progress framing with 3 steps.
- Change results and welcome copy so they do not imply completion too early.
- Remove the visible duplicate between `desired_volume` and the `Mehr Volumen` goal chip.
- Add explicit none-states where empty arrays are currently ambiguous.

### Structural Changes

- Re-sequence the quiz so easy, factual questions come before high-effort self-tests.
- Collapse the separate welcome screen into the results-to-auth transition.
- Replace the generic auth interruption with a quiz-aware continuation state.
- Rebuild onboarding around three mental models: `Ziele`, `Alltag`, `Feintuning`.
- Replace hard texture-based goal filtering with relevance sorting plus a primary-goal model.

## Risks And Dependencies

- Reframing the scalp question around observed oiling will require a new UI-to-`scalp_type` mapping in a future implementation phase.
- Removing or merging the welcome screen will change funnel instrumentation and auth entry behavior.
- Adding explicit none-states will improve data quality, but analytics and downstream interpretation must distinguish `none selected` from `not answered`.
- Reworking the goals UI will require coordination with `deriveOnboardingGoals` and any prompt or recommendation code that assumes the current goal-selection shape.
- If sharing is moved later, completion should improve, but result-page share behavior may drop. This is a deliberate tradeoff that needs product alignment.
- `routine_preference` and `current_routine_products` currently have lower direct matching value. If the product wants to keep asking them, the implementation should either reduce their UX weight or start using them more meaningfully downstream.
