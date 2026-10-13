# R4 — 14 user-submitted scan-visible products, refreshed (research, 2026-10-09)

Read-only research lane (Sonnet). Structured before/after, sources and statuses in `findings.json`; proposed protocol rows in `proposal/protocol-rows.json` (16 rows, all parse against current V1/V2 schemas — `proposal/protocol-schema-validation.json`); engine envelopes/outputs in `leave-in-v1.1/` and `mask/`; raw captures in `evidence/`. Orchestrator verified live: Neqi spray facts applied 2026-09-29 (batches `leave-in-research-calibration-v1` and `-v2-t20`, `reviewed_by=nick`); Leave-In v1.1 docs on main.

## Drift vs. September branch `codex/catalog-assessment-completeness`

- Leave-in manifest entries void: Leave-In Standard v1.1 (T20) merged; adapter refuses v1.0 envelopes. Aussie/Bali/Balea re-issued on v1.1 pins (only `care_direction` re-derived).
- Prestate fingerprints void for Bali + Balea (2026-10-03 price-audit changed `affiliate_link`).
- Neqi spray facts already live (2026-09-29); only protocols missing.
- Mask engine v1.0 now exists (PR #651).
- 8 ordinary shampoo/conditioner payloads still valid; facts present; 0 protocols on all 14.
- No apply executor for user-submitted rows on main (Sept executor only on old branch; Stage-5 curated-only).
- Sept evaluator fix `23a83cfa` not on main → pre-heat role still requires `pre_heat` in `application_stage`.

## Summary

| Product | Gap | Engine | Proposal | Status |
|---|---|---|---|---|
| Syoss Fullness `b761256d` | P | — | 1 shared shampoo protocol | ready |
| Syoss Volume `f8a8fd56` | P | — | 1 shampoo protocol | ready |
| "Ultimate Shampoo" `88c230c5` | P | — | 1 shampoo protocol | ready (rename = separate identity step; has 1 owner) |
| Jean&Len Colorglow `4f67cb6d` | P | — | 1 conditioner protocol | ready |
| John Frieda Frizz Ease `62ff4f08` | P | — | 1 conditioner protocol | ready |
| Neqi Diamond Glass Conditioner `5f4f1300` | P | — | 1 conditioner protocol (1–3 min category window) | ready |
| Pantene Moisture Boost `931892fb` | P | — | 1 rinse-out protocol | ready; identity flag: stored GTIN 08700216939140 = 800 ml pump, row says 200 ml (200 ml = 8700216939508) |
| GLISS Liquid Silk `7fb31d10` | P | — | 1 conditioner protocol | ready |
| AUSSIE SOS `ba326dab` | F+P | Leave-In v1.1 | specs (care_direction balanced, low repair, post-wash only, roles → replacement_conditioner), 8→4 eligibility rows, 1 protocol | ready pending T20 flip acceptance |
| Balea Hair Sealer `ea88a333` | F+P, no GTIN | Leave-In v1.1 | GTIN 4070765027518 (dm DAN 3062765, 100 ml), specs (balanced, rich, coarse only, heat claim "bis zu 230 °C"), 2 protocols | blocked: damp/dry capture + pre-heat evaluator fix |
| Bali Curls N°3 `694c4568` | F+P | Leave-In v1.1 | specs (moisture, medium, normal+coarse, hp true on generic "Hitze" claim), 2 protocols | post-wash ready; pre-heat needs evaluator fix + reconfirm generic-heat ruling; dm listing carries the oil's INCI (data error at dm) |
| Neqi spray `42a2fe20` | P | v1.1 replay = live | 2 protocols on shared templates | ready; 3 confirmations |
| Jean&Len Rosemary/Ginger mask `e5cfad78` | F+P | Mask v1.0 | concentration high→medium, low repair, detangling + moisture, fine/normal/coarse, 1 protocol (300–1800 s) | ready for review; tail-marker ambiguity (single lane, conservative reading) |
| Neqi Rosemary Oil `010cf825` | no oil spec | none | no fact patch | blocked: pre-wash scalp treatment with growth claims → category question |

## Neqi spray — confirmations

Live since 2026-09-29: fine hair removed (normal+coarse), weight medium, can replace conditioner, care_direction balanced, `heat_activation_required` false (was true; adapter always writes false; manufacturer says polymers are heat-activated and directs blow-drying under tension). Open: keep live grading; restore `heat_activation_required`?; shared post-wash/pre-heat templates add steps Neqi doesn't state vs. bespoke Neqi steps.

## Neqi Rosemary Oil — options

B (recommended to evaluate): re-categorise to Scalp Care (oil, rinse-off, pre-wash scalp protocol; role open, growth wording is medically adjacent → hair-care-expert input). A: scalp-only oil role in Oil authority. C: leave unassessable. Never create an oil spec/protocol.

## Risks

Single-lane T20/Mask derivations; `Conditioner (Drogerie)` label inconsistency (key applies on `category_key` + id); runtime readiness oracle and Stage-3 evaluation of proposed rows not yet run.
