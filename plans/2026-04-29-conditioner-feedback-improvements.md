# Conditioner Compare-Lab Feedback Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve conditioner Agent v1 behavior from the compare-lab findings: honor current-turn conditioner profile overrides, flag profile/message deviations, avoid unsupported color claims, listen before recommending in troubleshooting prompts, and produce nicer supported differentiators without defaulting to price.

**Architecture:** Keep the existing shampoo-style split: route packet detects current-message signals, `select_products` creates an effective turn profile, the recommendation engine stays deterministic, and playbooks constrain final wording. Conditioner remains the only new category touched. No new conditioner-specific damage layer is introduced.

**Tech Stack:** Next.js 16, TypeScript, Node test runner, Playwright, Supabase-backed product data, existing Agent v1 shadow/compare lab.

**Source Feedback:** `tmp/agent-compare-runs.jsonl` runs 1-10 from April 29, 2026.

---

## Alignment Summary

### Decisions

- Current-turn conditioner overrides must be honored before category decision and product selection.
- If a current-turn override conflicts with stored profile data, the answer should briefly acknowledge it in a friendly way.
- Color-treated or bleached requests are allowed to influence profile/damage context only if already present in the structured profile or derived assessment; they must not become product supported claims unless product data supports them.
- Ingredient requests remain unsupported requested signals for now.
- Troubleshooting-like conditioner prompts should first explain the likely issue and only then recommend, or withhold products if the user is not clearly asking for replacement.
- Product differentiators should prefer supported conditioner facts. Price is a last fallback, not the default answer texture.

### Non-Goals

- Do not implement other categories.
- Do not add ingredient-flag matching yet.
- Do not infer separate conditioner damage outside `DamageAssessment`.
- Do not make `density` or active damage drivers product supported claims.
- Do not make color protection a supported claim from product name, brand, marketing copy, or user wording.

### Open Risk

- If live product rows have many identical conditioner facts, the answer may still have limited differentiation. In that case, the correct behavior is to say the options are very similar on supported fit and use price only as a fallback.

---

## File Structure

### Modify

| Path | Responsibility |
|---|---|
| `src/lib/agent/tools/select-products.ts` | Apply conditioner active overrides, expose deviation notices, unsupported requested signals, and richer comparison facts |
| `src/lib/agent/orchestrator/route-packet.ts` | Improve active signal extraction for color/bleached phrasing and conditioner troubleshooting prompts if needed |
| `src/lib/agent/orchestrator/prompt.ts` | Require the final answer to mention profile deviations and listen before recommending |
| `data/agent-guidance/playbooks/recommend-products.md` | Product-pick wording guardrails for conditioner explanation order and unsupported claims |
| `data/agent-guidance/playbooks/compare-or-decide.md` | Comparison differentiator rules: supported facts first, price last fallback |
| `tests/agent-route-packet.spec.ts` | Route tests for color phrasing and troubleshooting intent/signal shape |
| `tests/agent-select-products-tool.spec.ts` | Unit tests for conditioner overrides, deviation notices, unsupported color/ingredient signals, differentiator facts |
| `tests/recommendation-engine-selection.test.ts` | Engine tests for override-driven conditioner target weight and thickness compatibility |
| `tests/chat-debug-trace.spec.ts` | Trace visibility for deviation / unsupported requested signals if persisted debug payload changes |
| `tests/conditioner-chat-e2e.spec.ts` | End-to-end regression for profile override and unsupported color request behavior |
| `tests/agent-compare-product-trace.spec.ts` | Compare-lab schema coverage if product trace gains new fields |

---

## Task 1: Honor Conditioner Current-Turn Overrides

**Goal:** If the user says “feines Haar” during a conditioner request and their profile says `normal`, selection should use `fine` for this turn and derive conditioner weight from the effective `thickness + density`.

**Files:**
- Modify: `src/lib/agent/tools/select-products.ts`
- Test: `tests/agent-select-products-tool.spec.ts`
- Test: `tests/recommendation-engine-selection.test.ts`

- [ ] **Step 1: Add failing tool test for conditioner thickness override**

Add a test near the conditioner projection tests in `tests/agent-select-products-tool.spec.ts`:

