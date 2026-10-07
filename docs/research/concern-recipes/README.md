# Concern Recipes (Discovery-Call Cockpit)

Research date: 2026-09-25. Internal only: this is for the admin cockpit and the founder's 1:1 consultation calls. It is never shown to users.

## Purpose

For each quiz concern (`DIAGNOSTIC_CONCERNS`), this gives the founder a short, evidence-labelled "recipe" so he can say „wir haben dein Hauptproblem gehört – so gehen wir es an". Each recipe covers:

- what the user usually means
- primary product categories and non-product levers
- conditional categories, gated by profile modifiers
- what not to lead with
- the safety boundary
- conflicts with other concerns
- questions to clarify in the call
- a German talking point

## Files

| File | Role |
| --- | --- |
| `recipes.json` | Source of truth. Machine-readable, and meant to become a typed TS table. |
| `recipes.md` | Human-readable rendering of `recipes.json`, one section per code. It is generated from the JSON, so edit the JSON and regenerate the markdown. |
| `README.md` | Method, sources, scope boundary, schema, and how the table maps to code. |

## Method

1. **Base evidence.** Everything is taken from `docs/research/goal-concern-levers/` (research date 2026-06-26): `synthesis.md`, `fiber-surface.md`, `damage-breakage.md`, `scalp-medical-adjacent.md` and `shape-styling.md`. The evidence labels are reused from those notes, not re-rated.
2. **Mapping the quiz to the research.** The quiz codes are not the research codes. `researchRef` in the JSON records which research concern or goal codes each recipe is built from:

| Quiz concern | Research concerns | Research goals |
| --- | --- | --- |
| `dry_lengths` | `dryness` | `moisture` |
| `frizz_flyaways` | `frizz` | `less_frizz` |
| `low_shine` | none | `shine` |
| `lost_shape` | none | `curl_definition`, `volume` (straight-hair variant) |
| `low_volume_or_weighed_down` | none | `volume` |
| `hair_damage` | `hair_damage` | `healthier_hair`, `strengthen` |
| `hair_loss_or_thinning` | `hair_loss`, `thinning` | none |
| `breakage` | `breakage` | `anti_breakage` |
| `split_ends` | `split_ends` | `less_split_ends` |
| `tangling` | `tangling` | none |

   **`low_shine`, `lost_shape` and `low_volume_or_weighed_down` are built from research *goals* (`shine`, `curl_definition`, `volume`), not concerns.** The research has no concern-level analysis for them. Their recipes therefore invert a goal lever map, and each one carries a `domainReview` note.
3. **Translating levers into our categories.** Each lever is expressed with our 10 recommendable categories only. Where the evidence points to something outside them, the recipe says so:
   - **"Rich cream/butter"** maps to `mask` when it is rinse-out, or to `leave_in` when it is leave-on, such as a curl cream. We have no butter/cream category.
   - **Hold products** (gel, mousse, styling cream) are the best-supported product lever for `lost_shape` (`moderate`). They are not recommendable: the `styling_*` keys exist in `CanonicalProductCategoryKey`, but they are not in the recommendable set. The recipe falls back to `leave_in` and names hold only as a non-product lever. This needs a domain decision.
   - **`scalp_care`** appears in no recipe. It is deliberately never offered for `hair_loss_or_thinning`, and scalp concerns such as dandruff are not in the concern set covered here.
   - **Mask replaces conditioner** on the days it is used. This matches the protocol-template ruling, so masks are never stacked on top of conditioner.
4. **Gap-filling external sources.** These were added only where the base notes were thin (see Sources).
5. **Conservatism rules applied:**
   - `weak` items are never primary.
   - Heavy categories (`mask`, `oil`) are always conditional, and fine hair never unlocks them.
   - `deep_cleansing_shampoo` is only ever signal-gated. The signal is a coated or heavy feel confirmed in the call, which the profile cannot express.
   - Any "repair", "heal" or "regrow" wording is excluded.

## Evidence Labels

These are reused unchanged from `goal-concern-levers/research-brief.md`:

- `strong`: consistent clinical or scientific support, or a clear safety consensus.
- `moderate`: plausible and commonly accepted, with some direct evidence.
- `weak`: indirect evidence, professional practice, or mixed findings. Treat it as an option to discuss in the call, never as a hard rule.
- `unknown`: insufficient support. It must not be turned into a rule. No recipe currently uses it.

The overall `evidence` on each recipe rates its **core** recommendation, meaning the primary categories and levers. Conditional items carry their own labels.

## Scope Boundary

