# Nomi consult finish — plan (Rev. 1, 2026-10-09)

Goal: make Nomi's (enrollment `6ebb7e7b…`) real call outcome expressible in the cockpit and printable
without false promises. Nick's rulings 2026-10-09 (chat):

- Bondbuilder for Nomi: **L'Oréal Elvital Bond Repair Plus Pre-Shampoo**, not K18.
- Baseline score: **allow half points** (she said 7,5).
- Routine trimmed to Urea-Shampoo → Conditioner → Hitzeschutz → Bondbuilder; Wunderöl + Maske optional;
  optional add-ons to be explored (care-expert research, separate).
- Wash rhythm: research first (care-expert lane); rule change joins only if evidence supports it.
- Olaplex Nº.5 conditioner: research **both** formulas (exact-EAN legacy + current) — catalog lane, not this PR.

## T1 — Equal-fit options for an empty step (cockpit)

Today an empty step offers exactly one swap option: the Idealplan pick. For a tie (bondbuilder:
8 candidates all `ideal`, K18 chosen by `bondbuilder.stage3.tie_default`) the other equals are invisible.

- `loadDiscoveryIdealRoutine`: for a step whose shortlist evaluation carries a `*.equal_shortlist`
  criterion, list the other candidates that evaluate standalone `ideal` (same authority, same input)
  as `equalOptions` on the step (id, name, price label, image). Read-only, discovery path only —
  Stage-1/Stage-3 member surfaces untouched.
- Never hashed (stripped like `depth`): an option list must not drift finalised documents.
- Cockpit view: with no displayed alternatives, `swapOptions = [ideal, ...equalOptions]`
  (owned products excluded); new origin `equal_alternative`. The decisions route accepts them because
  it validates against `swapOptions`.
- Identity batch includes the equal options (brand/line label + packshot).
- Tests: tie → options listed + route accepts; single ideal → unchanged; hash unchanged by options.

## T2 — Half-point scores

- Migration: `baseline_score` smallint → numeric(3,1), CHECK 1–10 in 0,5 steps (existing integers valid).
- Route zod `score`: multipleOf 0.5 (baseline + rescores). `scoreOf` + `parseRunsheetBaseline`
  accept halves and „7,5". Input `step=0.5`, `inputMode="decimal"`.
- Staircase already decimal-safe (verified).

## T3 — PDF projection fixes (scope after application-compiler mapping)

- „Bewusst ohne Produkt" (kept, nothing owned) must not print „Noch offen – Empfehlung folgt":
  the step is omitted from the printed routine.
- Further print defects (variant headings as numbered actions, transitions numbered, heat-protectant
  placement, Bond-Repair-Tag order) — fix location decided from the compiler map; anything that would
  change member-facing `/anwendung` is split out, not slipped in.

## T4 — Dry-scalp wash band (pending research)

Only if the care-expert evidence supports it; otherwise dropped from this PR.

## Out of scope

PDF v2 content (diagnosis, Hebel, habits, expectations, touchpoints, shopping list) — own design step.
Olaplex research (catalog lane). Prod data edits for Nomi (decisions) — done via the cockpit after deploy.
