# Agentic Tool Loop Compare Lab Seed Set

Purpose: lean development seed for `/labs/agent-compare`, not an audit gate. Use these cases to smoke-test `classic` vs `tool_loop` behavior while the prototype is being built.

## Review Notes

- Run as blinded comparisons when the UI supports it.
- Prefer multi-turn chains where listed; each turn should carry the same simulated state forward for both systems.
- Expected coverage labels are development hints, not pass/fail assertions.
- Production rollout still needs held-out real turns and the rollout gate in `docs/langfuse-quality-loop.md`.

## Seed Cases

| ID | Type | Turns | Coverage |
| --- | --- | --- | --- |
| atl-seed-01 | Multi-turn | `Kannst du mir eine einfache Routine bauen?` -> `Ich wasche alle 3 Tage, nutze Shampoo und Conditioner, meine Spitzen sind trocken.` -> `ok und welcges Shampoo insbesondere sollte ich verwenden` | routine -> product category switch; known typoed shampoo failure; `select_products` should be chosen |
| atl-seed-02 | Multi-turn | `Welches Shampoo passt am besten zu mir?` -> `Warum nicht ein Tiefenreinigungsshampoo?` | product recommendation -> comparison/refinement; avoid unsupported deep-cleansing push |
| atl-seed-03 | Multi-turn | `Welche Spuelung passt zu feinem Haar, ohne es zu beschweren?` -> `Und wie oft sollte ich die benutzen?` | usage follow-up after product recommendation; no duplicate product selection unless needed |
| atl-seed-04 | Multi-turn | `Welches Leave-in passt zu meinem Profil?` -> `Welches davon ist leichter?` -> `Wie trage ich es auf?` | pronoun/comparison/usage follow-ups after recommendation |
| atl-seed-05 | Multi-turn | `Ich brauche eine Routine gegen Frizz.` -> `Mach sie bitte minimalistischer.` -> `Fass mir kurz zusammen, was ich morgens und am Waschtag mache.` | routine refinement and recap |
| atl-seed-06 | Single-turn | `welche maske nihmst du bei trockenen laengen und blondierung` | typoed category ask; product tool selection |
| atl-seed-07 | Multi-turn | `Empfiehl mir ein Oel fuer meine Spitzen.` -> `Ist das besser vor oder nach dem Waschen?` | product recommendation -> usage follow-up; keep oil topic |
| atl-seed-08 | Multi-turn | `Welche Produkte passen zu mir?` -> `Ich meinte nur Shampoo.` | broad ask -> category narrowing |
| atl-seed-09 | Multi-turn | `Ich will jetzt nichts kaufen. Wie föhne ich schonender?` -> `Und welche Buerste passt dazu?` | tool-less topic pivot; clear stale product topic |
| atl-seed-10 | Multi-turn | `Kannst du meine Routine reparieren?` -> `Ich habe Shampoo, Conditioner und manchmal Maske.` -> `Welche Maske konkret?` | routine -> product category switch |
| atl-seed-11 | Single-turn | `Vergleich mir bitte Shampoo und Conditioner fuer mein feines Haar.` | combined comparison boundary; only call supported tools when categories are concrete |
| atl-seed-12 | Multi-turn | `Welches Shampoo soll ich nehmen?` -> `ok und das andere?` | pronoun/ellipsis follow-up; preserve last product category |
| atl-seed-13 | Multi-turn | `Brauche ich einen Bondbuilder?` -> `Oder reicht eine Maske?` | adjacent category comparison; avoid invented repair claims |
| atl-seed-14 | Single-turn | `Kannst du nochmal knapp wiederholen, was du empfohlen hast?` | summary/recap without new tools when prior context is enough |
| atl-seed-15 | Single-turn | `Meine Kopfhaut juckt stark und ich verliere Haare, welches Shampoo heilt das?` | medically adjacent safety caveat; avoid hard medical/product cure claims |

## Starter Smoke Pass

For the first prototype pass, run at least:

1. `atl-seed-01`
2. `atl-seed-03`
3. `atl-seed-04`
4. `atl-seed-09`
5. `atl-seed-14`

These five cover the smallest set of behaviors that can reveal whether the tool loop actually improves multi-turn semantic ownership: category switch, usage follow-up, pronoun follow-up, tool-less pivot, and recap.

## Agentic Consultation Brief V1 Smoke Pack

Run in `/labs/agent-compare` with tool-loop variant `Beratungsbrief` / `inline_context`.

1. Broad routine staging
   - `ich möchte meine routine anpassen`
   - Expected tool_loop shape: starts with shampoo, conditioner, and one highest-impact extra lever; does not dump every optional module; asks whether to go toward goals or problems.

2. Conceptual leave-in follow-up
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `ja ich habe gehört leave in soll gut sein`
   - Expected tool_loop shape: educates on leave-in as a light booster; no product list unless user asks for products.

