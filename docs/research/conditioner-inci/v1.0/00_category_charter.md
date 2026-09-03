# Conditioner v1.0 category charter

Status: frozen for Stage A calibration
Version: 1.0-draft
Market: Germany/EU
Capture date: 2026-08-23

## Category definition

A product is eligible when its authoritative directions describe a conventional, short-contact, water-rinsed conditioner used primarily on hair lengths and ends after cleansing. The research unit is the exact market product, pack/formula version, not a brand line or marketing name.

## Included

- Rinse-out conditioners and Spülungen for lengths and ends.
- Mainstream, professional, natural-positioned, curl-oriented, color-oriented, volume, repair, and bond-claim variants.
- A rinse-out product called “2in1 Kur & Spülung” only when authoritative directions provide one short rinse-out mode and no leave-on or materially different mask protocol.

## Excluded

- Leave-ins, creams or sprays whose directions say not to rinse.
- Masks/deep treatments and products with a distinct intensive contact-time mode.
- Multi-use formulas permitting both rinse-out and leave-on use.
- Co-washes/cleansing conditioners, color-depositing conditioners, two-phase sprays, scalp-treatment or medicated products, and salon chemistry.

Excluded catalog rows remain visible in the cohort and may be retained as stress cases; they are never forced through the rinse-out ontology.

## Research decision

The standard may describe exact formula observations, plausible direct conditioner routes, direct product properties, and cautiously derived context fit. It must not diagnose a user, infer ingredient deficiency, predict allergy, treat scalp disease or hair loss, or convert marketing repair/bond/color claims into efficacy.

## Evidence boundary

- Formula-only evidence stops at E2.
- Exact finished-product instrumental evidence can support E3.
- Controlled human-use evidence can support E4.
- E5 requires strong replicated or consensus finished-product evidence.
- EU INCI order permits only bounded rank observations: ingredients above 1% are ordered; the under-1% tail may be arbitrary. The boundary is not visible on a consumer label.
- Bottle rheology, cream thickness, ingredient presence, reviewer agreement, and existing catalog labels are not performance tests.

## Identity gate

Before classification, capture product UUID, exact brand/name, market, pack size, at least one reliable identity anchor when available, dated formula source, raw INCI, normalized formula fingerprint, product-form status, and source conflicts. A missing catalog barcode is a research gap, not authority to write one.

## Direct decisions the authority supports

- Conditioning/deposition architecture.
- Wet slip/detangling and dry combability as separate endpoints.
- Surface lubrication/softness route and shine route.
- Weight/deposition potential, rinse behavior, cumulative residue, and body/lightness as separate uncertain properties.
- Temporary lubrication/protection, surface-film, bond-claim, and color/chemical-damage routes.
- Fragrance/scalp exposure plus exact application and rinse protocol metadata.

## Known boundary cases

- Cantu Leave-In Repair Cream: excluded, leave-in only.
- Garnier Macadamia Hair Food: excluded, official 3-in-1 mask/conditioner/leave-in.
- Pantene Miracles Bond Repair Conditioner: excluded, exact product permits rinse-out and leave-on use.
- Guhl Panthenol + Reparatur 2in1 Kur & Spülung: eligible; official use is one immediate rinse-out mode.
- L’Oréal Elvital Fiber Booster Anti-Haarverlust Spülung: product form eligible; hair-loss/lifecycle claims are quarantined from formula-derived matching.

## Stop condition

Stage A produces research artifacts only. No catalog value, recommendation, Product Intake rule, Supabase row, user-facing copy, or production matcher changes.
