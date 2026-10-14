# Nomi consult finish — plan (Rev. 2, 2026-10-09)

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

## T4 — Dry-scalp wash band (ruled: research band)

Care-expert research (scratchpad report; Punyani 2021, Fajuyigbe 2024, AAD — indirect evidence, low–moderate
confidence): no evidence that 2×/week with a mild shampoo harms a dry scalp; longer gaps tend to worsen flaking.
Ruled 2026-10-09: dry scalp + straight/wavy → preferred `weekly_2x`, min `weekly_1x`, max `weekly_3_4x`;
dry + curly/coily (and unknown pattern, conservative) keeps the old band (1× / every 2 weeks / 1×).
Deterministic rule — TDD in `needs.ts` + `categories/shampoo.ts` (both tables).

## T5 — Mask day (ruled: in this PR)

V2 shampoo template (`standard_rinse_out_cleanse`) is wash-day only, so `intensive_care_day` (requires cleanse +
intensive_care) never forms → every rinse-out mask is `!instructed` → discovery gap (and likely missing on
member `/anwendung`). Fix in the V2 compiler, mirroring the existing bond-repair extension: with a rinse-out
mask in the routine, the standard cleanse protocol is also compatible with `intensive_care_day`. Verify member
impact first (production audit), regression test with the shared templates.

## T6 — Heat protection placement (ruled: in this PR)

(a) A dry-only protectant must not appear on days without heat (`between_wash_care_day`, `refresh_day`): gate
heat-protection items to the days a heat event applies to (existing `oilHeatEventMatchesDay`-style mapping).
(b) Finding: ordinary blow-drying is modelled as `ordinaryAirflowExposure`, not as a heat event, so it never
triggers a protectant step. Ruled 2026-10-09: **keep the model** (only hot tools / airflow stylers trigger heat
protection). Nomi gets the blow-dry advice verbally. Implemented: one occurrence per heat-day context, each
gated to its days (oil heat-day mapping) — no protectant on care/refresh days.

## T7 — Olaplex Nº.5 (parallel, catalog lane — not this PR)

Both formulas researched as separate catalog products (exact-EAN legacy = Nomi's submission; current
Strengthening formula = new candidate). Local packages only; Nick signs off before publish.
Findings: no real formula conflict — olaplex.de sells the original Nº.5 under her EAN (€34). Ruled 2026-10-09:
weight `rich` → `suitable_thicknesses` normal + coarse (not fine). Strengthening product held until sold in DE.

## Out of scope

PDF v2 content (diagnosis, Hebel, habits, expectations, touchpoints, shopping list) — own design step.
Olaplex research (catalog lane). Prod data edits for Nomi (decisions) — done via the cockpit after deploy.
