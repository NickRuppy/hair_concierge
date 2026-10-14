# Profile care display / vocabulary duplicate cohort

Decision: 3 D, 27 R, 0 F, 0 C across 30 complete declarations. All three deletions are same-file, same-lane, existing-input strict duplication. No transfers, new calls, fixtures, scenarios, rows, skips or packing required. This is a bounded modest reduction, not a substantial new tranche. Main owns acceptance and all verification/mutations.

Pinned branch codex/test-audit-pruning, HEAD 21e0e41fa996ec6a725c258ab3766971f0edb94d. All three cohort files equal HEAD at handback. Full original files, callback bodies, hashes and five exact parseable source-fault suggestions are in /tmp/profile-care-cohort-evidence.json. Prospective cut files exist only under /tmp and statically parse (18→16, 5→5, 7→6).

## All-declaration ledger

### tests/profile-plan-overlay.test.ts

SHA256 1beaaee100327de0d9f087eaa339d2b9aee0f61299f97e0ed7c5f00fc335e9fb

| Line | Class | Complete title | Reason |
|---|---|---|---|
| 20 | R | towel material falls back to plan answer | Plan-only frottee material label; unlike legacy precedence and no-towel inputs. |
| 25 | R | legacy value wins over plan answer | Actual legacy mikrofaser takes precedence over conflicting frottee plan; independent precedence branch. |
| 32 | R | empty additionalHeatTools reads as answered none | Explicit empty additionalHeatTools is answered none; absent tools must stay null. |
| 36 | R | empty nightProtection reads as answered none | Explicit empty nightProtection is answered none; absent nightProtection must stay null. |
| 40 | R | drying routes join labels | Nonempty air_dry plan array projects through dedicated drying-route label map. |
| 44 | R | present-but-empty drying routes reads as answered none | Present empty dryingRoutes is answered none; retain distinction from missing routes. |
| 48 | D | undefined drying routes stays null | D1: Exact same dryingMethodField.getValue(null, {}) call and null assertion already last assertion in callback 8. |
| 52 | R | unanswered plan leaves value null | Keeper D1; independently checks null plan and absent per-field properties using five existing calls. |
| 60 | R | towel technique falls back to plan answer | Explicit plan gentle_press technique label is different branch from no_towel implicit technique. |
| 69 | R | towel material and technique resolve as a unit — legacy technique signal blocks plan material | Legacy technique-only signal blocks conflicting plan material for the whole towel unit. |
| 79 | R | towel material and technique resolve as a unit — pure plan no_towel | Keeper D2; null legacy profile, plan material no_towel, no technique; existing actual technique call equals donor. |
| 89 | D | plan-derived no_towel material implies no technique needed | D2: Same runtime input {towel:{material:"no_towel"}}, null legacy profile and expected technique as callback 11. |
| 94 | R | plan additional heat tools map to Alltag/Styling labels | Straightener plan key uses dedicated heat-tool label mapping; not equivalent to empty heat tools. |
| 100 | R | plan night protection maps to existing labels | Nonempty pineapple plan array maps labels; not equivalent to explicit empty or legacy accessory. |
| 114 | R | selectPlanProductRows falls back to routine products when legacy rows are empty | Nonempty routine products fall back when legacy row count zero; only success branch. |
| 118 | R | selectPlanProductRows stays null when legacy rows exist | Legacy row count one suppresses nonempty routine fallback; independent precedence. |
| 122 | R | selectPlanProductRows stays null without an active routine | Null routine means no active routine; preserve explicit null input. |
| 126 | R | selectPlanProductRows falls through to the empty state for a present-but-empty routine | Present empty routine array must not show a blank Personal Plan badge; distinct from null input. |

### tests/profile-section-config.test.ts

SHA256 c9f38b596e41ed06a4b9d4e38d67f859ee7aa8e9fc4b717d48127dc82379fd6f

| Line | Class | Complete title | Reason |
|---|---|---|---|
| 44 | R | profile shows no towel technique as an answered editable value | Legacy no_towel profile has an editable target and implicit technique; keep separate from null-profile plan overlay. |
| 63 | R | profile quiz section includes editable hair length after density | Quiz field position, exact label, edit target and legacy long-length label are independent display contracts. |
| 75 | R | profile routine section shows length tip accessory night protection label | Legacy profile length_tip_accessory projects to user-facing label; not just vocabulary constant identity. |
| 87 | R | profile routine section distinguishes unanswered brush type from explicit none | Legacy brush null, explicit empty, and multi-value arrays have independent null/none/list semantics. |
| 99 | R | goals edit derives persisted desired volume from selected goals | Persisted desired-volume projection for more/less/unrelated/empty goals calls actual derived helper. |

