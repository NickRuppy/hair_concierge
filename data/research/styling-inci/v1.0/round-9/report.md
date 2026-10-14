# Styling research engine — MINI re-check r9

**240/240 user-facing cells agree (100%); 16/16 products fully agree.** 15 fields per product; application moment compares primary only.

**Lock verdict: PASS under the requested R3-L/R4-L disagreement criterion.** No authoritative A/B user-facing disagreements or unresolved b/c/d disagreements. 1 shared clear-rule error(s) are disclosed separately: agreement-based lock readiness does not certify all ruling effects or all outputs correct.

**Ruling-effect caveat:** 1 shared error(s), affecting 2 lane assignments, remain outside the A/B disagreement counts. Both lanes omit the explicitly promised texture secondary for Balea Styling Spray Volumenpuder Pure Styling. R8-Q2 has therefore **not fully landed**. This PASS is a comparison-based readiness result, not a claim that the profiles need no correction or that LOCK-1 has been reinstated.

A/B disagreement cells: **a=0, b=0, c=0, d=0**. These are field-cell counts; shared errors are counted separately. A=Claude Opus; B=Codex. Neither lane receives a preference.

Scope: 16 selected from 143 screened records. Cohort/id-map/packet joins and scope reason classes agree; 51 frozen artifacts match their hashes. The broad volume/freshness screen includes semantic false positives; inclusion alone assigns no route.

## Ruling effects

R8-Q1 Big Hair Day: **PASS** in both. R8-H Moroccanoil Glättende Creme: **PASS** in both. R8-Q2: **9/9 applicable powder primary jobs pass**, with 1 formula-blocked powder checked for suppression. **4/5 required texture secondaries pass** in both. Redken Powder Grip is the two-job exception: its lead makes texture primary and volume secondary.

| Ruling | Product | Expected | A | B | A / B landed |
|---|---|---|---|---|---|
| R8-Q1 | L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray)<br>`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | {"route":{"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null}} | yes / yes |
| R8-H | Moroccanoil Glättende Creme (Smoothing Lotion)<br>`moroccanoil-glaettende-creme-smoothing-lotion` | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | {"route":{"destination":"leave_in","state":"route:leave_in","boundary_reason":null}} | yes / yes |
| R8-Q2 | Balea Haarpuder Volumen (Pomegranate)<br>`balea-haarpuder-volumen-pomegranate` | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Balea MEN Styling Powder<br>`balea-men-styling-powder` | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Balea Styling Spray Volumenpuder Pure Styling<br>`balea-pure-styling-volumenpuder-spray` | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | {"primary_job":"volume","secondary_jobs":["hold_fix"]} | **NO** / **NO** |
| R8-Q2 | BALI GENTS VOLUMIZING STYLING POWDER<br>`bali-gents-haarpuder-volumizing-styling-powder` | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":[]} | {"primary_job":"volume","secondary_jobs":[]} | yes / yes |
| R8-Q2 | got2b Styling Puder Volumen Powderfull<br>`got2b-styling-puder-volumen-powderfull` | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":[]} | {"primary_job":"volume","secondary_jobs":[]} | yes / yes |
| R8-Q2 | Kevin.Murphy Powder.Puff Volume<br>`kevin-murphy-powder-puff-volume` | {"primary_job":null,"secondary_jobs":null}<br>Profile N/A; suppression only | {"primary_job":null,"secondary_jobs":null} | {"primary_job":null,"secondary_jobs":null} | yes / yes |
| R8-Q2 | Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder)<br>`moroccanoil-textur-und-volumenpuder` | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["texture"]} | {"primary_job":"volume","secondary_jobs":["texture"]} | yes / yes |
| R8-Q2 | Schwarzkopf Professional OSiS Dust It<br>`osis-dust-it` | {"primary_job":"volume","texture_secondary_required":true,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | {"primary_job":"volume","secondary_jobs":["hold_fix","texture"]} | yes / yes |
| R8-Q2 | Redken Powder Grip (03 Mattifying Hair Powder)<br>`redken-powder-grip-03` | {"primary_job":"texture","texture_secondary_required":false,"volume_secondary_required":true} | {"primary_job":"texture","secondary_jobs":["volume"]} | {"primary_job":"texture","secondary_jobs":["volume"]} | yes / yes |
| R8-Q2 | Schwarzkopf taft Haarpuder VOLUMEN<br>`schwarzkopf-taft-haarpuder-volumen` | {"primary_job":"volume","texture_secondary_required":false,"volume_secondary_required":false} | {"primary_job":"volume","secondary_jobs":[]} | {"primary_job":"volume","secondary_jobs":[]} | yes / yes |

The remaining volume/freshness candidates confirm why screen membership is not a Dry Shampoo instruction:

| Product | A route/state | B route/state |
|---|---|---|
| BALI CURLS Volumizing Curl Spray | {"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"} | {"destination":"provisional_boundary","state":"held","boundary_reason":"pending_leave_in_addendum"} |
| Batiste TROCKENSHAMPOO ALL IN ONE fruchtig frischer Duft | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} |
| got2b Trocken SHAMPOO Extra Volumen | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} |
| L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo) | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} | {"destination":"dry_shampoo","state":"route:dry_shampoo","boundary_reason":null} |

## Every A/B user-facing disagreement

None after documented semantic normalization. Thus there are no A/B lane-error adjudications, rule-gap fixes, packet repairs or owner questions to list. Both-defensible readings would require b/d, never a; the script stops on any new unadjudicated difference.

## Shared clear-rule error — not an A/B disagreement

### Balea Styling Spray Volumenpuder Pure Styling — secondary_jobs

`balea-pure-styling-volumenpuder-spray` · `sty-9e36684be9` · **class a, both lanes wrong; neither lane is right.**

A=["hold_fix"]; B=["hold_fix"]. Correct ordered value: **["hold_fix","texture"]**.

R8-Q2 is later, higher-authority and specific to powders: a C1/C2 line promising texture/grip qualifies. The legacy promise-only filter cannot exclude this exact promise merely because its packet type is other. Silica r7 is credited with no T_S present; particulate passes the texture gate and the second slot is free. Both lanes omit texture.

Rules: `plans/styling-concept/02-rulings.md:162` (R8-Q2); `docs/research/styling-inci/v1.0/styling-classification-standard.md:762` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:762` (§6.10); `docs/research/styling-inci/v1.0/styling-classification-standard.md:371` (§3.3). Frozen C2 evidence: “griffige Textur direkt am Ansatz” (C2_house_brand; type other).