```ts
test("createSelectProductsTool applies conditioner thickness overrides before selection", async () => {
  const result = await createSelectProductsTool()({
    category: "conditioner",
    message: "Welche Spülung passt zu meinem feinen Haar, ohne es zu beschweren?",
    hairProfile: createHairProfile({
      thickness: "normal",
      density: "medium",
      protein_moisture_balance: "snaps",
      cuticle_condition: "slightly_rough",
    }),
    memoryContext: createEmptyMemoryContext(),
    routineItems: [],
    userJob: "product_pick",
    activeProfileSignals: [
      {
        field: "thickness",
        value: "fine",
        source: "message",
        selection_effect: "override",
        evidence: "feines Haar",
      },
    ],
  })

  expect(result.profile_basis).toContain("Haardicke: Fein")
  expect(result.profile_basis).toContain("Profil-Hinweis: aktuelle Angabe Haardicke Fein statt gespeichert Mittel")
  expect(result.profile_basis).toContain("Ziel-Gewicht: Leicht")
  expect(
    result.products.flatMap((product) => product.supported_claims).some(
      (claim) => claim.field === "thickness" && claim.value === "normal",
    ),
  ).toBe(false)
})
```

Expected initial result: fails because conditioner currently does not apply active overrides.

- [ ] **Step 2: Implement conditioner override application**

In `src/lib/agent/tools/select-products.ts`, extend `applyActiveProfileOverrides` with a conditioner branch:

```ts
function applyConditionerActiveOverrides(
  hairProfile: HairProfile | null,
  activeSignals: readonly AgentActiveProfileSignal[],
): HairProfile | null {
  if (!hairProfile) return null

  const next: HairProfile = { ...hairProfile }

  for (const signal of activeSignals) {
    if (signal.selection_effect !== "override" && signal.selection_effect !== "caution") continue

    if (
      signal.field === "thickness" &&
      (signal.value === "fine" || signal.value === "normal" || signal.value === "coarse")
    ) {
      next.thickness = signal.value
    }
  }

  return next
}
```

Then route conditioner through it:

```ts
if (params.category === "conditioner") {
  return applyConditionerActiveOverrides(params.hairProfile, params.activeSignals)
}
```

Do not override `density` unless a current route signal already reliably extracts density; missing density remains defensive fallback only.

- [ ] **Step 3: Add engine/reranker test for override-driven target weight**

In `tests/recommendation-engine-selection.test.ts`, add a selector-level test that creates a profile with stored `normal + medium`, applies the tool with active `fine`, and verifies the selected conditioner target uses `light` rather than `medium`.

Expected: fine + medium density maps to `light`; medium products should no longer be described as ideal for fine hair unless they are fallback/close according to structured fit.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts tests/recommendation-engine-selection.test.ts
```

Expected: all tests pass.

---

## Task 2: Add Profile Deviation Notices

**Goal:** When the message overrides a stored profile invariant for the current turn, the trace and answer should explicitly show that the system noticed and honored the current message.

**Files:**
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Test: `tests/agent-select-products-tool.spec.ts`
- Test: `tests/agent-shadow.spec.ts`

- [ ] **Step 1: Add projection field or profile-basis notice**

Prefer the smallest contract change: add a human-readable notice to `profile_basis` rather than adding a new top-level field.

Format:

```ts
Profil-Hinweis: aktuelle Angabe Haardicke Fein statt gespeichert Mittel
```

Use existing labels from `HAIR_THICKNESS_LABELS`.

- [ ] **Step 2: Implement helper for deviation notices**

In `src/lib/agent/tools/select-products.ts`, add:

```ts
function buildProfileDeviationNotices(params: {
  originalHairProfile: HairProfile | null
  effectiveHairProfile: HairProfile | null
  activeSignals: readonly AgentActiveProfileSignal[]
}): string[] {
  if (!params.originalHairProfile || !params.effectiveHairProfile) return []

  const notices: string[] = []
  for (const signal of params.activeSignals) {
    if (signal.selection_effect !== "override") continue
    if (signal.field !== "thickness") continue

    const original = params.originalHairProfile.thickness
    const effective = params.effectiveHairProfile.thickness
    if (!original || !effective || original === effective) continue

    notices.push(
      `Profil-Hinweis: aktuelle Angabe Haardicke ${
        HAIR_THICKNESS_LABELS[effective] ?? effective
      } statt gespeichert ${HAIR_THICKNESS_LABELS[original] ?? original}`,
    )
  }
  return notices
}
```

Thread the original profile into the projection call or compute notices before `projectSelectedProducts`, then include them in conditioner `profile_basis`.

- [ ] **Step 3: Update prompt wording guardrail**

In `src/lib/agent/orchestrator/prompt.ts`, add a compact instruction:

```md
- Wenn `select_products.profile_basis` einen `Profil-Hinweis:` enthaelt, erwaehne ihn kurz zu Beginn: Du richtest diese Antwort nach der aktuellen Angabe aus, ohne das gespeicherte Profil dauerhaft zu aendern.
```

- [ ] **Step 4: Add shadow test with fake model**

In `tests/agent-shadow.spec.ts`, add a fake model scenario where the tool result includes `Profil-Hinweis:` and assert the final answer generated by the fake model receives the tool payload. The core assertion can stay on tool payload visibility if the fake model does not synthesize copy.

- [ ] **Step 5: Run focused tests**

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts tests/agent-shadow.spec.ts
```