### tests/onboarding-care-vocabulary.test.ts

SHA256 a18fcfa8554004bb8bd05fc9b6fdfdca4f2f112a3ab53189cd81b2e6b1a166f0

| Line | Class | Complete title | Reason |
|---|---|---|---|
| 14 | R | towel technique canonicalizes legacy German values | Legacy German towel values normalize to canonical keys; real hydration and save callers remain. |
| 19 | R | towel technique options expose language-independent data keys | Exact canonical towel technique option list is not implied by mapping two legacy inputs. |
| 23 | R | towel material options include no towel as the final explicit option | Exact towel material options, no-towel label and drying-air icon combine distinct data owners. |
| 38 | R | night protection canonicalizes legacy loose braid and bun values | Legacy braid and bun individually map and combined input deduplicates; real persisted callers remain. |
| 44 | D | night protection options expose only the canonical loose tied value | D3: Keeper callback 6 asserts exact same plain array equals [silk_satin_pillow,silk_satin_bonnet,loose_tied,pineapple,length_tip_accessory], implying all three membership assertions. |
| 50 | R | night protection options include length tip accessory and remove tight hairstyles | Keeper D3; full canonical array plus accessory/bonnet/pineapple labels and exclusion of tight styles. |
| 67 | R | night protection normalization drops legacy tight hairstyles | Legacy tight styles dropped alone and when mixed with canonical input; real persisted consumers remain. |

## Complete donor/keeper unions

### D1

Donor tests/profile-plan-overlay.test.ts:48. D1: Exact same dryingMethodField.getValue(null, {}) call and null assertion already last assertion in callback 8.

```ts
test("undefined drying routes stays null", () => {
  assert.equal(dryingMethodField.getValue(null, {}), null)
})
```

Existing unchanged keeper tests/profile-plan-overlay.test.ts:52:

```ts
test("unanswered plan leaves value null", () => {
  assert.equal(towelMaterialField.getValue(null, null), null)
  assert.equal(towelMaterialField.getValue(null, {}), null)
  assert.equal(stylingToolsField.getValue(null, {}), null)
  assert.equal(nightProtectionField.getValue(null, {}), null)
  assert.equal(dryingMethodField.getValue(null, {}), null)
})
```

### D2

Donor tests/profile-plan-overlay.test.ts:89. D2: Same runtime input {towel:{material:"no_towel"}}, null legacy profile and expected technique as callback 11.

```ts
test("plan-derived no_towel material implies no technique needed", () => {
  const value = towelTechniqueField.getValue(null, { towel: { material: "no_towel" } })
  assert.equal(value, "Keine Trocknungstechnik")
})
```

Existing unchanged keeper tests/profile-plan-overlay.test.ts:79:

```ts
test("towel material and technique resolve as a unit — pure plan no_towel", () => {
  const plan = { towel: { material: "no_towel" as const } }

  assert.equal(
    towelMaterialField.getValue(null, plan),
    "Kein Handtuch: Ich lasse meine Haare tropfnass trocknen",
  )
  assert.equal(towelTechniqueField.getValue(null, plan), "Keine Trocknungstechnik")
})
```

### D3

Donor tests/onboarding-care-vocabulary.test.ts:44. D3: Keeper callback 6 asserts exact same plain array equals [silk_satin_pillow,silk_satin_bonnet,loose_tied,pineapple,length_tip_accessory], implying all three membership assertions.

```ts
test("night protection options expose only the canonical loose tied value", () => {
  assert.ok(NIGHT_PROTECTIONS.includes("loose_tied"))
  assert.ok(!NIGHT_PROTECTIONS.includes("loose_braid" as never))
  assert.ok(!NIGHT_PROTECTIONS.includes("loose_bun" as never))
})
```

Existing unchanged keeper tests/onboarding-care-vocabulary.test.ts:50:

```ts
test("night protection options include length tip accessory and remove tight hairstyles", () => {
  assert.deepEqual(NIGHT_PROTECTIONS, [
    "silk_satin_pillow",
    "silk_satin_bonnet",
    "loose_tied",
    "pineapple",
    "length_tip_accessory",
  ])
  assert.equal(
    NIGHT_PROTECTION_LABELS.length_tip_accessory,
    "Längen-/Spitzenschutz (z. B. HairHOMIE)",
  )
  assert.equal(NIGHT_PROTECTION_LABELS.silk_satin_bonnet, "Bonnet / Schlafhaube")
  assert.equal(NIGHT_PROTECTION_LABELS.pineapple, "Pineapple")
  assert.ok(!NIGHT_PROTECTIONS.includes("tight_hairstyles" as never))
})
```

## Actual owner and input audit

