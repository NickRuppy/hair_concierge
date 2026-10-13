# Slice 1 — data change set (generator spec)

Source of values: `research/r1-leave-in-heat/findings.json`, `research/r2-bondbuilder/findings.md`, `research/r3-identity-cadence-duplicates/findings.json`, `research/r4-user-submitted-14/{findings.json,proposal/protocol-rows.json,leave-in-v1.1/**,mask/**}`, `research/r6-scalp-oil-neqi/findings.md`. Rulings: `decisions.md`. Pattern: `research/x4-migration-pattern/facts.md` (Kevin Murphy generator structure, P08 fresh-DB skip, generated-column skip-list incl. `product_identifiers.normalized_identifier_value` + `.canonical_gtin14`, `product_application_protocols.application_family` + `.category_key`, `product_leave_in_specs.conditioner_relationship`).

Every value below is applied only if the live preimage equals the captured prestate (CAS); NULL fails closed. Nothing is applied to production without Nick's approval of the generated batch (fingerprint).

## Group A — Leave-in heat (curated, recommended)

| Product | Change |
|---|---|
| Alcina Hyaluron 2.0 `9b664b11` | `provides_heat_protection` false→true; add heat eligibility rows (`expand_leave_in_eligibility` semantics) |
| Neqi Build Boost `9f94c225` | same |
| Neqi Moisture Mystery `e6896862` | same |
| Pantene Bonding `35a372b6` | same; `application_stage` [towel_dry] → [towel_dry, dry_hair] |
| Pantene HEAT&GLOW `e781ca9e` | same; `application_stage` [towel_dry] → [towel_dry, pre_heat, dry_hair] |
| Urban Alchemy `45f4fe15` | same |
| Gliss `5dc2fae3`, Olaplex No.6 `4e99706a`, Redken `2b7db7e3` | no spec change (pass after T1.1) |

All nine: re-point the `pre_heat_protection` protocol `source_url`/`source_text` (+ `evidence[].sourceUrl`) to the C2/C1 sources in R1 where the current source is non-German or weak. Provenance: one `personal_plan_catalog_fact_evidence` row per changed fact (fact_key `provides_heat_protection` / `application_stage`, R1 source + verbatim quote).

## Group B — Bondbuilder (curated, recommended)

| Product | Change |
|---|---|
| Aveda `04a83f16`, Kérastase `2490911e`, L'Oréal Elvital `e5fd7ff9`, OGX `2c809d0d`, Redken `9e5da870` | `products.category` NULL → `'Bondbuilder'` |
| Aveda `04a83f16` | insert identifier `gtin` `018084067994` (source R2) |
| K18 `38dace91` | protocol cadence `copy_de` → German manufacturer wording (R2 §3: DE page selects 4 consecutive washes, then every 4th wash); kind stays `label_course` unless the German wording requires another allowed kind |
| OGX `2c809d0d` | protocol `9683f6e4` cadence NULL → `{"kind":"label_schedule","copy_de":"Ein- bis zweimal pro Woche anwenden."}` (UK manufacturer page, Nick ruling B2) |

Bondbuilder validators (`bondbuilder_validate_bound_row_v1`) must keep passing; research profiles are not rewritten.

## Group C — Retirement + removal

| Product | Change |
|---|---|
| L'Oréal Öl Magique Midnight Serum (oil row) `21a94166` | tombstone: `is_chaarlie_recommended=false`, `is_active=false`, `lifecycle_status='discontinued'`; `product_relationships` `replaced_by` → leave-in `6b01025d`; move GTIN 3600524135805 to `6b01025d` (same transaction). Precondition: 0 owners, 0 drafts (verified 2026-10-09). |
| Garnier Fructis Sleek & Stay `c574ee6f` | `is_chaarlie_recommended=false`; disposition `retired_from_personal_plan` / `wrong_category` (handed to Styling), sources from X3 (garnier.de "Leave-in-Haarserum … durch Hitze aktiviert") |

Deferred to S5: Pantene 7in1 leave-in row `f8f3b51d` (13 completed + 1 stale draft, 1 leave-in owner; no reference-migration mechanism yet). Balea Tiefenreinigung keeps both rows (Shampoo v1.6 R6).

## Group D — User-submitted scan-visible products (not recommended; stay `user_submitted`)

| Product | Change |
|---|---|
| Syoss Fullness `b761256d`, Syoss Volume `f8a8fd56`, Ultimate Shampoo `88c230c5` | 1 shampoo protocol each (V1+V2, shared template) from R4 `protocol-rows.json` |
| Jean&Len Colorglow `4f67cb6d`, John Frieda `62ff4f08`, Neqi Conditioner `5f4f1300`, Pantene Moisture Boost `931892fb`, GLISS Liquid Silk `7fb31d10` | 1 conditioner protocol each (same source) |
| Pantene Moisture Boost `931892fb` | identifier GTIN 08700216939140 → 8700216939508 (200 ml bottle) |
| AUSSIE SOS `ba326dab` | Leave-In v1.1 projection (R4 `leave-in-v1.1/aussie`): specs + eligibility 8→4 rows; roles → `[replacement_conditioner]` (generated `conditioner_relationship` follows); 1 post-wash protocol |
| Balea Hair Sealer `ea88a333` | Leave-In v1.1 projection (R4 `leave-in-v1.1/balea`) with application stages per the 2026-09-18 ruling; GTIN 4070765027518; 2 protocols (post-wash + pre-heat) |
| Bali Curls N°3 `694c4568` | Leave-In v1.1 projection BUT `provides_heat_protection=false`, `plan_roles=[post_wash_leave_in]`, no `heat_protect` benefit, no heat eligibility rows (ruling H4); 1 post-wash protocol |
| Jean&Len Rosemary/Ginger mask `e5cfad78` | Mask v1.0 projection (R4 `mask/`); thickness fine/normal/coarse; 1 mask protocol, contact time 300–1800 s from the manufacturer (range → `contact_time_seconds` per template §2.5) |
| Neqi Smooth Strength Rosemary Oil `010cf825` | recategorise oil → `scalp_care` (KM order); `product_scalp_care_specs` primary_role `density_claim_tonic`, presentation_format `oil`, rinse_mode `rinse_off`; protocol: pre-wash, scalp/roots, rinse with shampoo, contact ≥600 s, cadence null (category `as_needed` fallback); copy must not echo growth/minoxidil/peptide claims; mandatory limitation copy where the scalp-care density role renders it |

Deferred to S3: Neqi Diamond Glass Ultimate Styling Spray protocols (bespoke heat-activated guidance).

## Group E — Small identity facts

| Product | Change |
|---|---|
| Epres `f8a63590` | `net_content_value/unit` NULL → 30 / ml |
| Balea Aqua Hyaluron 3in1 mask `55727898` + leave-in `c6e80f39` | net content → 150 / ml (where NULL) |

## Out of this batch (noted)
Provenance rows for Balea Hydra Volume, Balea 2in1 Urea, Nivea Volumen & Kraft (target-contract migration debt); DB publication gate's pre-heat branch still requires `pre_heat` in `application_stage` (harmless for Group A — post-wash branch passes; align in S3); `products.embedding` re-embed for the Neqi recategorisation (follow-up step after apply, KM §8).