**Fix:** Add texture after hold_fix in both derived profiles; preserve frozen lane files. If guidance is clarified, state explicitly that R8-Q2 powder texture/grip eligibility includes C1/C2 other lines. No new owner policy is needed.

No owner question: the later powder-specific owner rule settles eligibility. This clear error does not create a b/d gap. It fails the named ruling-effect check, while the requested A/B lock predicate remains separate. Frozen results remain unchanged.

## Hold check

**Authoritative values: 16/16 agree**, including 12 null/null pairs and 4 emitted numeric levels. **Raw storage: 15/16 agree.** The bounded packet-derived hold oracle matches both authoritative outputs on **16/16**.

| Product | Authoritative A / B | Raw A / B | Captured claim level |
|---|---|---|---|
| Balea Haarpuder Volumen (Pomegranate) | 3 / 3 | 3 / 3 | 3 |
| Balea MEN Styling Powder | 3 / 3 | 3 / 3 | 3 |
| Balea Styling Spray Volumenpuder Pure Styling | 1 / 1 | 1 / 1 | 1 |
| BALI CURLS Volumizing Curl Spray | null / null | null / null | null |
| BALI GENTS VOLUMIZING STYLING POWDER | null / null | null / null | null |
| Batiste TROCKENSHAMPOO ALL IN ONE fruchtig frischer Duft | null / null | null / null | null |
| got2b Styling Puder Volumen Powderfull | null / null | null / null | null |
| got2b Trocken SHAMPOO Extra Volumen | null / null | null / null | null |
| Kevin.Murphy Powder.Puff Volume | null / null | null / null | 1 |
| L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) | null / null | null / null | null |
| Moroccanoil Glättende Creme (Smoothing Lotion) | null / null | null / null | null |
| Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) | null / null | null / null | null |
| Schwarzkopf Professional OSiS Dust It | 3 / 3 | 3 / 3 | 3 |
| Redken Powder Grip (03 Mattifying Hair Powder) | null / null | null / null | null |
| Schwarzkopf taft Haarpuder VOLUMEN | null / null | null / null | null |
| Wella Professionals EIMI Volume Dry Me (Trockenshampoo) | null / null | null / 1 | 1 |

Wella EIMI Dry Me: A omits Styling hold; B retains claim-derived 1 explicitly as informational in notes. Neither projects an authoritative Styling hold value on this Dry Shampoo. Kevin.Murphy’s captured Sanfter Halt would yield 1, but its formula-conflict gate suppresses the whole profile. Neither is a user-facing hold mismatch.

Hold rules: `docs/research/styling-inci/v1.0/styling-classification-standard.md:597` (§4.7); `docs/research/styling-inci/v1.0/styling-classification-standard.md:829` (§7.2); `docs/research/styling-inci/v1.0/styling-classification-standard.md:857` (§7.4); `plans/styling-concept/02-rulings.md:123` (R3-H5). Authoritative comparison plus unmasked raw comparison. Packet-derived bounded hold oracle applies claim-only strength, emission and formula-conflict suppression; Wella Dry Me informational 1 is retained in raw diagnostics, not projected as Styling hold.

