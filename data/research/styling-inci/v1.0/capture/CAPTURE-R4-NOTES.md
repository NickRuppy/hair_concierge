# Capture round 4 notes (2026-10-12)

Capture only; no classification. Files: `round2-new-r4.json` (32 new records), `recapture-r4.json` (21 entries: P-1, P-2, P-3, P-5, P-7, P-8, RG-17, RG-20, OPEN-5).

## Sources used
- dm detail endpoint (`products.dm.de/.../dan/<DAN>`, JSON) for INCI, Verwendungshinweise, bullets, attributes (incl. "Halt") and pack photos. Pack photos read by eye at upscaled crops. dm *search* GTINs can be stale (Balea Haarpuder showed a different GTIN in search than on its detail page); detail GTIN used for the cohort-duplicate check (no GTIN/DAN overlap with cohort.json).
- Manufacturer pages (C2): johnfrieda.com/de-de, wella.com/professional/de-DE, syoss.de, got2b.de, schwarzkopf.de, schwarzkopf-professional.com/de/de (OSiS, DOM read via browser), redken.eu/de-de (German EMEA site, footer "Redken Germany"), de.moroccanoil.com, bali-care.com/de-de, neqi-hair.com (products.json only).
- C3: easycosmetic.de (Kérastase only), beautybay/lookfantastic only mentioned.
- Not reachable (not bypassed): Rossmann (bot challenge), kerastase.de / flaconi / notino / sephora.de (403), Superdrug/Boots (403).

## Per-subtype counts (captured / pass all three items)
Pass = complete INCI list + verbatim German directions + at least one C1/C2 promise line.
- smoothing_styler 9 / 7 (not passing: osis-flatliner - only a secondary-use "Verwendung" line; neqi-diamond-glass - dm INCI looks truncated at 13 items)
- shine_finish 3 / 3 (target 4: no 4th real finishing/shine spray found; Balea Seidenglanz 5in1 and Gliss Night Glanz are care sprays and were left out)
- texture_spray 7 / 6 (all boundary; no classic "Trockenes Texturspray" with full evidence found: OSiS Texture Craft has only manual text + EAN 4045787999617, no INCI/directions on any German page; not recorded). John Frieda Ansatz-Booster fails on an INCI conflict C2 page vs dm.
- hair_powder 4 / 4
- salt_spray 3 / 3 (Wella Ocean Spritz and Bali Gents Sea Salt Spray contain salt; Balea Overnight Wellenspray is the salt-free wave spray, flagged boundary - it is an overnight curl/wave setter, not a beach spray)
- refresher 4 / 3 (Kérastase Refresh Absolu is C3-only and its retailer text calls it a dry shampoo)
- hairline/edge: 2 / 2 (Balea Haarwachs Styling Stick: "abstehende Härchen"; got2b Kleber 4 Brows & Edges: "Haaransatz"/"Kanten"). Also surface/flyaway cue: John Frieda Zauberformel Seiden-Finish Creme, Syoss Glaze products ("Bändigt abstehende Haare").
- Salt-free cases: Balea Overnight Wellenspray (new). Redken Beach Spray (cohort; "ohne Meersalz") - German pack text NOT found (see RG-20).

## Doubts / traps
- Hold wording captured exactly: Wella "Haltegrad: 2" etc. (no scale max printed); Redken Wax Spray "mittlerer Kontrolle"; dm attributes "Halt: ..." are stored as quoted dm attributes (C2 for Balea, C3 otherwise).
- INCI quirks kept verbatim, flagged in notes: JF/Wella pages lose spaces after commas; Redken uses "•" (converted to commas); Balea Overnight has a junk "INGREDIENTSSASTOJCI..." prefix (stripped); Bali page typo "LIMONE NE" corrected.
- Format values for several records are assumptions (pump vs aerosol) where the page does not say; stated in `notes`.
- P-7 finding: the odd line "Wirkt einem Anti-Frizz-Effekt entgegen" is the literal dm bullet, not a slip; the pack says "Anti-Frizz-Effekt".
- P-5 finding: the two Balea finishing sprays are different units (GTIN 4067796069679 vs 4070765016611); rank-6 INCI defect is a dm missing comma ("Triheptanoin, Camelina Sativa Seed Oil" on pack).
- P-3: no real German directions exist on any reachable source; dm still shows the hairspray text.
- Power Flex (RG-13): dm has no Halt attribute; the jar lid prints a 1-7 circle scale with 5 highlighted.
- Cantu: only English pack photo (US pack with EU RP); barcode read UPC-A 817513015694 at moderate resolution; Amazon listing not re-opened today.
- Taft balm (OPEN-5): "HALT 3" IS on the pack (and in a 5-mark column); schwarzkopf.de prints no number ("Starker ... Halt"); dm attribute says "mittlerer Halt".
- Scratch files (raw pages, pack photos) are in the session scratchpad only.