Expected: all tests pass.

---

## Task 3: Improve Unsupported Color / Bleached Signals

**Goal:** Requests like “coloriertem, strapaziertem Haar” and “gefärbten Haaren” should surface `chemical_treatment=colored` as a qualifier. Product answers must not claim color protection unless supported by structured product data.

**Files:**
- Modify: `src/lib/agent/orchestrator/route-packet.ts`
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `data/agent-guidance/playbooks/recommend-products.md`
- Test: `tests/agent-route-packet.spec.ts`
- Test: `tests/agent-select-products-tool.spec.ts`

- [ ] **Step 1: Add failing route tests for German color phrasing**

In `tests/agent-route-packet.spec.ts`, add cases:

```ts
const coloredAdjectivePacket = buildAgentRoutePacket({
  message: "Welche Spülung passt zu coloriertem, strapaziertem Haar?",
  userContext: createContext(),
  classification: createClassification({
    user_job: "product_pick",
    product_category: "conditioner",
    active_profile_signals: [],
  }),
})

assert.deepEqual(
  coloredAdjectivePacket.active_profile_signals.map((signal) => [
    signal.field,
    signal.value,
    signal.selection_effect,
  ]),
  [["chemical_treatment", "colored", "qualifier"]],
)
```

Expected initial result: fails if current regex does not catch comma-separated adjective phrasing.

- [ ] **Step 2: Broaden color regex without overmatching**

In `deriveActiveProfileSignalsFromMessage`, extend the color rule to catch:

- `coloriertem Haar`
- `coloriertem, strapaziertem Haar`
- `gefärbten Haaren`
- ASCII variants already used in tests

Keep it scoped to hair words within a short window:

```ts
if (
  /\b(?:coloriert\w*|gefarbt\w*|gefaerbt\w*)\b.{0,50}\b(?:haar\w*|haaren|laeng\w*|lang\w*)\b/.test(normalized) ||
  /\b(?:haar\w*|haaren|laeng\w*|lang\w*)\b.{0,50}\b(?:coloriert\w*|gefarbt\w*|gefaerbt\w*)\b/.test(normalized)
) {
  addSignal("chemical_treatment", "colored", "qualifier", "coloriertes Haar")
}
```

- [ ] **Step 3: Ensure conditioner unsupported signal includes chemical treatment qualifiers**

`buildUnsupportedRequestedSignals` already handles qualifier signals. Confirm conditioner passes active profile signals through unchanged and that no conditioner supported claim has `chemical_treatment`.

Expected product trace:

```json
{
  "field": "chemical_treatment",
  "value": "colored",
  "reason": "no_structured_product_data"
}
```

- [ ] **Step 4: Strengthen playbook claim boundary**

In `data/agent-guidance/playbooks/recommend-products.md`, add:

```md
- Bei coloriertem/blondiertem Haar: Wenn `unsupported_requested_signals` Farbschutz oder Blondierung enthaelt, nicht behaupten, dass ein Produkt Farbe schuetzt oder speziell fuer coloriertes Haar belegt ist. Sage kurz, dass diese Eigenschaft aktuell nicht sicher in den Produktdaten steckt, und begruende die Auswahl nur mit belegtem Fit.
```

- [ ] **Step 5: Run focused tests**

```bash
npx tsx --test tests/agent-route-packet.spec.ts tests/agent-select-products-tool.spec.ts
```

Expected: all tests pass.

---

## Task 4: Listen Before Recommending For Conditioner Troubleshooting

