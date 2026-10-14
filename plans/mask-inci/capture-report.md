# Mask v1.0 — capture-lane report (Phase 4 prep)

Status: **capture only, nothing frozen.** No hashes, freeze receipts, or cohort.json were created per
instructions — that is the orchestrator's job after verifying this capture. Source, files: 13 primary
JSON files + 3 new reserve JSON files under
`data/research/mask-inci/v1.0/capture/`. Reserve R1 (Isana 3in1 Mandelmilch) is identical to primary
#5 per the proposal's own framing ("already primary #5, dual-purpose") — no separate file was created
for it.

Hard source rule compliance: `inkeedecoder.com` was never used. The one place an `incidecoder.com`
(original, non-redirected domain) page was cited, it was used only as last-resort corroboration
alongside a hautschutzengel/openbeautyfacts source, and is flagged in that product's file (#2, Gliss 7
Sekunden).

## Per-product status table

| # | Product | Status | Source tier used | Contact time found? | Conflicts |
|---|---|---|---|---|---|
| 1 | Hask Haarkur Argan Oil Sachet, 50 ml | captured | hautschutzengel (fallback) | Yes (~10 min, moderate confidence, aggregated) | EAN/identifier unresolved (two dm-internal IDs, no confirmed barcode) |
| 2 | Gliss Kur 7 Sekunden Express-Repair, Ultimate Repair, 200 ml | captured_with_conflict | hautschutzengel (fallback) | Yes (7 sec, high confidence) | EAN conflict: proposal/dm.de use 4015100433456; independent databases use 4015100813319 for an apparently identical product |
| 3 | Bali Curls Total Repair SOS Protein Treatment, 20 ml | captured_with_conflict | brand-direct (bali-care.com) | Yes, but conflicting (DE site: 3 min; EN summary: 10–20 min) | Directions/contact-time cross-locale conflict |
| 4 | Gliss Liquid Silk Glanz 4-in-1 Bonding Haarmaske, 400 ml | captured | hautschutzengel (fallback) | Yes (2–3 min, moderate-high confidence, aggregated) | none |
| 5 | Isana Haarmaske 3in1 Mandelmilch, 250 ml | captured | codecheck | Yes (3–5 min, moderate confidence, aggregated) | none (flag: product possibly discontinued per codecheck) |
| 6 | MONDAY Smooth Anti-Frizz Haarmaske, 250 ml | captured_with_conflict | database fallback (incibeauty via search) | Yes (10 min, moderate confidence, aggregated) | wrong-product source excluded (hautschutzengel page was the shampoo, not the mask); marketing "silicone-free" vs confirmed silicone-heavy INCI |
| 7 | Pantene Pro-V Miracles Molecular Bond Repair Intensive Haarmaske, 300 ml | captured | Müller (direct verbatim fetch) | Yes (2 min, high confidence) | none (distinct 160 ml "Intense Hair Rescue" SKU explicitly kept separate) |
| 8 | Sante Intense Hydration Maske, 150 ml | captured | brand-direct (sante.de) | Yes (1 min, high confidence) | none (resolves proposal §4.5: jar and sachet share identical formula/dwell) |
| 9 | Balea Professional Aqua Hyaluron 3in1, 150 ml | captured | hautschutzengel (fallback) | Yes (3 min, moderate confidence, aggregated) | none |
| 10 | Bali Curls Deep Repair Mask, 200 ml | captured_with_conflict | brand-direct (bali-care.com) | Yes (2–3 min, high confidence) | naming (hautschutzengel: "Deep Hydration Mask" vs brand-direct/dm.de: "Deep Repair Mask"); possible unconfirmed dm.de tier upgrade |
| 11 | L'Oréal Elvital Glycolic Gloss 5-Minuten Haar-Laminierung, 200 ml | captured | retailer-aggregated | Yes (5 min, moderate-high confidence) | none |
| 12 | Guhl Panthenol + Reparatur 2in1 Kur & Spülung, 200 ml | captured | hautschutzengel (fallback) | Yes (dual-mode: ~30 sec as Spülung / 2–3 min as Kur, high confidence) | none |
| 13 | Olaplex No. 3 Hair Perfector (refuse-test) | captured | hautschutzengel | Yes (min. 10 min, up to overnight, high confidence) | none — refuse-test evidence is conclusive |
| R2 | Balea Professional Plex Care 2in1 Haarmaske, 250 ml | captured | hautschutzengel | Not sourced (lighter capture, as instructed) | none |
| R3 | Wahre Schätze 1-Minute Kur, Kokosmilch & Macadamia, 340 ml | **capture_failed** | database fallback (incibeauty, unconfirmed) | Yes (1–3 min, moderate) | Full INCI not obtainable this pass (dm.de JS-blocked, incibeauty 403) — only a partial/truncated list on record |
| R4 | John Frieda Frizz Ease Wunder-Kur (Tiefenwirksame), 250 ml | captured_with_conflict | hautschutzengel | Not sourced (lighter capture) | Two same-brand, similarly-named products with different INCI found; exact SKU for the 250 ml Müller variant not confirmed |