## Latent wording ambiguities — non-blocking

2 observations concern values on which both lanes agree. They are not demonstrated A/B gaps or new owner questions.

- **BALI GENTS VOLUMIZING STYLING POWDER — secondary_jobs**, A/B=[]: Does natürlich strukturierten Look explicitly promise the texture job? The vocabulary does not map strukturiert alone. The curl-specific definition rule does not settle this texture wording. Recommendation: Retain the agreed omission pending an explicit vocabulary amendment; no texture is inferred from C3 grip claims. Rules: `docs/research/styling-inci/v1.0/styling-classification-standard.md:762` (§6.10).
- **Redken Powder Grip (03 Mattifying Hair Powder) — flexibility**, A/B="beweglich": The flexibility word flexibler occurs in a feel sentence (fühlt sich … an). Both read beweglich; §6.9 lists flexibel without excluding feel phrasing. Recommendation: Keep beweglich. Clarify the wording editorially if desired; this is no demonstrated A/B rule gap. Rules: `docs/research/styling-inci/v1.0/styling-classification-standard.md:752` (§6.9).

B also reports a typed-other-line concern for Balea Volumenpuder Spray. It is resolved by existing R8-Q2 and recorded as the shared error above, not counted again as a latent ambiguity or unresolved policy question.

## Agreement and normalization

| User-facing field | Agree / all | Disagree | Agreement |
|---|---|---|---|
| route | 16/16 | 0 | 100% |
| subtype | 16/16 | 0 | 100% |
| hold_level | 16/16 | 0 | 100% |
| weight | 16/16 | 0 | 100% |
| finish | 16/16 | 0 | 100% |
| flexibility | 16/16 | 0 | 100% |
| target_zone | 16/16 | 0 | 100% |
| application_moment | 16/16 | 0 | 100% |
| primary_job | 16/16 | 0 | 100% |
| secondary_jobs | 16/16 | 0 | 100% |
| provides_heat_protection | 16/16 | 0 | 100% |
| heat_activated | 16/16 | 0 | 100% |
| alcohol_note | 16/16 | 0 | 100% |
| buildup_note | 16/16 | 0 | 100% |
| neutral_fact | 16/16 | 0 | 100% |

### Products fully agreeing

- Balea Haarpuder Volumen (Pomegranate) (`balea-haarpuder-volumen-pomegranate`).
- Balea MEN Styling Powder (`balea-men-styling-powder`).
- Balea Styling Spray Volumenpuder Pure Styling (`balea-pure-styling-volumenpuder-spray`).
- BALI CURLS Volumizing Curl Spray (`bali-curls-volumizing-curl-spray-refreshing`).
- BALI GENTS VOLUMIZING STYLING POWDER (`bali-gents-haarpuder-volumizing-styling-powder`).
- Batiste TROCKENSHAMPOO ALL IN ONE fruchtig frischer Duft (`batiste-trockenshampoo-all-in-one`).
- got2b Styling Puder Volumen Powderfull (`got2b-styling-puder-volumen-powderfull`).
- got2b Trocken SHAMPOO Extra Volumen (`got2b-trockenshampoo-extra-volumen`).
- Kevin.Murphy Powder.Puff Volume (`kevin-murphy-powder-puff-volume`).
- L'ORÉAL PARiS ELVITAL Volumenspray Big Hair Day (Erfrischendes Volumen Spray) (`loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray`).
- Moroccanoil Glättende Creme (Smoothing Lotion) (`moroccanoil-glaettende-creme-smoothing-lotion`).
- Moroccanoil Textur- & Volumenpuder fürs Haar (Texture & Volume Hair Powder) (`moroccanoil-textur-und-volumenpuder`).
- Schwarzkopf Professional OSiS Dust It (`osis-dust-it`).
- Redken Powder Grip (03 Mattifying Hair Powder) (`redken-powder-grip-03`).
- Schwarzkopf taft Haarpuder VOLUMEN (`schwarzkopf-taft-haarpuder-volumen`).
- Wella Professionals EIMI Volume Dry Me (Trockenshampoo) (`wella-eimi-volume-dry-me`).

### Semantic normalization audit

Authority: `docs/research/styling-inci/v1.0/styling-classification-standard.md:597` (§4.7). Non-Styling optional observations are excluded only when explicitly marked informational. B places the explicit marker in notes; its location does not turn observations into authoritative fields. No held profile is suppressed. Route/state/reason and subtype remain scored on every record.

