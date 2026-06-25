# Chemical Treatment Taxonomy Patch

## Context

HAI-128 came from beta feedback where a user with a Dauerwelle was unsure whether to mark her natural hair texture as curly. The product needed a clearer way to represent chemically created shape without conflating it with natural `hair_texture`.

The chosen v1 keeps `hair_texture` as the user's natural pattern and expands `chemical_treatment` to represent relevant structure-changing services.

## Product Decision

Add two new chemical treatment options:

- `permed` -> `Dauerwelle / Volumenwelle`
- `chemically_straightened` -> `Chemisch geglättet`

Keep these separate from natural texture:

- A perm is chemical treatment and a treated-shape signal.
- Chemical straightening is chemical treatment and a shape-changing signal.
- Neither option rewrites or implies natural `hair_texture`.

## Behavioral Rules

Chemical treatment logic:

- `permed` and `chemically_straightened` count as active chemical treatments.
- Both count as shape-changing treatments.
- Both contribute conservative chemical stress/damage weight.

Curl-definition logic:

- Natural `wavy`, `curly`, and `coily` hair can route into curl-definition support as before.
- Natural `straight` hair with `permed` can route into curl-definition support only when the user explicitly selected the curl-definition goal.
- `permed` alone must not behave as `hair_texture = curly`.
- `chemically_straightened` must not unlock curl-definition routing for natural straight hair.

## Non-Goals

- Do not add a generic `other_chemical_treatment` option yet.
- Do not add a separate `treated_shape` profile field in this patch.
- Do not infer a full curl routine from `permed` unless the user also asks for definition.
- Do not change the meaning of `hair_texture` or `thickness`.

## Implementation Map

Quiz and profile:

- Extend chemical treatment option lists and labels.
- Persist new values through quiz answers, profile normalization, profile editing, and result payloads.
- Add distinct icons for `permed` and `chemically_straightened`.
- Keep all UI copy German and concise.

Recommendation logic:

- Extend chemical treatment helpers for active, shape-changing, and perm-specific checks.
- Apply chemical stress conservatively for the new treatments.
- Allow perm + explicit curl-definition goal to reach definition-support and leave-in routing.
- Keep chemical straightening out of curl-definition unlocks.

Result narrative:

- Mirror the same narrow perm + explicit goal behavior in quiz-result narrative selection.

## Verification

Automated:

- Chemical treatment helper tests cover active, shape-changing, damage-weight, and perm-specific behavior.
- Persistence/profile tests cover quiz and profile saving paths.
- Recommendation foundation tests cover straight natural texture + perm + curl-definition goal.
- Category tests cover leave-in curl-definition routing for perm and non-routing for chemical straightening.
- Result narrative tests cover the same positive and negative cases.
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `git diff --check`

Manual/browser:

- Non-authenticated quiz flow can select the new options.
- Profile edit flow can select/save the new options.
- Icons are visually distinct and centered.
- Helper copy is clear, friendly, concise, and does not imply the natural texture answer should change.

## Review Gates

- Code review must specifically check that `permed` is not treated as natural curly hair.
- Simulated user review must check that the options are discoverable, selectable, saved, and understandable.
- Product review should confirm the remaining decisions below before merge.

## Research Follow-Up

External evidence supports the narrow v1 behavior:

- A perm is a chemical shape treatment and should contribute to chemical-stress/damage awareness.
- Perm maintenance commonly overlaps with gentle handling, conditioning/moisture support, reduced heat stress, and curl/wave definition when the user wants to preserve or define the created shape.
- This supports routing `permed` + explicit `curl_definition` into definition support without treating `permed` as natural curly hair.

Terminology research suggests `Dauerwelle` is the clearer umbrella label. `Volumenwelle` is common in DACH salon language, but appears more like a softer or volume-oriented variant than a separate canonical category. Keeping `Dauerwelle / Volumenwelle` is understandable; shortening the option to `Dauerwelle` and mentioning `Volumenwelle` in helper copy may be cleaner.

## Decisions To Confirm

1. The option labels stay `Dauerwelle / Volumenwelle` and `Chemisch geglättet`, or the perm label is shortened to `Dauerwelle`.
2. The helper copy stays: `Gemeint ist alles, was Farbe oder Form länger verändert hat: Färben/Tönen, Aufhellen, Dauerwelle oder Glättung. Deine natürliche Struktur hast du schon angegeben.`
3. `permed` only unlocks curl-definition support when `curl_definition` is an explicit goal.
4. We defer a separate `treated_shape` field until there is stronger product need.
5. We intentionally omit a generic `Sonstige chemische Behandlung` option for now.