(R1 = Isana 3in1 Mandelmilch = primary #5, no separate file.)

## Summary counts

- **Full, clean captures (status "captured", no conflict flag):** 9 of 13 primaries — #1 (flagged
  moderate-confidence identifier, but still "captured"), #4, #5, #7, #8, #9, #11, #12, #13.
- **Captured with a conflict flag (status "captured_with_conflict"):** 4 of 13 primaries — #2 (EAN
  discrepancy), #3 (contact-time locale conflict), #6 (wrong-source exclusion + marketing/INCI
  mismatch), #10 (naming discrepancy + unconfirmed tier-upgrade signal).
- **Capture failures:** 0 of 13 primaries. All 13 primaries produced a usable identity + INCI +
  directions record, even where flagged.
- **Reserves:** R2 clean ("captured"), R3 **failed** (partial INCI only), R4 conflicted (SKU
  ambiguity).

## Missing / low-confidence contact times (P5-relevant)

None of the 13 primaries came back with an outright "not found" contact time — every primary has at
least one sourced dwell-time figure. However, several are **aggregated from secondary/retailer copy
rather than a single verbatim primary-page fetch**, and should be treated as moderate rather than high
confidence for the P5 sourced-contact-time rule until re-verified:

- **Moderate confidence (aggregated, not single-source verbatim):** #1 Hask sachet (~10 min), #4 Gliss
  Liquid Silk (2–3 min), #5 Isana (3–5 min), #6 MONDAY (10 min), #9 Balea Aqua Hyaluron (3 min), #11
  Elvital Glycolic Gloss (5 min, though this figure is also literally the product's own name), #12 Guhl
  (dual-mode, but consistent across 3 independent copy sources so treated as high confidence).
- **High confidence (direct verbatim fetch):** #7 Pantene (2 min, mueller.de), #8 Sante (1 min,
  sante.de), #10 Bali Curls Deep Repair (2–3 min, bali-care.com), #13 Olaplex (min. 10 min,
  olaplex.de wording, universally replicated).
- **Conflicting, unresolved:** #3 Bali Curls SOS Protein Treatment — DE brand page says 3 minutes, a
  separate EN-market brand summary says 10–20 minutes. This needs an explicit decision before freeze
  (which figure governs, or whether it's genuinely a locale-specific reformulation/direction change).
- **Not sourced (by design, lighter reserve capture):** R2, R4.
- **Genuinely unusable this pass:** R3's directions figure (1–3 min) is moderate confidence, but its
  INCI capture failed outright (see below) — the reserve isn't usable as a substitute until its
  ingredient list is re-fetched.

## Everything needing a human/orchestrator decision before freezing

1. **#2 Gliss 7 Sekunden — EAN conflict.** dm.de/proposal say 4015100433456; multiple independent
   ingredient databases say 4015100813319 for an apparently identical product. Ingredient content is
   not in question (multiple sources agree on the formula); only the barcode is disputed. Needs a
   direct barcode check or a decision to accept one as canonical.
2. **#3 Bali Curls SOS Protein Treatment — contact-time conflict.** DE-market brand page: 3 minutes.
   Separately-found EN-market brand summary: 10–20 minutes. Needs a decision on which governs before
   this archetype's contact-time rule can be applied with confidence.
3. **#6 MONDAY Smooth Anti-Frizz — marketing claim vs INCI.** General MONDAY brand marketing found in
   search results claims "silicone-free" formulas, but this SKU's confirmed INCI contains Dimethicone,
   Dimethiconol, and Amodimethicone. Not confirmed whether this specific SKU's own packaging makes the
   silicone-free claim, but worth flagging as exactly the kind of claim-vs-INCI case the standard's
   discrimination logic should catch.
4. **#10 Bali Curls Deep Repair Mask — possible dm.de tier upgrade.** A dm.de listing URL for this
   exact EAN surfaced in search but could not be confirmed live (JS-blocked). If dm.de availability is
   real, this product's source tier (and possibly Nick's below-tier framing for Bali Curls generally)
   should be revisited.