| Lane | Explicitly informational product | Excluded non-null fields |
|---|---|---|
| B | `batiste-trockenshampoo-all-in-one` (marker: notes) | weight, finish, flexibility, target_zone, application_moment, primary_job, secondary_jobs, provides_heat_protection, heat_activated, alcohol_note, buildup_note |
| B | `got2b-trockenshampoo-extra-volumen` (marker: notes) | weight, finish, flexibility, target_zone, application_moment, primary_job, secondary_jobs, provides_heat_protection, heat_activated, alcohol_note, buildup_note |
| B | `loreal-paris-elvital-big-hair-day-erfrischendes-volumenspray` (marker: notes) | weight, finish, flexibility, target_zone, application_moment, primary_job, secondary_jobs, provides_heat_protection, heat_activated, alcohol_note, buildup_note |
| B | `moroccanoil-glaettende-creme-smoothing-lotion` (marker: notes) | weight, finish, flexibility, target_zone, application_moment, primary_job, secondary_jobs, provides_heat_protection, heat_activated, alcohol_note, buildup_note |
| B | `wella-eimi-volume-dry-me` (marker: notes) | hold_level, weight, finish, flexibility, target_zone, application_moment, primary_job, secondary_jobs, provides_heat_protection, heat_activated, alcohol_note, buildup_note |

- route is compared as {destination,state,boundary_reason}; boundary_reason is populated only for provisional_boundary. This retains evidence_gate, formula_conflict, mixed_promise, li_g0_provisional and pending_leave_in_addendum; committed and held are never folded together. Non-boundary pair/reason vocabulary remains calculation log.
- application_moment compares primary only: {primary,also[]} versus string. also[] is excluded as requested. provides_heat_protection compares the boolean value, not research-trace wrappers.
- buildup/alcohol notes: false, {fired:false}, not_fired and does_not_fire -> does_not_fire; true, {fired:true}, fired and fires -> fires. null remains null.
- Set-valued arrays (secondary_jobs, mechanisms, review_triggers, flags) are deduplicated and sorted. Object keys are sorted for comparison. Free prose and rule-path order remain log differences, not behavioural defects.
- neutral_fact folds whitespace, typographic quotation marks and case as round 4. Tail INCI folds case, whitespace and Parfum/Fragrance aliases; rank/status remain visible, T_S.alt is diagnostic-only.
- Empty secondary_jobs/d8b_flags and null are equivalent only without a Styling profile (§4.7). Optional non-Styling observations are excluded only with explicit informational_and_non_authoritative:true, at record level or in notes. Route and subtype remain scoreable; held profiles are never masked. Raw values and each exclusion remain in the normalization audit.
- confidence_internal is mapped to confidence; promise unknown/null -> not_assigned. Other lane-A-only fields are retained as schema-asymmetric calculation-log columns; missing is null. No user-facing disagreement is removed by adjudication.

Raw and normalized values for each lane/product, plus excluded fields, are retained in diff.json. Calculation-log agreement: 127/224 cells; 97 differences. These trace/schema differences never block R4-L.

## Lock predicate and reproduction

| Criterion | Result |
|---|---|
| Every A/B user-facing disagreement is a proven lane error against a clear rule | **PASS** |
| No unresolved user-facing disagreement rule gaps (b), packet issues (c) or owner questions (d) | **PASS** |

**PASS:** No authoritative A/B user-facing disagreements or unresolved b/c/d disagreements. 1 shared clear-rule error(s) are disclosed separately: agreement-based lock readiness does not certify all ruling effects or all outputs correct.

- The lock verdict implements the requested A/B disagreement criterion. Shared clear-rule errors are separate, not fabricated disagreements, unresolved rule gaps or owner questions.
- Ruling-effect failure remains visible even if the disagreement-based lock verdict passes. This receipt does not reinstate LOCK-1, correct frozen lane records or activate production.
- Known-product MINI confirmation, not new unseen validation or full-cohort validation. Formula-conflict Kevin.Murphy has no profile; Bali Curls remains held and unmatchable.
- Analyst rule interpretations are explicit. Counts, coverage, flags, holds, manifests, classifications totals and verdict are computed; unexpected disagreements or ruling failures stop the script.
- Current ledger and current v0.5 documents govern. Older lexicons in the supplied directory are hashed for provenance, not applied over v0.5.

Run `node data/research/styling-inci/v1.0/round-9/diff.js --summary` twice and compare SHA-256 of both output files. The generator emits no timestamps, randomness or absolute paths and writes only sibling diff.json and report.md. All inputs, packets, governing docs and the adapted script are fingerprinted in diff.json.

diff.json SHA-256: `b0721e34162c0a4d955d5c236d06f1600af2573ea3297f6b1347d376593d9747`.
