# Changelog: v1.6 candidate vs v1.4

Baseline: `docs/research/shampoo-inci/v1.4/classification-standard.md` (SHA-256 `0f9f6a6d…928f24`, frozen). Target: `classification-standard.md` in this directory.

"Live value" means a `product_shampoo_specs` row (thickness, bucket, scalp route, cleansing intensity) that the projection could add, remove or change once v1.6 is locked and Production Light is re-pinned. Nothing in this candidate changes a live value by itself.

Sources: **v1.5** = Focus v1.5 overlay approved 2026-09-03; **H3** = holdout-v3 adjudication / operator clarification; **P** = new projection rules (this draft); **E** = editorial or enforcement of an existing v1.4 rule.

| # | Section | Old rule (v1.4) | New rule (v1.6 candidate) | Source | Could change a live value? |
| --- | --- | --- | --- | --- | --- |
| 1 | Version | Policy `shampoo-classification-v1.4`, parked, stable | Candidate `shampoo-classification-v1.6-candidate`; not locked, not production-active; final ID only via lock receipt | E | No |
| 2 | Scope | Explicit deep-cleansing products outside cohort | Same, plus Section 13.6 identifies them for routing out | P | Yes, via #27 |
| 3 | 1 Output contract | Eight direct properties only | Eight direct properties plus a projection block (thickness fits, scalp targets, observed intensity, reset positioning, review flags) | P | Yes (the block becomes the live rows) |
| 4 | 1 / 7 Focus values | `volume, shine, repair, clarifying, scalp_active, gentle, general` | `volume, shine, repair, moisture, clarifying, scalp_active, general`; `gentle` retired as a focus, still valid cleansing language | v1.5 | No (focus is not a live field; only `clarifying` feeds intensity, unchanged) |
| 5 | 1 / 8 Secondary vocabulary | Any focus except `general`/primary | Same rule, now over the v1.5 vocabulary; enforced mechanically (9 frozen v1.4 candidate entries carry `general` as secondary) | v1.5, E | No |
| 6 | 1 Property record | Value, confidence, rationale, facts, counter-signal, neighbor, sources | Neighbor is now a required field (`none` allowed) because projection review flags read it | P | Indirectly (feeds review flags #24) |
| 7 | 1 / 7.4 Focus record | Decision trace optional per runbook | Required care-direction verdict, claim role, formula facts with exact INCI positions, counter-signal, neighbor, decision trace | v1.5 | No |
| 8 | 1 Confidentiality | Not stated | Confidence and review flags are internal; never user-facing | P | No |
| 9 | 3 Claims | Claims may identify focus/usage, corroborate sensitive intent, expose conflict | Adds claim roles (`candidate`, `tie_breaker`, `corroborating`); claims may break a `dual_supported` tie but cannot turn `nonspecific` evidence into a specialist focus | v1.5 | No |
| 10 | 3 Claims | Claims may not assign cleansing/conditioning/weight | Also may not assign a thickness fit or pass a scalp-target formula gate; they supply the positioning gate only | P | Yes |
| 11 | 3 Blind packet | Hide brand, claims, prior labels, fit | Also hide live catalog rows | P | No |
| 12 | 4 Cleansing | SLES + CAPB "can still be moderate" when buffered | C1: early ether sulfate + amphoteric/betaine buffer, no second anionic/reset route, no reset intent = `moderate` | H3 (Eucerin, Hydra Hyaluronic) | Rarely: `strong` and `moderate` both project to `regular` unless the strong product also met the clarifying trigger |
| 13 | 5 Conditioning | Conditioning and weight related, not equivalent | C2: strong cleansing never lowers conditioning; silicone + cationic polymer + pearlizer/fatty + humectants = `high` | H3 (Wella Nutri-Enrich) | Yes, via coarse fit (#20) |
| 14 | 6 Weight | Polymer/silicone is a clue, not a floor | W1: silicone + cationic guar + late amodimethicone with effective sulfate base and no rich 2-in-1 = `moderate`, not `high` | H3 (Hydra Hyaluronic) | Yes, via fine/normal fit (#18, #19) |
| 15 | 7 Primary focus | `scalp_active` = problem-led product with recognized dandruff active | `scalp_active` = formula-compatible targeted cosmetic scalp need, incl. sensitive scalp; dandruff active stays in `dandruffSupport` | v1.5 | No |
| 16 | 7 Primary focus | No repair/moisture split; holdout-v3 clarification puts dry/nourishing under `repair` | Care-direction verdict decides; dryness/nourishment -> `moisture`, damage -> `repair`, `nonspecific` -> `general` (F1 supersedes the H3 clarification) | v1.5 | No |
| 17 | 7 / App. A | `gentle` focus in use (9 primary values in the frozen candidate) | Re-derive: `scalp_active` when sensitive-scalp claim + `targeted`; otherwise next compatible job or `general`; secondary `gentle` dropped or becomes `scalp_active` | v1.5, H3 (Vichy) | No |
| 18 | 8 Secondary | Not a synonym or restatement | F2 normative: a benefit from the same route as the primary (e.g. shine from the same silicone route) is not a secondary | H3 operator clarification | No |
| 19 | 9 Usage role | Triggers as table | Triggers checked mechanically after cleansing is final; `alternating` never with `moderate` cleansing; `frequent` never with `strong` (frozen artifacts violate both: OGX Rosemary, Pantene Hydra Glow) | E | Rarely (only via the clarifying intensity trigger) |
| 20 | 11 Dandruff | Formula rule only | Adds: `supported` describes the formula; projection needs separate anti-dandruff positioning | E (matches adapter) | Yes, for products with a preservative-role active and no anti-dandruff claim |
| 21 | 13.2 New | Projection judgments unwritten researcher judgment | P0: every uncertain projection rule fails conservative or to blocking review, never toward recommending; intensity never tuned; legacy/coverage never inputs | P | Yes |
| 22 | 13.3 New | — | E1 exact-product positioning with confidence tiers; E2 German scalp-claim lexicon incl. exclusions; E3 "prominent = before Parfum" proxy; E4 closed comfort and humectant/refatting route lists | P | Yes |
| 23 | 13.4 New | Thickness: researcher judgment, "whole-formula call" | T1 fit table from weight and conditioning only: fine ideal only at W low; normal ideal unless W high; coarse ideal only at C high or W high | P | **Yes, large** (see open questions 1–3) |
| 24 | 13.4 New | — | T2: thickness, texture/curl, volume claims, focus and scalp target never change fit; T4 boundary review flag from the recorded neighbor | P | Yes (curl products lose coarse eligibility unless C or W high) |
| 25 | 13.5 New | Adapter: sensitive/dry need `targeted`; dandruff needs active + positioning; oily/ordinary ungated | S-SENSITIVE and S-DRY add a prominent comfort / humectant route requirement; S-OILY adds a formula gate (cleansing ≥ moderate, weight not high, conditioning not high); strong cleansing on comfort routes -> review | P | Yes |
| 26 | 13.5 New | — | S-FAIL: specialist claim with failed gate -> proposed `ordinary` + blocking review; S-SECONDARY: max one, never `ordinary`, never `oily`+`dry`; S-HAIRLOSS: hair-loss claims never create a target; S-FOCUS consistency flag | P | Yes (e.g. Pantene Grow Abundance loses its `irritated` row; Neqi Moisture Mystery cannot keep `dry`+`balanced`) |
| 27 | 13.6 New | Adapter: deep-cleansing route needs "explicit reset positioning" (undefined) | D1 lexicon defines it; D3 mismatch -> review instead of silent regular projection | P | Yes (open question 5) |
| 28 | 13.6 New | Adapter maps strength -> intensity | I1 same mapping, now normative; I2 never adjusted to the bucket; I3 boundary review | P | Yes vs legacy rows (many legacy rows say `gentle` where the formula reads `regular`) |
| 29 | 13.7 New | Adapter cross-product, implicit | Rows are always the full cross-product; `dry_flakes` never emitted; non-Cartesian live pairs become review differences | P | Yes (Neqi Moisture Mystery) |
| 30 | 13.8 New | Adapter: thickness/target confidence supplied by researcher | Derived: lowest input confidence; unlisted route caps at `moderate`; any `low` -> `needs_research` | P | Yes (low -> no payload) |
| 31 | 13.9 New | — | Closed list of blocking review flags, incl. `review_live_value_differs` (program decision D4) | P | Blocks application until Nick rules |
| 32 | 14 Gate | Compare seven judgment properties | Also compare 3 thickness fits + primary/secondary scalp target; record `toward_recommending` direction; lock gate = D2 (≥90%, zero ambiguity-caused `toward_recommending` disagreements, unseen re-run) | P | No |
| 33 | 15 Truth vs fit | Don't tune truth to profile distribution | Also don't tune projection rules to cell coverage or live rows | P | No |
| 34 | Compatibility | Production Light pinned to v1.4 hash and enum | Unchanged; v1.6 envelopes need a reviewed adapter re-pin after lock (adapter currently rejects `moisture`) | E | No |

## Carried over without change

Sections 2 (identity and source hierarchy), 4 anchors, 5 anchors, 6 subjudgments/anchors/reviewed function rows, 10 (scalp comfort target), 11 rule table, 12 (confidence values) and 16 (stop boundary) are carried verbatim apart from cross-references and the additions listed in the table above (rows 12–14, 20, and the projection-confidence sentence in Section 12).

## Not carried over

- v1.3 route scores, v1.4-draft route-count weight calibration (`shampoo-weight-v1`), its "prominent window 1–10" and "polymer means moderate": excluded as v1.4 required. E3's "before Parfum" proxy is used only for scalp-target gates, never for weight.
- The holdout-v3 operator clarification that dry/nourishing positioning maps to `repair`: superseded by F1 (row 16).