**Goal:** Prompts such as “macht platt, soll ich wechseln?” and “Spliss und trockene Spitzen” should first acknowledge/analyze the issue before listing products. The agent should not sound like it jumped straight into a catalog.

**Files:**
- Modify: `src/lib/agent/orchestrator/route-packet.ts`
- Modify: `src/lib/agent/orchestrator/prompt.ts`
- Modify: `data/agent-guidance/playbooks/recommend-products.md`
- Test: `tests/agent-route-packet.spec.ts`
- Test: `tests/agent-shadow.spec.ts`

- [ ] **Step 1: Add route expectation for flattening prompt**

In `tests/agent-route-packet.spec.ts`, add:

```ts
const flatConditionerPacket = buildAgentRoutePacket({
  message: "Mein Conditioner macht die Haare platt, soll ich wechseln?",
  userContext: createContext(),
  classification: createClassification({
    user_job: "troubleshoot_hair_issue",
    product_category: "conditioner",
    active_profile_signals: [],
  }),
})

assert.equal(flatConditionerPacket.user_job, "troubleshoot_hair_issue")
assert.equal(flatConditionerPacket.product_category, "conditioner")
assert.deepEqual(flatConditionerPacket.tool_plan, [])
```

If preserving `compare_or_decide` is easier with the current classifier, the acceptable alternative is: no `select_products` unless the message contains explicit replacement wording such as “empfiehl”, “welchen soll ich nehmen”, or “ich will wechseln”.

- [ ] **Step 2: Add deterministic guard in route packet if classifier over-selects**

In route normalization, detect conditioner flattening/troubleshooting phrasing:

```ts
const isConditionerTroubleshootingWithoutExplicitReplacement =
  productCategory === "conditioner" &&
  /\bconditioner|spuelung|spulung\b/.test(normalizedMessage) &&
  /\b(platt|beschwert|schwer|fettig|belegt)\b/.test(normalizedMessage) &&
  !/\b(empfiehl|empfehlen|welchen|welche|wechseln zu|alternative)\b/.test(normalizedMessage)
```

Set `user_job` to `troubleshoot_hair_issue`, `required_playbook_id` to the troubleshooting playbook if available, and clear `select_products` from `tool_plan`.

- [ ] **Step 3: Update prompt/playbook style rule**

In `prompt.ts` and `recommend-products.md`, add:

```md
- Bei Conditioner-Problemen wie platt, beschwert, Spliss oder trockenen Spitzen: Erst 1-2 Saetze zur Einordnung. Erklaere knapp, was Conditioner leisten kann und was nicht. Danach nur Produkte nennen, wenn `select_products` Produkte liefert oder der Nutzer klar nach Wechsel/Empfehlung fragt.
```

For Spliss wording, require:

```md
Spliss kann nicht dauerhaft repariert werden; Conditioner kann Spitzen geschmeidiger machen, Reibung reduzieren und weiteren Bruch begrenzen.
```

- [ ] **Step 4: Add shadow test for no product tool on flattening prompt**

In `tests/agent-shadow.spec.ts`, add a fake model run that classifies the flattening prompt and assert no `select_products` call is required after route packet normalization.

- [ ] **Step 5: Run focused tests**

```bash
npx tsx --test tests/agent-route-packet.spec.ts tests/agent-shadow.spec.ts
```

Expected: all tests pass.

---

## Task 5: Improve Conditioner Differentiators Without Defaulting To Price

**Goal:** Comparisons should produce helpful differentiators from supported facts first. Price appears only when supported fit facts are identical or insufficient.

**Files:**
- Modify: `src/lib/agent/tools/select-products.ts`
- Modify: `data/agent-guidance/playbooks/compare-or-decide.md`
- Test: `tests/agent-select-products-tool.spec.ts`
- Test: `tests/agent-compare-product-trace.spec.ts`

- [ ] **Step 1: Add comparison facts test for non-price differentiators**

In `tests/agent-select-products-tool.spec.ts`, add a conditioner comparison test with products that differ by:

- `product_balance_direction`
- `product_weight`
- `product_repair_level`
- fallback caveat / fit status

Expected each product has max 2 facts, with priority:

1. balance direction
2. weight
3. repair level
4. fit status/caveat
5. price fallback

- [ ] **Step 2: Adjust fact builder to avoid low-value identical facts**

In `buildConditionerComparisonFactsForSet`, keep the existing priority but prefer facts that actually differentiate the set. For each candidate field:

```ts
const valuesByKey = new Map<string, Set<string>>()
for (const row of factRows) {
  for (const candidate of row.candidates) {
    if (!candidate) continue
    const values = valuesByKey.get(candidate.key) ?? new Set<string>()
    values.add(candidate.value)
    valuesByKey.set(candidate.key, values)
  }
}
```

When building final facts:

- include a candidate if `valuesByKey.get(candidate.key)?.size > 1`
- include `fit_status/caveat` if any option is fallback, supportive, unknown, or mismatch
- include non-differentiating facts only if otherwise the product would have no facts and the field is still useful context
- add price only after all supported conditioner facts are exhausted

- [ ] **Step 3: Add “similar fit” behavior to playbook**

In `compare-or-decide.md`, add:

```md
- Wenn die `comparison_facts` nur wenige Unterschiede zeigen, sage das offen: "Vom belegten Fit her sind diese Optionen sehr aehnlich." Dann nenne die wenigen belegten Unterschiede. Preis nur nennen, wenn er in `comparison_facts` steht oder keine fachlichen Differenzierer verfuegbar sind.
```

- [ ] **Step 4: Keep max 2 facts per product**

Assert in tests:

```ts
for (const facts of Object.values(result.comparison_facts ?? {})) {
  expect(facts.length).toBeLessThanOrEqual(2)
}
```

- [ ] **Step 5: Run focused tests**

```bash
npx tsx --test tests/agent-select-products-tool.spec.ts tests/agent-compare-product-trace.spec.ts
```

Expected: all tests pass.

---

## Task 6: Compare-Lab Regression Pass

**Goal:** Re-run the exact feedback prompts and verify the findings have improved.

**Files:**
- Modify tests only if existing expectations need trace field updates.
- Do not change production behavior in this task.

- [ ] **Step 1: Run static verification**

```bash
npm run typecheck
npm run lint
```

Expected: typecheck passes; lint has no new errors. Existing warnings may remain if unrelated.

- [ ] **Step 2: Run focused Node tests**

```bash
npx tsx --test tests/agent-route-packet.spec.ts tests/agent-select-products-tool.spec.ts tests/recommendation-engine-selection.test.ts tests/agent-shadow.spec.ts tests/agent-compare-product-trace.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Run browser/debug tests**

```bash
npx playwright test tests/chat-debug-trace.spec.ts tests/conditioner-chat-e2e.spec.ts --reporter=line
```

Expected: all pass.

- [ ] **Step 4: Manual compare-lab smoke**

Use `http://localhost:3723/labs/agent-compare` and rerun:

```text
Welche Spülung passt zu meinem feinen Haar, ohne es zu beschweren?
Welche Spülung passt zu coloriertem, strapaziertem Haar?
Vergleich mir bitte zwei passende Conditioner für feines Haar.
Mein Conditioner macht die Haare platt, soll ich wechseln?
Welche Spülung passt, wenn ich Spliss und trockene Spitzen habe?
Welchen silikonfreien Conditioner empfiehlst du mir?
Welcher Conditioner hilft gegen juckende Kopfhaut?
```

Expected:

- fine-hair prompts show profile deviation copy and use light target fit where data allows
- color request flags unsupported color-specific product claims
- flattening prompt explains first and does not jump straight into products unless replacement is explicit
- split-ends prompt listens first, says conditioner can help manage/protect but cannot truly repair split ends
- silicone-free remains unsupported ingredient preference
- scalp-only conditioner remains `not_recommended` with no products
- comparisons use supported differentiators before price

---

## Suggested Implementation Order

1. Task 1 and Task 2 together, because override behavior and deviation copy are coupled.
2. Task 3, because unsupported color claims are a separate product-claim boundary.
3. Task 4, because it may require route/playbook tuning and should be tested independently.
4. Task 5, because differentiator quality is safest after the trace semantics are stable.
5. Task 6 as final verification.

## Success Criteria

- The agent no longer says “fine hair” while selecting medium-thickness conditioner fits without caveat.
- Profile conflict is visible and kind, not accusatory.
- Unsupported color/bleached/ingredient requests appear as unsupported requested signals, not product claims.
- Troubleshooting answers feel like they heard the user before recommending.
- Conditioner comparisons have useful, supported differences; price appears only when the data leaves no better differentiator.
- All targeted tests and compare-lab smoke checks pass.
