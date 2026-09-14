# Mask v1.0 category charter

Status: ruled by Nick — Phase 1 checkpoint complete
Version: 1.0
Market: Germany/EU
Ruling date: 2026-09-04
Amended: 2026-09-14 — **R1 only** (Nick's round-1 rule rulings, `plans/mask-inci/round1-rule-rulings.md`): the Guhl boundary case is corrected to eligible/mode-scoped, and the F1 principle is restated as "no MODE is profiled twice". No other ruling is applied to this file; R2–R9 live in the standard and the lexicon. Placement wording in the Category definition below is **not** amended here — see Standard v0.2 §2.1/§18.9 for R8's G0 placement default and the open reconciliation item.

## Category definition

A product is eligible when its authoritative directions describe a rinse-out intensive treatment (Haarkur/Maske) applied after cleansing to hair lengths and ends, with a product-stated contact time, then rinsed out. The research unit is the exact market product, pack/formula version — not a brand line or marketing name.

The engine classifies **use, not jar**: for a product with several stated modes, only the rinse-out mask mode is classified (see F1 below).

## Included (Phase 1 rulings F1–F4)

- **Rinse-out Haarkuren/Masken for lengths and ends, at every stated dwell duration.** Express treatments (7 sec / 30 sec / 1 minute Kuren) are in scope: marketed form and the `intensive_conditioning_mask` role decide; dwell is protocol metadata under P5, never a boundary test. (F2)
- **Bond-claim drugstore masks** (Plex/Bond positioning, e.g. Balea Plex Care, Gliss Bonding, Pantene Bond Repair). The bond route is claim-gated, mirroring the Conditioner R7 pattern; a high repair-support conclusion requires named chemistry visible in the reviewed formula. (F3)
- **Gloss/lamination rinse-out treatments** (e.g. Glycolic Gloss lamination, lamination glazes): treated as shine-focused masks; lamination/acid-gloss claims remain claim-gated and conservative. (F4)
- **Multi-use products (3in1/2in1) — mode-scoped.** Eligible when authoritative directions state a distinct rinse-out mask mode with dwell. Classification covers only that mode; the research envelope carries `multi_use: true` and names the uncovered modes (leave-in, conditioner). A multi-use product **none of whose** rinse-out modes states a dwell — an immediate-rinse Spülung mode only — is not eligible here. **No MODE is ever profiled twice (R1, Nick, 2026-09-14 — corrected principle).** v0.1 of this charter said "no *product* receives two engine profiles"; that phrasing forced a whole multi-mode product onto one engine and produced the Guhl error below. The correct principle is mode-scoped: a multi-mode product **may hold one profile per engine, covering one mode each**, and no single mode may be profiled by two engines. This is consistent with, and forward-compatible with, the parked cross-category multi-row architecture. (F1)

## Excluded

- Leave-on-only "masks" and overnight treatments (leave-in / bondbuilder territory).
- Pre-shampoo-only treatments.
- Products in the `bondbuilder` catalog category with specialist protocols (Olaplex-style).
- Color-depositing masks, scalp/medicated treatments, salon back-bar chemistry.
- Ampoule/shot formats unless directions are post-shampoo rinse-out with dwell.

These exclusions are inherited from the projection contract: an excluded form cannot take the `intensive_conditioning_mask` role and the TPL-MASK protocol that the engine's fixed projection targets require. Excluded catalog rows stay visible as boundary evidence and stress cases; they are never forced through the mask ontology.

## Population and medical boundary

Healthy/cosmetic population. G6-equivalent boundary: no diagnosis, treatment, hair-loss lifecycle, inflammation, infection, or structural-regeneration suitability. Cosmetic guidance stays separate from medically adjacent scalp or hair-loss guidance.

## Evidence boundary

- E0–E5 evidence scale per the Conditioner standard §3; formula-only evidence stops at E2.
- EU Article 19 rank semantics: ordered above 1%, arbitrary below; the boundary is invisible.
- Contact time is **never** derived from INCI: P5 requires the exact dwell from the authoritative product source, with a source. A stamp without a sourced contact time is invalid.
- Ingredient presence proves a clue, not concentration, delivery, or user experience.

## Protocol boundary (owned by TPL-MASK / P5)

Längen und Spitzen, Ansatz aussparen; canonical conditioner relationship `replaces_conditioner` — on a mask day the mask takes the conditioner slot; `conditioner_after` needs an explicit sourced sequence.

## Coverage target

≥80% of the German drugstore (dm/Rossmann/Müller) rinse-out mask shelf classifiable without falling to a boundary exclusion. Calibration is anchored in the archetype space of the current 50-product catalog Maske cohort.

## Known boundary cases (live catalog, 2026-09-04)

- Garnier/Fructis Hair Food line, Balea 3 in 1 Intensivmaske, Isana 3in1, Balea Aqua Hyaluron 3 in 1: multi-use → eligible mode-scoped (F1); 8 such products are live and `is_chaarlie_recommended`.
- Guhl Panthenol + Reparatur 2in1 Kur & Spülung: **eligible, mode-scoped (R1, Nick, 2026-09-14 — corrects the 2026-09-04 entry, which read "conditioner-mode only → excluded here").** The **directions test decides**, not the pack name: this product states a distinct **2–3-minute Kur mode** — after cleansing, stated contact time, rinsed out — and that mode qualifies as a mask mode (F1). It is classified in that mode only, with `multi_use: true` and `multi_use_uncovered_modes: ["conditioner"]`. Its Spülung mode is an immediate-rinse conditioner mode and stays Conditioner-engine territory; that profile is **untouched and not in conflict**, because the two engines cover two different modes and no mode is profiled twice.
- Gliss 7sec Express-Repair, Guhl 30 sec, Wahre Schätze 1-Minute Kuren: express → included (F2).
- Bali Curls Bonding Repair Overnight Elixir: leave-on overnight → excluded.
- Pantene Pro-V Serum Shot: eligible only if directions show post-shampoo rinse-out with dwell.
- L'Oréal Elvital Glycolic Gloss 5-Min-Laminierung, Syoss Lamination Intense Glaze, Neqi Gloss Glaze: gloss/lamination → included, claim-gated (F4).

## Parked out of scope (acknowledged by Nick 2026-09-04)

Cross-category multi-row architecture (one 3in1 → sibling rows in mask/conditioner/leave-in, each with category-appropriate properties). Affected work parked with it: scan GTIN disambiguation, routine double-slot semantics, sibling-row intake. Mode-scoped classification (F1) is forward-compatible with this program.

## Stop condition

This charter and all Mask engine phases produce research artifacts only. No catalog value, recommendation, Product Intake rule, Supabase row, user-facing copy, or production matcher changes.