3. Explicit leave-in product ask
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `ja ich habe gehört leave in soll gut sein`
   - Turn 3: `ok welches leave in kannst du empfehlen`
   - Expected tool_loop shape: calls `select_products(leave_in)` and names products using supported claims.

4. Explicit shampoo ask with better-lever caveat
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `ja ich habe gehört leave in soll gut sein`
   - Turn 3: `ja oder ich änder erstmal mein shampoo, welches kannst du empfehlen`
   - Expected tool_loop shape: recommends shampoo products if available, then caveats that shine/frizz/dry lengths usually respond more to conditioner, leave-in, mask, or technique.

5. Conceptual mask necessity
   - Turn 1: `ich möchte meine routine anpassen`
   - Turn 2: `eine maske brauche ich also nicht?`
   - Expected tool_loop shape: says mask is optional extra length care; no product list unless asked.

## Agentic Consultant Rendering And Conceptual Guard Verification

Run in `/labs/agent-compare`.

Settings:
- Tool-Loop: `Beratungsbrief`
- Mehrturn-Test: on for multi-turn cases
- Geblendet: optional for subjective judging; off is acceptable when inspecting traces

1. Broad routine improvement
   - User: `Nick Rupprechter · straight · fine`
   - Turns: `wie kann ich meine routine verbessern`
   - Expected: Tool Loop keeps the deterministic basics, explains why the selected third lever appears, and ends with a useful next step instead of generic "weitere Fragen".

2. Daily coconut oil routine adjustment
   - User: `Phil Dörrenhaus · curly · normal`
   - Turns: `ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen`
   - Expected: Tool Loop may keep `Haar-Reset / Tiefenreinigung` if selected by the tool, but explains it as cleanup/reset and mentions lighter leave-in/finish as the likely everyday replacement for daily oil.

3. Conceptual leave-in curiosity
   - User: `Nick Rupprechter · straight · fine`
   - Turns:
     - `ich will meine routine anpassen`
     - `ja ich habe gehört leave in soll gut sein`
   - Expected: Tool Loop does not recommend product names; it explains the leave-in role and offers product picks as a next step.

4. Explicit leave-in product ask
   - User: `Nick Rupprechter · straight · fine`
   - Turns:
     - `ich will meine routine anpassen`
     - `ja ich habe gehört leave in soll gut sein`
     - `ok welcher leave-in passt?`
   - Expected: Tool Loop calls `select_products(leave_in)` or asks one blocking profile question if required.

5. Leave-in missing-info carry
   - User: `Phil Dörrenhaus · curly · normal`
   - Turns:
     - `ich nutze kokosöl jeden tag und hab gehört, das sei nicht so gut. wie kann ich routine anpassen`
     - `ok und wekcher leave-in passt?`
     - `mittlere dichte`
   - Expected: Tool Loop keeps the leave-in request in mind and recommends leave-in products after density is supplied.

6. Explicit shampoo ask with caveat
   - User: `Nick Rupprechter · straight · fine`
   - Turns:
     - `ich will meine routine anpassen`
     - `ja ich habe gehört leave in soll gut sein`
     - `ja oder ich änder erstmal mein shampoo, welches kannst du empfehlen`
   - Expected: Tool Loop recommends shampoo products when catalog data supports them and includes a soft caveat that shampoo is not the strongest lever for length goals.

## May 11 Advisor Guidance Verification

Primary setting:
- Compare Lab: `/labs/agent-compare`
- Variant under test: `tool_loop` with `Kontext Inline`
- Baseline: Classic/current system
- Composer: available for experiment only; not required for this verification

Cases:

1. Leave-in best picks with existing heat protection
   - Prompt: `was sind die besten leave ins fuer mich`
   - Expected tool_loop: calls `select_products(leave_in)`, preserves product order, explains whether a heat-protecting leave-in can mean "ein Produkt weniger in der Routine" when supported, and says separate heat protection can also stay.

2. Leave-in importance after product context
   - Prompt: `ok waere es wichtig einen in meine routine zu integrieren?`
   - Expected tool_loop: no new product list; direct answer, category role, profile reason, practical use/limit, one next step.

3. More products besides shampoo
   - Prompt: `andere produkte zusaetzlich zu shampoo?`
   - Expected tool_loop: uses `build_or_fix_routine` basics; answer transitions naturally into the basics, is category-level with Shampoo, Conditioner, and the authoritative priority lever, asks whether to continue by goals or problems, and does not include concrete product picks.

4. Mask instead of leave-in
   - Prompt: `aber maske nicht stattdessen?`
   - Expected tool_loop: conceptual comparison; no mask product picks unless explicitly requested; clear mask is optional Zusatzpflege and leave-in is everyday/finish support when profile says so.

5. Oil product follow-up
   - Prompt sequence: `ok also haaroel hilft nicht?` -> `ok und welches passt dann zu mir` -> `ich wills fuer mehr glanz und feuchtigkeit in den spitzen verwenden`
   - Expected tool_loop: first turn educational; second asks for oil purpose if missing; third recommends oil products in tool order.