5. **R3 Wahre Schätze — capture failed.** Only a partial/truncated INCI list is on record. dm.de
   (JS-blocked) and incibeauty.com (HTTP 403) both failed to yield the full list this pass. This
   reserve is **not usable as a substitute** until re-fetched from a working source.
6. **R4 John Frieda Frizz Ease Wunder-Kur — SKU ambiguity.** Two same-brand, similarly-named products
   carry different INCI lists; only one (candidate B) matches the proposal's claimed marker chemistry,
   but neither was confirmed against a pack size or EAN for the specific 250 ml Müller-sold variant.
   Needs a direct Müller.de lookup before this reserve could be activated.
7. **General dm.de access limitation.** dm.de pages were JS-rendered/header-only for every direct fetch
   attempted this pass (Hask, Gliss ×3, Pantene, Elvital, Guhl, Balea Aqua Hyaluron, Wahre Schätze) —
   consistent with the proposal's own §"dm.de product pages are JS-heavy" warning. Rossmann.de was
   Cloudflare-blocked ("Client Challenge") on every direct attempt. All primaries still got a usable
   INCI/directions record via hautschutzengel/codecheck/Müller/brand-direct fallbacks, but several of
   the "moderate confidence" contact-time flags above exist specifically because the higher-tier
   dm.de/Rossmann.de source could not be reached directly. If tooling with real browser rendering
   becomes available before freeze, re-verifying the moderate-confidence entries against dm.de/Rossmann.de
   directly would raise several of them to high confidence.

## Notable positive finding

Olaplex No. 3's directions (applied to unwashed, towel-dry hair BEFORE shampooing, minimum 10 minutes)
provide clean, conclusive evidence for the refuse-test: this is unambiguously a pre-shampoo bondbuilder
protocol, not a post-shampoo rinse-out mask. The maleate-based bond chemistry (Bis-Aminopropyl Diglycol
Dimaleate) is confirmed present in its INCI, which also reinforces — rather than undermines — the
proposal's accepted archetype-4b gap: that exact chemistry does exist in-market, but only in this
non-drugstore, pre-shampoo product category.

---

## Orchestrator verification addendum (2026-09-04, live dm.de via real browser)

The capture lane's dm.de/Rossmann blocks were tooling-level; live rendering resolved every
freeze-blocking item. Full adjudications: `data/research/mask-inci/v1.0/capture/verification-2026-09-04.json`.

- **#2 Gliss 7sec: REFORMULATION found.** Old EAN 4015100433456 = Hydrolyzed-Pearl formula (the
  captured list); current dm product GTIN **4015100813319** = gluconamide-pair + Hydrolyzed-Keratin
  formula, read verbatim from the rendered dm page. Calibrate the current version; never merge.
  Doubles as the reformulation archetype and as a tail-marker/bond-gate stress case (bond pair
  sits after Parfum in a low-water serum architecture).
- **#1 Hask sachet:** GTIN 071164333068 dm-confirmed. **#9 Balea:** GTIN dm-confirmed.
- **#3 + #10 Bali Curls: TIER UPGRADE** — both sold on dm.de with dm-confirmed GTINs
  (4262391991114 / 4262391990001); naming resolved ("Deep Repair"). #3 dwell conflict adjudicated
  by the DE-market rule: 3 minutes governs, EN figure preserved as conflict.
- **#12 Guhl heads-up (consequential):** captured directions show a dual mode (~30 sec Spülung /
  2–3 min Kur). Under the F1 directions test, a stated Kur mode with dwell may make it
  mode-scoped ELIGIBLE — contradicting the charter's exclusion assumption inherited from the
  conditioner era. The G0 test on the frozen directions decides; if it flips, it goes to Nick as
  a charter correction.
- **R3 and R4 stay dormant** (R3: no full INCI anywhere incl. dm; R4: SKU ambiguity).
- `.gitignore` allowlisted `/data/research/mask-inci/**` (mirrors conditioner) so capture and
  frozen artifacts are committed provenance.