D1: PROFILE_FIELD_CONFIG is the actual exported array, not a fake. getField searches by exact key and asserts existence; dryingMethodField captures that same object. Owner section-config drying_method getter first checks profile?.drying_method (false with null), then plan?.dryingRoutes (false with {}), then returns null. Both donor and keeper use identical missing input {} and null legacy argument. No null-plan, empty-array or nonempty-array result is substituted. Keeper retains five direct calls, donor call is exactly its fifth; no new call is needed.

D2: Both tests find the actual towel_technique config and call getValue(null, {towel:{material:'no_towel'}}). The as-const in keeper is erased by TypeScript and has no runtime effect. resolveTowelSource sees hasLegacyTowelSignal=false, planMaterial=no_towel, planTechnique=null, and returns the existing German no-technique string. The keeper's material call also exercises the same pure resolver, which does not mutate either input or any state. Its separate technique assertion directly covers the donor owner branch; no earlier material assertion is substituted as semantic proof. Legacy towel signal and explicit technique branches remain retained.

D3: NIGHT_PROTECTIONS is an ordinary literal array exported directly from onboarding-care.ts. The keeper's deepEqual literal contains loose_tied and excludes loose_braid/loose_bun, strictly implying all three donor membership clauses. This is data-to-identical-data proof, not compiler/runtime copy substitution. Same test import, owner object, process and test lane. There are no fixtures or stubs. The list also feeds canonical-value Set construction and option mapping; normalizer tests remain because testing allowed options does not prove persisted legacy normalization.

Complete three test files and their helpers/fixtures were read. profile-plan-overlay has only getField lookup plus one small product literal. profile-section-config's full makeProfile helper populates actual nullable legacy fields, arrays, IDs and timestamps before overrides; those calls are retained. onboarding-care-vocabulary has no custom helpers or fixtures. Full section-config (including pure resolveTowelSource, optionLabels, optionLabel and orderedGoalLabels), full onboarding-care, vocabulary barrel, display-config, and hair-profile/derived read. Only the complete selectPlanProductRows operative helper and its profile-page consumers were read from the large page; unrelated page behavior is not claimed audited.

## Callers and retained compatibility

Profile page lines 870–876 invokes field.getValue(hairProfile, refinementAnswers) for each real displayed field. Its selectPlanProductRows lines 263–270 rejects legacy rows, null routine and empty routine; all four boundary tests remain.

Onboarding flow lines 169/181 normalizes stored legacy towel/night values during resume; lines 476/499 normalize save values; line 669 maps actual NIGHT_PROTECTION_OPTIONS into UI options. Legacy prefill lines 170/185 normalizes persisted material/technique/night fields; from-persistence line 128 and recommendation normalize line 66 also normalize night values. Therefore German towel aliases, braid/bun mapping/deduplication, and tight-hairstyle filtering have concrete live consumers and remain R. Search also found validator enum, refinement question-path admission, and agent-v2 tool definitions consuming the canonical list; no assumption of one consumer supports D3. No production compatibility code or fixture is recommended for deletion.

## History and lane

4bdda99a (#428) introduced all 18 overlay callbacks together, including both duplicate pairs. Its reviewed contract explicitly preserves read-path overlay, legacy-wins precedence, towel family coherence, and answered-none semantics; no later behavior change is inferred. c091906f (#135) introduced legacy vocabulary normalization and the loose-tied membership callback. adb21132 added the stronger exact canonical list alongside accessory and tight-style rules while retaining the weaker callback. Later label changes did not remove that exact-list keeper.

package.json:49 includes every cohort .test.ts in test:node with tests/server-only-register.cjs and tsx. CI quality-node .github/workflows/ci.yml:148–164 runs test:node without a per-cohort condition. The preload only substitutes the server-only marker; it does not fake config, vocabulary, getters or inputs. No browser test or alternate gated lane is used as a keeper.

## Fault suggestions and limits

Five exact source replacements in evidence JSON (all unique and statically parsed) isolate D1 unanswered-drying return, D2 plan no-towel technique, and D3 missing loose_tied / added loose_braid / added loose_bun. Expected keeper assertion and complete keeper body are included for each. Main should require selected keeper green, actual ERR_ASSERTION at stated keeper assertion under fault, byte-exact restoration and selected keeper green. No faults or tests have been run by this agent. No coverage claim is made; parent retains the 2pp campaign guard.

No significant broader cut found in sampled untouched quiz preparation/navigation/routing/screen-order, profile shared-edit or quiz link-to-profile tests: they guard distinct access, security, persistence, legacy, null and transitions. Those samples are not part of this full 30-declaration cohort and are not given all-declaration classifications here. Account deletion/payment areas were inventoried but not semantically audited. Existing modified campaign files and pending QuizOptionCard scope were excluded.
