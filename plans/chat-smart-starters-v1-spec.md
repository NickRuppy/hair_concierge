# Chat Smart Starters V1 Spec

> Status: Draft for alignment
> Scope: Empty-state chat starter chips in `/chat`

## Goal

Replace the current semi-random welcome chips with 4 deterministic, profile-aware starter prompts that:

- feel smarter and more up to date
- use only quiz/profile/onboarding data
- steer users toward questions the current engine answers well on the first turn
- keep the surface copy outcome-led and user-friendly

## Inputs

Use only `hair_profiles` fields already collected in quiz/profile/onboarding:

- `hair_texture`
- `thickness`
- `density`
- `scalp_type`
- `scalp_condition`
- `protein_moisture_balance`
- `cuticle_condition`
- `chemical_treatment`
- `wash_frequency`
- `heat_styling`
- `goals`
- `desired_volume`
- `current_routine_products`
- `post_wash_actions`
- `routine_preference`

Do not use:

- prior chat memory
- conversation history
- inferred medical context

## Product Constraints

- Show exactly 4 chips.
- German only.
- Deterministic output for the same profile.
- No random shuffle in v1.
- No medically adjacent default chips such as hair loss or growth.
- No ingredient-first chips.

## Evaluation Summary

The following candidate prompts were tested as true first-turn messages against representative profiles using the local chat route and the existing quality rubric.

Strong performers:

- `Welche Routine passt am besten zu meinem Haarprofil?`
- `Welches Shampoo passt zu meinem schnell fettenden Ansatz?`
- `Welches Shampoo passt zu meiner Kopfhaut?`
- `Welcher Conditioner passt gerade am besten zu meinem Haar?`
- `Welcher Conditioner passt bei Feuchtigkeitsmangel?`
- `Welcher Leave-in passt zu meinem Styling-Alltag?`
- `Was hilft bei trockenen Schuppen?`
- `Was hilft gegen Frizz bei meinem Haarprofil?`
- `Brauche ich eher Maske oder Leave-in für meine Längen?`

- `Wie bekomme ich mehr Volumen, ohne zu beschweren?` remained usable, but was the weakest prompt in the synced-main rerun.

Implication:

- Routine and scalp/shampoo remain the safest default lanes.
- Conditioner is back in play when the profile already supports it.
- Leave-in and mask-vs-leave-in stay useful for styling and support-category entry points.
- Volume should only appear when the profile has an explicit volume signal.

## Final V1 Structure

Always render one chip per lane:

1. Routine lane
2. Scalp/shampoo lane
3. Care-category lane
4. Outcome lane

## Lane 1: Routine

Always present.

Primary copy:

- `Welche Routine passt am besten zu meinem Haarprofil?`

Rationale:

- Most reliable broad entry point
- Strong first-turn usefulness across very different profiles
- Gives the system room to use multiple profile signals well

## Lane 2: Scalp/Shampoo

Purpose:

- Convert strong scalp signals into a concrete first-turn question
- Prefer highly answerable scalp-first prompts over generic product copy

Priority order:

1. If `scalp_condition === dry_flakes`
   - `Was hilft bei trockenen Schuppen?`
2. Else if `scalp_condition === irritated`
   - `Was hilft bei gereizter Kopfhaut?`
3. Else if `scalp_condition === dandruff`
   - `Was hilft bei Schuppen?`
4. Else if `scalp_type === oily`
   - `Welches Shampoo passt zu meinem schnell fettenden Ansatz?`
5. Else
   - `Welches Shampoo passt zu meiner Kopfhaut?`

Rules:

- Prefer problem-led wording over generic recommendation wording when there is a sharp scalp signal.
- Keep the lane scalp-first, not damage-first.

## Lane 3: Care Category

Purpose:

- Surface the strongest support-category question for this profile without relying on randomness

Priority order:

1. If `protein_moisture_balance === snaps`
   - `Welcher Conditioner passt bei Feuchtigkeitsmangel?`
2. Else if the profile suggests active styling fit and already includes conditioner in the routine
   - `Welcher Leave-in passt zu meinem Styling-Alltag?`
3. Else if `thickness` and `protein_moisture_balance` are both present
   - `Welcher Conditioner passt gerade am besten zu meinem Haar?`
4. Else if the profile suggests active styling fit and leave-in support
   - `Welcher Leave-in passt zu meinem Styling-Alltag?`
5. Else if the profile suggests damaged or dry lengths
   - `Brauche ich eher Maske oder Leave-in für meine Längen?`
6. Fallback
   - `Welcher Conditioner passt gerade am besten zu meinem Haar?`

Suggested signal set for `Conditioner passt bei Feuchtigkeitsmangel`:

