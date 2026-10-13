# R6 — Neqi Rosemary Oil → Scalp Care; deep-cleansing scalp focus (research, 2026-10-09)

Read-only hair-care-expert lane (Sonnet); report persisted by the orchestrator. Verified live: `product_scalp_care_specs` CHECKs (role: scalp_comfort | scalp_flake_oil_adjunct | density_claim_tonic | scalp_exfoliant; format incl. `oil`; rinse leave_on | rinse_off) and deep-cleansing `scalp_type_focus` values below.

## 1. Neqi Smooth Strength Rosemary Oil `010cf825-4892-4f78-bf20-26ad72122c60`

Identity: 75 ml, 9,95 €, GTIN 4063528086280 (dm DAN 2972764; neqi-hair.com SKU NQ-HO-RO-201). No oil spec, no protocols today.

INCI (dm = manufacturer): sweet almond, castor, safflower oils; rosemary leaf oil; wild mint leaf oil; lavender; camphor; menthol; tocopheryl acetate; fragrance terpenes/allergens (limonene, linalool, geraniol…). No peptide despite "mit Peptiden" marketing.

Directions (manufacturer product page + how-tos "Schritt 1"; dm same): small amount onto palms or directly onto scalp, massage in circles, leave ≥10 min, then shampoo; manufacturer tip: dry or damp hair. No frequency, no dose, no warnings found (pack not seen).

Claims: manufacturer page growth/thinning-led (headline "Rosmarin-Haaröl für Haarwachstum", minoxidil comparison, "kein medizinisches Produkt"); dm page (affiliate target) care-only ("Intensive Pflege", "Pflege, Glanz").

Proposed (before → after):

| Field | Before | After |
|---|---|---|
| products.category_key | oil | scalp_care |
| primary_role | — | `density_claim_tonic` (claim-led; precedent L'Oréal Anti-Haarverlust, The Ordinary) |
| presentation_format | — | `oil` |
| rinse_mode | — | `rinse_off` |
| protocol | — | role density_claim_tonic; pre_wash; placement scalp_roots; rinse_out; contact 600 s (stated minimum); state either; cadence null → category `as_needed` fallback |

Guardrails: role = covers the cosmetic density-support job, not an efficacy claim; mandatory limitation copy ("Kann bei dünner werdendem Haar unterstützen. Die Studienlage ist noch begrenzt …"); never echo "für Haarwachstum", "regt Durchblutung an", minoxidil comparison, or "Peptide"; triggers only for users reporting hair loss/thinning; sudden/patchy/painful hair loss stays at the assessment boundary. Evidence: one small rosemary-vs-minoxidil trial (Panahi 2015) — low confidence.

Open: manufacturer growth positioning vs dm care-only copy — enough for density_claim_tonic? (rec yes); menthol/camphor/allergens have no contract field (rec add nothing now); scalp_comfort is the conservative alternative.

Side observation: Balea Serum Sensitive spec `rinse_off` vs protocol family `leave_on_scalp_care` — consistency check outside this task.

## 2. Deep-cleansing `scalp_type_focus`

Contract (`docs/personal-plan/categories/deep-cleansing/decision.md`): `targetScalpTypes` is an array of soft targets from finished-product sources; `[]` = reviewed, no explicit target. DB column is single-valued (oily | balanced | dry). Stage-3 adapter does not read it today; only the legacy chat engine does.

| Product | DB now | Source wording | Source-backed |
|---|---|---|---|
| NEQI `07895098` | balanced | "besonders bei trockener und juckender Kopfhaut"; also "Kopfhaut mit Ablagerungen oder überschüssigen Talg"; "ausgleichend" | dry explicit; oily only via sebum removal |
| Gliss | oily | "speziell für ölige Kopfhaut" | oily (explicit) |
| Balea | oily | "überschüssiges Fett von Haar und Kopfhaut", "für alle Haartypen" | no explicit scalp type ([]) |
| Swiss-O-Par | balanced | "Für jeden Haartyp", anti-lime | [] |
| ISANA (snippet only) | balanced | "für alle Haartypen" | [] |

Rule question: explicit scalp-type words only (→ oily = Gliss only) vs sebum-removal wording counts (→ Gliss, Balea, NEQI oily). "Juckende Kopfhaut" is medically adjacent; deep-cleansing execution already pauses for irritated/dry-dandruff users.
