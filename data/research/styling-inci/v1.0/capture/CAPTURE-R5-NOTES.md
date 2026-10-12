# Capture round 5 notes: smoothing_styler hunt (2026-10-12)

Capture only; no classification, no hold-level guesses. File: `round3-smoothing-r5.json` (4 records, format as `round2-new-r4.json`, plus one extra key `why_smoothing_styler`; `hold_claim` carries extra `tier`/`source` keys).

## Counts
Captured 4 / passing all three items (complete INCI + verbatim German directions + at least one C1/C2 promise line) 4. Only 1 is a clean fit for the brief; the other 3 are explicitly weak/boundary (flagged `boundary_probe: true`).

| Product | Source | Lead promise | Fit |
|---|---|---|---|
| KMS Thermashape Straightening Creme | kmshair.com/de-DE (C2) | "Verwandelt kräftiges oder widerspenstiges Haar in vielseitige, glatte Styles, die bis zur nächsten Haarwäsche halten. Bietet Hitzeschutz." | strong; no hold stated |
| KMS Thermashape 2-in-1 Spray | kmshair.com/de-DE (C2) | "Hitzereaktives Spray ... Ideal zum Glätten und für Lockenstylings mit Hot Tools." Hold: "Sorgt für extra Halt und Styles, die bis zu 72 Stunden halten." | weak: straight AND curl, also finish spray |
| got2b Anti-Frizz Lotion Schmusekatze | pack C1 (dm photos), got2b.de C2, dm | pack: "für ein sleekes Finish & ein weiches Haargefühl", "Bis zu 72 h Anti-Frizz-Kontrolle" | weak: no hold, care + heat-protection hack |
| Balea Styling Glow Wax | pack C1 (dm photos), dm C2 house brand | pack: "zart schimmerndes Finish und Halt", "Ideal für Sleek-Looks", "flexibler Halt" | weak: shine/shimmer-led wax |

## Sources used
- dm search API (`product-search.services.dmtech.com/de/search/crawl`, rate-limited; I paced requests) to enumerate the whole dm category "Styling Spray & Creme" (26 products) and many keyword queries; dm detail endpoint for INCI/Verwendungshinweise/bullets/pack photos. Pack photos (Schmusekatze front/back, Glow Wax front/side/back) read by eye; barcodes and pack INCI match the dm data.
- Manufacturer pages: kmshair.com/de-DE (German region site of KMS, Kao), got2b.de, syoss.de, schwarzkopf.de, redken.eu/de-de, lorealprofessionnel.de, goldwell.com/de-de, sebastianprofessional.com/de-DE, londaprofessional.com/de, de.moroccanoil.com (products.json), garnier.de (sitemap only).
- Scratch files (raw pages, images) are in the session scratchpad only.

## Why so few (market finding)
In the dm range every product that leads with a smooth/sleek result is already in cohort.json (Balea Glattspray, Garnier Diamond Sleek, JF 3-Tage-Glatt, Elnett 3 Tage Glatt, Syoss Glaze, Taft x Gliss Silky Shine, NEQI, Eimi Smooth x3, Moroccanoil Smoothing Lotion, Bali Sleek Stick, Balea Styling Stick, OSiS Flatliner). New dm ones were only Schmusekatze and Glow Wax. The brand sites of Goldwell (StyleSign Smooth = shine spray/oil/BB cream; Heat Styling = protectants, product data only in the Kao Pro Store), Sebastian (Dark Oil = oils/serum/mist), Londa (Sleek Smoother = care treatment), Redken (Iron Shape 11 = light heat protectant spray, claims "Reduziert Frizz"; Anti-Frizz Haarspray = humidity hairspray; Frizz Dismiss = care/serum), L'Oréal Professionnel tecni.art (Fix Anti-Frizz = fixing spray, no INCI on page) yielded no further style-led smoothers with INCI.

## Seen but NOT captured (lead promise is not a smoothing style result)
- Guhl Föhnlotion Seidenglanz (dm 1447163): "pflegt und glättet das Haar intensiv"; dm Wirkung "leichte Kämmbarkeit, Glanz, Styling"; shine/care-led. Directions "Vor dem Föhnen auf das feuchte Haar sprühen. Nicht ausspülen." Could be captured on request.
- Balea Föhn-Spray Blow Dry (dm 2978075): "Pflege & Schutz beim Föhnen" + Anti-Frizz; care/protection-led.
- John Frieda Frizz Ease Regenschirm Haarspray (dm 3123433): humidity hairspray, "Sehr starker Halt". Frizz Ease Hitzeschirm: heat protectant.
- Syoss Haarspray Glaze 3in1 (dm 3119224, syoss.de): shine + "Halt 3" hairspray with Anti-Frizz secondary.
- Taft Aloe Boost Styling Creme (schwarzkopf.de): care/natural looks, "Haltegrad 4"; no directions text on page.
- Redken Iron Shape 11 / Anti-Frizz Haarspray, KMS Thermashape Quick Blow Dry (drying-speed lead), KMS AllSmooth Smoothing Lotion (leave-in care).
- Bali Curls Sleek Stick (dm 3120064) is already in cohort (same INCI as "Sleek Stick Brows & Edges").

## Not reachable (not bypassed)
Rossmann (bot challenge; Isana OMG Glattspray "anti-frizz, Hitzeschutz bis 220 °C" exists but unreadable), sephora.de (403; Living Proof No Frizz Smooth Styling Cream, Bumble and bumble Straight Blow Dry), ghd.de and aveda.de (403). Living Proof on lookfantastic.de has English-only text and the 59 ml size was sold out, so no German directions: not captured. Kevin Murphy's German pages are on kevinmurphy.com.au (noted as C5 at capture time; SUPERSEDED by R2-H6 — this German storefront counts as C2): Smooth.Again is a leave-in; not captured.

## Doubts
- KMS INCI is copied as printed incl. page hyphenation artifacts ("Tri-heptanoin", "Gly-cerin"); needs a normalisation decision. A sold-out lookfantastic.de listing shows an older KMS Straightening Creme formulation with a different INCI (starts Water, Dimethicone, Propylene Glycol; includes Polysilicone-9, Alcohol Denat.): market may still carry both. Current page = "upcycled pomegranate" version.
- KMS pack text was read from manufacturer render images (C2, not photos; German line clipped at the tube edge), so the pack line is recorded as C2, not C1. Sizes 150 ml / 200 ml are from those renders (consistent with page image file names).
- KMS: no GTIN, no price on any German page reached; retail availability in DE only confirmed through an older lookfantastic.de listing (sold out) and the German brand page.
- got2b.de directions differ slightly from the pack; the pack text is recorded as the verbatim direction (C1), the website variant is in `notes`.
- Glow Wax: dm lists "Auf Ölbasis" while the INCI is water-first; recorded as printed.
- Neither got2b Schmusekatze nor Glow Wax states a hold number; Glow Wax only "flexibler Halt" (pack), KMS 2-in-1 only "extra Halt". No hold level was assigned.