- **Cosmetic lane:** all concerns except `hair_loss_or_thinning`. These recipes cover the feel, appearance and handling of the hair lengths.
- **Medically adjacent lane: `hair_loss_or_thinning`.**
  - It gets a boundary only. There are no product categories and no conditional categories.
  - The only levers are three things: telling breakage from shedding, referring to a dermatologist or GP, and (after referral, and not as a treatment) avoiding traction.
  - The talking point deliberately does not start with „So gehen wir es an“, because the call does not "approach" hair loss.
  - If breakage is also present, the `breakage` recipe may run for the lengths, with an explicit statement that it does not treat the shedding.
- **Breakage vs shedding split.** This is carried in `breakage`, `hair_loss_or_thinning`, `tangling`, `frizz_flyaways` and `low_volume_or_weighed_down`:
  - Short pieces without a root mean breakage, which is cosmetic.
  - Full-length hairs with a small light bulb at the root, lighter density, or a widening part mean shedding or thinning, which is the boundary lane.
- **Scalp symptoms** (persistent itch, flakes, redness, pain, burning, sores) are outside every recipe here. `dry_lengths` explicitly separates a dry scalp from dry lengths.
- **Wording:** cosmetic only. Talking points avoid claims to cure, heal, regrow, stop or strengthen follicles. EU cosmetic claims must be truthful and evidence-backed (Regulation (EU) 655/2013), so spoken claims stay within what the evidence label supports.

## JSON Schema (for the TS table)

```ts
type Evidence = "strong" | "moderate" | "weak" | "unknown"
type Category =
  | "shampoo" | "conditioner" | "leave_in" | "mask" | "oil" | "dry_shampoo"
  | "deep_cleansing_shampoo" | "bondbuilder" | "heat_protectant" | "scalp_care"

type When = {
  hair_texture?: Array<"straight" | "wavy" | "curly" | "coily">
  thickness?: Array<"fine" | "normal" | "coarse">
  scalp_type?: Array<"oily" | "balanced" | "dry">
  damaged?: true
  chemical_treatment?: Array<"colored" | "lightened" | "permed" | "chemically_straightened"> // extension
  heat_styling?: true                                                                         // extension
}

type ConcernRecipe = {
  code: DiagnosticConcern
  labelDe: string
  meaningDe: string
  researchRef: { concerns: string[]; goals: string[] }           // extension
  primary: {
    categories: Array<{ category: Category; why: string; evidence: Evidence }>
    levers: Array<{ lever: string; evidence: Evidence; category?: Category }>
  }
  conditional: Array<{ category: Category; when: When; why: string; evidence: Evidence }>
  avoid: string[]
  boundary: string | null
  conflicts: DiagnosticConcern[]
  talkingPointDe: string
  callQuestionsDe: string[]                                       // extension
  domainReview: string[]                                          // extension (English, internal)
  evidence: Evidence
}
```

The requested shape is kept exactly. The fields marked `extension` are additive and optional to adopt.

### `when` semantics

- **Within one key:** OR. For example, `thickness: ["normal","coarse"]` means normal or coarse.
- **Across keys in one `when`:** AND. For example, `{ damaged: true, thickness: ["normal","coarse"] }`.
- **OR across different keys:** written as several entries with the same `category`. `mask` for `coarse` OR `curly/coily` is two entries. A category fires if any of its entries matches.
- **Unknown profile values:** a key whose profile value is unknown does **not** match, so the entry stays silent.
- **Primary categories** are not repeated in `conditional`. Weight and dose guidance for a primary category, such as "fine hair = light spray leave-in", lives in its `why`.

### `lever.category`

When a lever carries a `category`, that category may come up **only if the call confirms the signal**, such as a coated or heavy feel. Today this is only ever `deep_cleansing_shampoo`. Profile data alone never unlocks it.

## Profile Modifier → Code Mapping

| `when` key | Source in code | Notes |
| --- | --- | --- |
| `hair_texture` | `PersonalPlanDiagnosticInput.texture` | Pattern, per the repo vocabulary |
| `thickness` | `PersonalPlanDiagnosticInput.thickness` | Strand diameter, not density |
| `scalp_type` | `PersonalPlanDiagnosticInput.scalpOiliness` | The values are the same |
| `chemical_treatment` | `PersonalPlanDiagnosticInput.chemicalTreatments` | Unlocks `bondbuilder`, only for `lightened`, `permed` or `chemically_straightened` |
| `damaged` | Derived: `chemicalTreatments` ∩ {`lightened`,`permed`,`chemically_straightened`} ≠ ∅ **or** `elasticResponse === "snaps"` **or** `hairSurface === "rough"` | `colored` alone does **not** set `damaged`. This is an open domain question. |
| `heat_styling` | Profile `heat_styling` (`src/lib/vocabulary/frequencies.ts`), true for `daily`, `several_weekly` or `once_weekly` | Not a quiz field. If it is unknown, ask in the call. |