- `protein_moisture_balance === snaps`

Suggested signal set for `Leave-in passt zu meinem Styling-Alltag`:

- `goals` includes `less_frizz` or `curl_definition`
- or `concerns` include `frizz`
- or `heat_styling` is not `never`
- or `post_wash_actions` include styling after washing
- or `current_routine_products` already includes `conditioner` and the hair is `wavy|curly|coily`

Suggested signal set for `Maske oder Leave-in für meine Längen`:

- `cuticle_condition` is not `smooth`
- or `protein_moisture_balance === snaps`
- or `chemical_treatment` includes `colored` or `bleached`
- or concerns include `dryness`, `hair_damage`, or `frizz`

Rules:

- Favor the sharpest validated category prompt available for the profile.
- Use conditioner only when the profile already gives enough support to keep the first answer useful.

## Lane 4: Outcome

Purpose:

- Keep one chip user-outcome-led while still staying inside strong engine territory

Priority order:

1. If `goals` or concerns include `less_frizz` or `frizz`
   - `Was hilft gegen Frizz bei meinem Haarprofil?`
2. Else if `desired_volume === more` or `goals` includes `volume`
   - `Wie bekomme ich mehr Volumen, ohne zu beschweren?`
3. Else
   - `Was ist der nächste sinnvolle Schritt für mein Haarprofil?`

Rules:

- Keep this lane advisory, not medical.
- Prefer benefit-first phrasing.
- Do not show the volume prompt unless the profile explicitly asks for more volume.

## Copy Rules

Every chip should follow:

- concrete benefit or category
- slight personalization
- engine-safe framing

Good examples:

- `Welches Shampoo passt zu meinem schnell fettenden Ansatz?`
- `Welcher Conditioner passt bei Feuchtigkeitsmangel?`
- `Welcher Leave-in passt zu meinem Styling-Alltag?`
- `Was hilft gegen Frizz bei meinem Haarprofil?`

Avoid:

- `Kannst du mir ein gutes Shampoo empfehlen?`
- `Was hilft wirklich ...`
- `endlich`
- `perfekt`

## Excluded From V1

Do not surface these as default starter chips:

- hair loss / growth starters
- ingredient starters
- volume prompts without an explicit volume signal
- broad medical/scalp diagnostic starters beyond the tested dry-flakes wording

## Fallback Set

If the profile is sparse, use:

- `Welche Routine passt am besten zu meinem Haar?`
- `Welches Shampoo passt zu meiner Kopfhaut?`
- `Welcher Conditioner passt gerade am besten zu meinem Haar?`
- `Was hilft gegen Frizz?`

## Subtitle Copy

Replace the current generic subtitle with a line that reflects profile-aware guidance.

Preferred v1 copy:

- `Frag mich nach deiner Routine, passenden Produkten oder dem nächsten sinnvollen Schritt für dein Haarprofil.`

## Implementation Outline

1. Refactor `src/lib/suggested-prompts.ts` into lane-based deterministic generation.
2. Remove random selection and shuffle behavior in v1.
3. Introduce explicit lane builders:
   - `buildRoutinePrompt(profile)`
   - `buildScalpPrompt(profile)`
   - `buildLengthsPrompt(profile)`
   - `buildOutcomePrompt(profile)`
4. Keep existing icon support, but map icons by lane and selected variant.
5. Update subtitle copy in `src/components/chat/chat-container.tsx`.
6. Add tests for representative profile combinations and assert exact prompt sets.

## Verification Cases

At minimum verify:

1. Oily scalp + fine hair + volume
   - includes routine
   - includes `Welches Shampoo passt zu meinem schnell fettenden Ansatz?`
   - includes `Wie bekomme ich mehr Volumen, ohne zu beschweren?`
2. Dry flakes profile
   - includes `Was hilft bei trockenen Schuppen?`
3. Curly/frizz profile
   - includes `Welcher Leave-in passt zu meinem Styling-Alltag?`
   - includes `Was hilft gegen Frizz bei meinem Haarprofil?`
4. Dry/damaged/bleached profile
   - includes `Welcher Conditioner passt bei Feuchtigkeitsmangel?` when `protein_moisture_balance === snaps`
   - falls back to `Brauche ich eher Maske oder Leave-in für meine Längen?` when conditioner inputs are missing
5. Sparse profile
   - falls back to the generic v1 set

## Open Investigation

The synced-main rerun improved confidence in conditioner starters, but a few follow-ups are still worth tracking:

- classifier category choice on broad conditioner-oriented first turns
- router missing-slot behavior for conditioner prompts without an explicit need phrase
- whether the volume prompt can be reframed into a stronger first-turn path without losing the clear user benefit
