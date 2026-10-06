# Mask calibration — round 1 report (first set for Nick's review)

Date: 2026-09-05. Cohort: `mask-gold-set-calibration-v0.1` (frozen, 13 primaries).
Lanes: reference key (opus) + independent blind reviewer (opus, attested
`prohibited_files_accessed: false`, `inherited_key_context: false` — with the §Caveats leakage
qualification). Artifacts: `data/research/mask-inci/v1.0/reference-key-v0/`,
`blind-lane-v0/`, `agreement/agreement.json`. Review surface: `/labs/mask-research`.

## Agreement

| Metric | Result |
|---|---:|
| G0 gate | 12 / 13 exact |
| Nine-field profile cells (11 both-profiled products) | 98 / 99 exact (99.0%) |
| Real G0 disagreement | 1 — #12 Guhl (the charter question, routed to Nick) |
| Real profile disagreement | 1 — #10 primary_focus `general` (key) vs `moisture` (blind), the predicted AP-10-CRITERION2 gap |
| Refuse-test | passed by both lanes (#13 Olaplex excluded; maleate recorded as boundary evidence only) |
| Ruled-anchor reproduction | D5 moisture guard reproduced its ruled anchor on #09 in both lanes |

### Caveats (binding on any repeatability claim)

1. Both lanes are same-model-family agents applying the same freshly drafted text; 99% exact
   agreement is repeatability evidence for the written rules, not classification truth.
2. Blind independence is compromised for six products named in the standard's own worked
   examples (blind-notes §3). **Process rule for round 2+: cohort products must be disjoint
   from the standard's examples, or the examples must be rewritten to non-cohort products.**
3. `maleate` and `peptide` bond-route branches remain untested in-category.
4. #12's profile exists in the key lane only (provisional pending the G0 ruling).

## Tier-1 adjudications for Nick (the review agenda)

1. **AP-12-CHARTERFLIP** — Guhl 2in1 is *eligible, mode-scoped* under the charter's own F1
   five-step test (frozen directions state a 2–3-min Kur mode; F2 forbids dwell as a boundary
   test). This contradicts the charter's named exclusion example. Options: (A) correct the
   charter example (product gets a mask profile; the "no product gets two engine profiles"
   consequence of F1 then needs a rule for conditioner-side handling); (B) write an explicit
   rule that a self-labelled "Kur & Spülung" 2in1 stays Conditioner-engine territory — a real,
   documented narrowing of F1. Both lanes surfaced this independently.
2. **AP-08-TIEBREAK** — on the only `dual_supported` product (#08 Sante: three proteins vs five
   humectants), the hierarchy's step order gives `repair` while the v1.5-style claim tie-break
   would give `moisture` ("Intense Hydration" positioning). Rule question: does the claim
   tie-break apply only between routes clearing at the same hierarchy step?
3. **AP-02-BONDTAIL** — Gliss 7sec carries the gluconamide pair at ranks 11/12 with the tail
   marker at 8 (low-water serum, no cationic before Parfum). Strict tail reading (applied):
   `bond_route none`, repair `low`, primary `lightness`. Alternative reading (marker implausible
   in a non-emulsion): gluconamide, repair `high`. One rank band swings three fields; §3.1 needs
   a low-water/non-emulsion branch either way.

## Systematic threshold defects (Tier 2 — feed the v0.2 standard revision)

Weight-high gated on a conditioning test (heaviest formula lands `moderate` → fine-hair prior;
AP-06-WEIGHTGATE); weight-low unreachable for conventional emulsions (AP-07-LOWUNREACHABLE);
conditioning S-count inflates rather than collapses — `high` is modal, `low` never fires, and it
propagates into `damage_fit` (AP-12-HIGHFLOOR/AP-06-NOCATIONIC; reverses §18's priority order);
moisture-guard criterion 2 has no operational test (AP-10-CRITERION2 — produced the round's one
profile disagreement); `balanced` reachable on thin lipid evidence, making `protein`
structurally unreachable (AP-04-BALANCEDBAR); #03/#10 identical profiles show the cohort covers
fewer archetypes than slots (AP-03-TWINS); curl_support satisfiable only by baseline
(AP-03-CURLBAR). Full 35-point list + 18 candidate rule changes: `reference-key-v0/summary.md`
and the lanes' notes. The standard is UNCHANGED this round; every fix goes through Nick and a
systemic change forces a rerun (§13 / conditioner calibration rule).

## Four provisional defaults — verdicts

conditioning moderate-fallback FAILED (inflation, high modal); weight moderate held numerically
but both its anchors fail inward; care_direction moisture default held best; primary_focus
general held cleanly. Recommendation: conditioning count is fix #1.

## Stop condition

Research artifacts only. No catalog value, recommendation, Product Intake rule, Supabase row,
user-facing copy, or production matcher changes on this record's authority.


## Round-1 human review sign-off (Nick, 2026-10-06)

Reviewed in the Mask Research Lab under Standard v0.5, reference-key-v1:

- **11 of 13 products approved** per-property by Nick (lab review state, 2026-10-05/06), including
  #11 Glycolic Gloss on its finalized conservative values (AP-11 closed by the L'Oréal F.I.L.
  re-fetch, 2026-10-06).
- **#05 Isana Mandelmilch — review waived by Nick** ("I don't need to check. It's discontinued."):
  the product is confirmed discontinued (live Rossmann check 2026-10-05) and ruled
  calibration-only; its rule-exercise value is banked, it never projects to the catalog.
- **#13 Olaplex No. 3 — review waived by Nick** ("not relevant"): deliberate G0 refuse-test with a
  single gate row; the exclusion is the finding.
- **Zero open adjudication points remain** (last one closed by evidence 2026-10-06).

Round-1 review is therefore COMPLETE. Next phase: calibration round 2 under v0.5 — fresh
zero-inheritance blind rerun of the 12 classified products plus the example-disjoint unseen
adversarial set (candidates in `plans/mask-inci/freeze-gate-candidates.md`).