`density` and `hairLength` are not used as gates. The research names them as modifiers (low density and long hair are weight-sensitive; long hair means more weathered ends), but they only appear as call questions. This keeps the table small.

## Combining Several Concerns

This is guidance for the cockpit display, not a hard rule.

1. **Safety first.** If `hair_loss_or_thinning` is selected, show its boundary first and above everything else.
2. **Main concern first.** Lead with the recipe for the concern the user marked as main or recurring (`concernRecurrence.concernId` when present).
3. **Weight-sensitive concerns cap intensity.** When `low_volume_or_weighed_down` or `lost_shape` is present, or the hair is fine, heavy conditional categories (`mask`, `oil`) from other recipes should be shown as "check in the call", not as recommended.
4. **`conflicts` is symmetric.** It lists the pairs where the levers pull in opposite directions, for example weight vs slip, smoothing vs definition, or a thinning boundary vs a volume recipe.

## Sources

### Reused (see the notes for full lists and labels)

- `docs/research/goal-concern-levers/synthesis.md`
- `docs/research/goal-concern-levers/fiber-surface.md`: shine, frizz, dryness, tangling. Includes AAD, dermatology and cosmetic-science reviews, and oil penetration studies.
- `docs/research/goal-concern-levers/damage-breakage.md`: damage, breakage, split ends. Includes AAD, the Jachowicz combing/breakage study, blow-dryer heat damage, and split-end biomechanics.
- `docs/research/goal-concern-levers/scalp-medical-adjacent.md`: the hair-loss and thinning boundary. Includes AAD, DermNet, NHS, HSE and Cochrane.
- `docs/research/goal-concern-levers/shape-styling.md`: volume, curl definition, color. Includes AAD, curly-hair reviews and styling polymers.

### Added for gaps (2026-09-25)

- American Academy of Dermatology, [Dry shampoo: Dermatologists' tips](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/dry-shampoo-best-results).
  - Dry shampoo absorbs oil but does not clean, and should not replace shampooing.
  - Apply sparingly where the hair is greasy.
  - Build-up can cause dryness, stiffness and irritation.
  - Wash properly after one or two uses.
  - Supports the `weak` gating of `dry_shampoo` to oily scalp in `low_volume_or_weighed_down` and `lost_shape`.
- [Novel Compounds for Hair Repair: Chemical Characterization and In Vitro Analysis of Thiol Cross-Linking Agents](https://pubmed.ncbi.nlm.nih.gov/40430453/) (Pharmaceuticals, 2025).
  - In-vitro tensile-strength data for bond-building chemistries on bleached hair.
  - Confirms that the evidence base is mostly in vitro, with no clinical outcome data.
  - Supports keeping `bondbuilder` `moderate` for chemically damaged hair in `hair_damage`/`breakage`, and `weak` for `dry_lengths`/`split_ends`.
- [Commission Regulation (EU) No 655/2013](https://eur-lex.europa.eu/eli/reg/2013/655/oj/eng): common criteria for cosmetic claims (truthfulness, evidential support, honesty). This is the reason the talking points avoid repair, regrowth and cure claims.
- MSD Manual (German consumer edition), [Haarausfall](https://www.msdmanuals.com/de/heim/kurzinformationen-hauterkrankungen/erkrankungen-der-haarfollikel/haarausfall).
  - Lists hair-loss causes in German: genetic, autoimmune, medication, fungal, hormonal, nutrient deficiency, physical stress, traction/chemical injury.
  - Used as German-language context for the "many causes, get it checked" talking point. The referral red flags themselves come from the AAD/NHS/HSE sources in `scalp-medical-adjacent.md`.

## Open Domain Review

These questions are also stored per recipe in `domainReview`.

1. **`lost_shape`:**
   - May the call name gel or mousse generically, even though hold products are not recommendable?
   - Should the straight-hair variant („Form und Halt") get its own recipe, closer to `volume`?
2. **`low_volume_or_weighed_down`:** for curly/coily hair, the quiz label means uneven shape or volume distribution, which is mostly cut and styling. Confirm that the call should lead with that, not with products.
3. **`colored` without lightening:** should it set `damaged` or unlock anything, for example for `low_shine` or `hair_damage`?
4. **`hair_loss_or_thinning`:**
   - May the founder ask the root-vs-piece question, or only acknowledge and refer?
   - The talking point needs a legal/compliance read (HWG / EU claims) before it is used verbatim.
5. **Bondbuilder:** `moderate` rests on chemistry-specific, mostly in-vitro data. Should the talking points for `hair_damage` and `breakage` name it at all, or keep it as "may support" only when the user has lightened hair? The current wording is conditional.
