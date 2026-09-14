# Leave-In Gold Set — Formula Freeze Report

Frozen 2026-09-03. Identity + formula capture only — **no product has been classified, scored, or fitted to a user in this pass.** This report closes (or documents as still-open) the verification gaps named in `gold-set-candidates.md`'s "Verification gaps before formula freeze" section, and records everything discovered while doing so.

Outputs of this pass:
- `calibration-packet.json` — 13 frozen entries (12 archetype slots + Neqi as the identity-trap secondary), full research trace, hashes, sources.
- `blind-packet.json` — the same 13 entries stripped to what a blind reviewer may see, ordered alphabetically by brand.
- This report.

`gold-set-candidates.md` was **not modified** (out of scope for this task).

---

## 1. Normalization and fingerprint method (per standard §2.4 / §16 / G7)

The standard requires "raw INCI plus a normalized formula fingerprint" and an "unsalted SHA-256" per canonical payload, but does not itself spell out the token-normalization algorithm. The following rule was adopted for this freeze and is recorded here so it is auditable and reproducible (implemented in a small Node script, not by hand):

1. Split `raw_inci` on commas (the INCI declaration's native delimiter).
2. Trim whitespace from each token.
3. Strip every `*` and `†` character anywhere in the token (these are organic/bio and essential-oil footnote markers in the source declarations, e.g. `Glycine Soja Oil*` or the mid-token `Alcohol* denat.` — they are typographic annotations, not part of the INCI name, and must not make two otherwise-identical formulas fingerprint differently).
4. Uppercase.
5. Re-join with `", "`.

- `rawInciSha256` = SHA-256 (hex, unsalted) of the **exact** `raw_inci` string as captured — original case, original footnote markers, untouched.
- `formulaFingerprintSha256` = SHA-256 (hex, unsalted) of the normalized string from step 5.
- `normalized_ingredients` = the array of uppercased, footnote-stripped tokens from step 4.

Note: for entries whose source already declared the INCI in uppercase, comma-space-separated form with no footnote markers (e.g. Curlsmith, slot 6), the normalized string is character-identical to the raw string, so `rawInciSha256` and `formulaFingerprintSha256` coincide. This is expected, not a defect — normalization is idempotent on an already-normalized source string.

---

## 2. Per-product freeze notes

### Slot 1 — alverde Leave-In Sprühkur Express 7in1
Not in the named gap list. Carried forward unchanged from `gold-set-candidates.md` (T1 dm.de). `identity_status: verified`.

### Slot 2 — Balea PROFESSIONAL Magical Water Aqua Hyaluron
Not in the named gap list. Carried forward unchanged (T1 dm.de). `identity_status: verified`.

### Slot 3 — Cantu Leave-In Haarkur Repair Creme
Not in the named gap list. Carried forward unchanged (T1 dm.de, DE-pack Version A authoritative). The doc's prose "provisional_conflict" was mapped to the standard's formal enum value `provisional_formula_conflict`, since the EU/US split is a genuine, already-documented formula conflict (different GTIN 810006943405 for the US formula), not a new finding.

### Slot 4 — alverde Nutri-Care 2-Phasen-Sprühkur Bio-Mandel, Bio-Argan
**Gap targeted: re-verify T3-only INCI.**

- INCI content is now corroborated by **three independent T3 aggregators** (INCI Beauty EN, INCI Beauty DE, codecheck.info) — all three return the exact same 16-ingredient list. This is stronger than the original single-T3 capture, but it is still not a T1/T2 (manufacturer or exact-pack retailer) source.
- The GTIN (4066447105032) was confirmed via the dm.de product-URL slug, itself surfaced independently by search indexing and cited by third-party review blogs — but a direct fetch of that exact dm.de URL returned **HTTP 404** in this pass (via a read-friendly proxy, since dm.de continues to bot-block direct WebFetch), and dm.de's own live on-site search for "alverde Nutri-Care 2-Phasen-Sprühkur" **no longer surfaces this SKU at all** — it returns "Haarserum Nutri-Care", "Shampoo Nutri Care", and "Conditioner Nutri Care" instead.
- **This is a new finding from this pass, not present in the source doc:** the product may have been discontinued or delisted at dm.de since the original capture (2026-09-03, same day, so more likely this reflects a stale/incorrect URL-to-SKU pairing than same-day delisting — but it cannot be resolved from here). The formula itself is not in doubt (3/3 independent aggregators agree); current-market availability under this exact GTIN is.
- **Source that won:** the INCI Beauty EN/DE + codecheck.info triangulated text, chosen because all three independently agree; presented as the `raw_inci`, unchanged from the original capture.
- **Status:** `provisional_identity_conflict`. Routed to human review per standard §14 ("absent exact-market formula/identifier").
- **Gap remaining:** a genuine T1/T2 fetch of dm.de, or a physical-pack check, to confirm the SKU is still live and matches.

### Slot 5 — EVO Head Mistress Cuticle Sealer
**Gap targeted: GTIN second source.**

- Closed. GTIN 9349769013144 is now independently confirmed by **haarspullen.nl**, a Dutch/EU specialty retailer, which shows the barcode explicitly and an ingredient list matching the manufacturer's declared order exactly. An Amazon.de listing further confirms German-market availability (ASIN↔EAN mapping not independently traced).
- **A false lead was caught and discarded, not merged:** a differently-formed evohair.com URL (no region prefix) returned, via automated extraction, a completely different ingredient list — an LGN-emulsion architecture (Cetearyl Alcohol / Behentrimonium Chloride / Amodimethicone) with no silicone-dominance at all. This directly contradicts three independent, mutually-agreeing sources (the original T1 evohair.com/us capture, skinsafeproducts.com T3, and haarspullen.nl T2) and is judged a scraping/page-mismatch artifact (most likely a cross-sell block on that page misread as the primary product). It is recorded in `known_conflicts` for audit trail but was **not** used or merged into the frozen formula.
- **Source that won:** the original T1 evohair.com/us order, corroborated by haarspullen.nl and skinsafeproducts.com.
- **Status:** `verified`.

### Slot 6 — Curlsmith Hydrate & Plump Leave-In
**Gap targeted: re-verify T3-only INCI.**

- Closed. Re-fetched directly from lockenbox.com, the exact-pack German/EU curl specialty retailer already cited in the original capture (previously T2/T3, partial). The full 40-ingredient list was obtained (the prior capture was truncated at "...and additional ingredients that appear to be cut off"); every previously-captured ingredient matches exactly, in the same order.
- **Source that won:** lockenbox.com, now a complete capture rather than a partial one.
- **Status:** `verified`. GTIN remains not found — this was **not** one of the four GTIN slots named for this pass (5, 9, 10, 12), so it was not separately re-searched; it remains a pre-existing, documented gap.

### Slot 7 — Maria Nila Curlicue Cream
Not in the named gap list. Carried forward unchanged (T1 marianila.com). `identity_status: verified`.

### Slot 8 — Schwarzkopf GLISS Sprüh-Conditioner Express-Repair Ultimate Repair
Not in the named gap list. Carried forward unchanged (T2 dm.de, full DOM capture). `identity_status: verified`.

### Slot 9 — Redken Extreme Anti-Snap Leave-In Treatment
**Gap targeted: GTIN second source.**

- A second source was found — but it **conflicts** rather than confirms. hautschutzengel.de (an independent German ingredient database) shows GTIN **884486210777**, while the L'Oréal-adjacent professional trade site plus several independent EU retailer listings (mathissibiza.com, cosmeticclick.com, dubalcosmetics.com — all showing the code embedded in their own URLs, not scraped from a shared aggregator) consistently show **884486453402**. douglas.de itself, the original capture source, exposes neither.
- Per instruction, both are recorded as `gtin_candidates`; neither was picked as authoritative and neither was merged. The most likely explanation is a packaging/batch-code version change (common for Redken SKUs), but this is not confirmed from here.
- As a side benefit, hautschutzengel.de also independently corroborates the INCI itself (minor list-order variance, and it is missing "Potassium Sorbate" that the original douglas.de-sourced capture has — read as a transcription gap on that aggregator, not a formula conflict, since 23 of 24 ingredients match in a broadly consistent order).
- **Source that won (for the frozen `raw_inci`):** the original douglas.de-sourced capture, now cross-corroborated rather than replaced.
- **Status:** `provisional_identity_conflict` (GTIN specifically).
- **Gap remaining:** GTIN conflict unresolved; needs a physical-pack check or a douglas.de-native barcode capture.

### Slot 10 — Olaplex N°.6 Bond Smoother
**Gap targeted: GTIN second source.**

- A second source was found — and it also **conflicts**. Two GTINs, both with the same US company prefix (896364, Olaplex Inc.) and no DE-specific EAN found anywhere: **896364002602** (independently confirmed by barcodespider.com and mathissibiza.com, a Spanish EU retailer) and **896364002619** (labeled "NEW PACKAGING" across multiple independent eBay listings for the same 3.3 oz / 100 ml product). douglas.de, the original capture source, exposes neither; a fresh douglas.de fetch in this pass returned HTTP 403 (bot-blocked).
- Both GTINs recorded as candidates; neither merged or guessed.
- The full formula was also completed in this pass: the original capture (T2 douglas.de) covered only the first 13 ingredients verbatim (candidates.md's own text is truncated with "…"). A T3 capture (incidecoder.com content, via search cache — **direct fetch of incidecoder.com was refused** in this pass because it 301-redirected to a lookalike domain, `inkeedecoder.com`, treated as a suspicious/untrusted redirect target rather than followed) supplied the remaining ~33 ingredients. The first 13 match the original T2 capture exactly (through Cetrimonium Chloride), which is the strongest evidence available that the T3 tail is genuinely the same product's formula rather than a different pack/version.
- Ingredient count: this pass's full list totals 46; `gold-set-candidates.md`'s lane report describes "47 ingredients". Recorded as a minor tail-count variance, not a structural conflict.
- **Source that won:** T2 douglas.de opening segment + T3 incidecoder.com (search-cache) tail, spliced only where they overlap-and-agree (the opening 13), not merged where they don't overlap.
- **Status:** `provisional_identity_conflict` (GTIN specifically).
- **Gap remaining:** GTIN conflict unresolved. A genuine T2 re-fetch of the douglas.de page (or a physical pack) would both resolve the GTIN and upgrade the tail of the ingredient list off T3.

### Slot 11 — Balea Leichtkämmspray Pure Styling
Not in the named gap list. Carried forward unchanged (T2 dm.de, "Ohne Parfüm" badge). `identity_status: verified`.

### Slot 12 — Kevin Murphy Young.Again Oil
**Gap targeted: GTIN second source.** This is the record with the most residual uncertainty in the packet, appropriately, since it is the standard's designated G0 boundary/stress-test product.

- **GTIN conflict (new):** `gold-set-candidates.md` cites a single-source GTIN, 9339341020356. This pass found a different, multiply-corroborated GTIN, 9339341001744 (upcitemdb.com, idealo.co.uk, and several other retailer listings all agreeing). Both recorded as candidates; neither merged or guessed.
- **Formula (pre-existing EU/US conflict, now touched by a new-source complication):** `gold-set-candidates.md` states its 3 sources (T3 + 2× T2 German retailers) show German retailer lists **without** HICC, while an "international" listing carries HICC. The verbatim text behind that claim lives in a separate lane-report file not available to this pass — only the summary was available. A fresh T3 capture this pass (incidecoder.com content, via search cache; direct fetch again refused for the same lookalike-domain redirect as slot 10) **does** contain HICC (`Hydroxyisohexyl 3-Cyclohexene Carboxaldehyde`), i.e. it is the international/US-market listing, not the DE-safe one. **This pass could not independently reproduce a clean DE-market verbatim string** — general web search kept surfacing the same international aggregator content. The `raw_inci` frozen here is explicitly labeled as the international/US capture, not claimed as DE-safe.
- **A token-level discrepancy surfaced and was left open rather than silently resolved:** two independent search extractions of the same underlying source disagreed on one ingredient's spelling — "Vinyl Butyl Ether" vs. "Vanillyl Butyl Ether". "Vanillyl Butyl Ether" was selected as the far more chemically plausible cosmetic ingredient (a known cooling/fragrance agent used in this kind of formula) but this was not confirmed against a primary page, so it is flagged rather than presented as settled.
- **Position variance:** this capture places Water/Aqua at position 23; the original lane-report summary says "~pos. 15". Both readings agree on the qualitative point the slot exists to test — a silicone-leading, anhydrous-serum-like architecture despite leave-in usage — so the position variance doesn't change the G0 boundary reading, but it means this pass's capture is not a clean re-confirmation of the exact prior source.
- **Status:** `provisional_formula_conflict` (the most severe applicable state, reflecting the stack of unresolved issues above). Routed to human review per standard §14.
- **Gap remaining:** GTIN unresolved; DE-market HICC-free verbatim string not independently reproduced; one ingredient's spelling unresolved.

### Slot 13 — Neqi Diamond Glass Ultimate Styling Spray (identity-trap secondary)
Not one of the four originally-named gap products, but freshly captured in this pass since it wasn't previously verbatim-captured either.

- T1 manufacturer INCI (neqi-hair.com) obtained directly, including the previously-uncaptured "VP/Methacrylamide/Vinyl Imidazole Copolymer" ingredient (an earlier general-web-search snippet omitted it — treated as a truncation artifact of that snippet, not a conflict, since the manufacturer page is authoritative).
- GTIN 4063528094575 independently confirmed via three separate DE retailer URLs (dm.de, rossmann.de, galeria.de) — rossmann.de and galeria.de could not be fully page-fetched in this pass (JS-loader-only content / 403 respectively) but their URL slugs each independently pair the same GTIN with the same product name, which is itself useful corroboration.
- **The identity trap is confirmed, not merely carried forward:** dm.de's own listing names this product "Leave-In Spray Diamond Glass Ultimate", while the manufacturer and Galeria both call it "Diamond Glass Ultimate Styling Spray" — same GTIN, different name per retailer. This is exactly the name-based-misclassification trap `gold-set-candidates.md` flagged it for.
- The sibling near-duplicate-GTIN SKU (4063528078469, "one ingredient away" per the source doc) was **not** independently re-fetched or verified in this pass — it is carried forward as a flagged trap only, out of scope for the two named gap categories.
- **Status:** `verified_with_minor_source_difference` (T1 confirms; an earlier snippet-based read was a truncation, not a real second reading).

---

## 3. Final gap list (going into calibration)

| Slot | Gap |
|---|---|
| 4 | dm.de direct fetch still blocked; live dm.de site search no longer surfaces this SKU under its recorded GTIN — possible delisting, unconfirmed. Needs a physical-pack or successful T1/T2 fetch. |
| 6 | GTIN still not found (pre-existing; not targeted this pass). |
| 7 | GTIN still not found (pre-existing; not targeted this pass). |
| 9 | GTIN conflict (884486453402 vs 884486210777) unresolved. |
| 10 | GTIN conflict (896364002602 vs 896364002619) unresolved; ingredient positions 14-46 sourced from T3 only (douglas.de re-fetch blocked). |
| 12 | GTIN conflict (9339341020356 vs 9339341001744) unresolved; DE-market HICC-free verbatim INCI not independently reproduced this pass; one ingredient's spelling (Vanillyl vs Vinyl Butyl Ether) unresolved. |
| 13 | Sibling near-duplicate-GTIN SKU (4063528078469) not independently verified. |

No product's INCI was merged across sizes, markets, or versions. Every conflict found is recorded as a conflict (both values kept), never resolved by preference.

## 4. Sourcing caveats worth restating

- dm.de continues to bot-block automated fetches; every dm.de-attributed capture in this packet, old or new, is a DOM/snippet/URL-slug read, not a clean page fetch.
- Two direct fetches of incidecoder.com (slots 10 and 12) were declined after the server 301-redirected to a lookalike domain (`inkeedecoder.com`) rather than the real site — treated as an untrusted redirect and not followed. The content used instead came from a search-engine cache of the genuine incidecoder.com page, which is a weaker (T3, unauthenticated) form of the same source.
- rossmann.de and galeria.de could not be fetched as rendered pages in this pass (JS-loader-only content, and HTTP 403 respectively) — used only for URL-slug corroboration of Neqi's GTIN/name pairing. **Update, 2026-09-04:** rossmann.de was successfully read as a rendered page in the slot-2 swap pass below, via a rendered-browser fetch rather than a plain WebFetch (which still returns only a bot-challenge shell) — see §5.

---

## 5. 2026-09-04 — Slot-2 swap and R11 directions-of-use pass

Adjudication decision, applied to `calibration-packet.json` and `blind-packet.json`. Driven by two inputs: (1) the reference-key lane's G0 finding that the slot-2 occupant frozen above is a rinse-out product, and (2) standard v0.2 §2.4 ruling R11, a new rule requiring verbatim directions-of-use with source and claim-authority tier for every gold-set product, verified against the rinse test.

### 5.1 Slot-2 swap: Balea PROFESSIONAL Magical Water Aqua Hyaluron → ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol

**Evidence for removal.** `reference-key/02-balea-professional-magical-water-aqua-hyaluron.md` captured this product's dm.de directions verbatim (dm-Art. 3050151, GTIN 4067796166644 confirmed on page): *„Nach der Haarwäsche sanft in die nassen Haarlängen auftragen und kurz einmassieren, bis die Formulierung vollständig aufgenommen ist. **Nach 9 Sekunden gründlich ausspülen.** Bei sehr trockenem oder pflegebedürftigem Haar kann zusätzlich eine Spülung oder eine Haarkur verwendet werden."* This is a rinse-out express conditioner — the reference-key lane's G0 verdict was `excluded_other_form` → `routed_out_of_scope`, on grounds that §2.3's `in_category` test ("directions say the product stays on the hair") fails explicitly and unambiguously, and §2.2 excludes rinse-out conditioners outright. The product's own "9-Sekunden Magical Water" positioning (noted as a tension in the original freeze pass, §2 slot 2 above) is resolved by this reading: the name is marketing, not an exposure regime, and G0 forbids classification by name. This slot's frozen record is retained nowhere in the calibration/blind packets going forward; it is superseded in place by the replacement below. (The reference-key file itself is unmodified — it remains the audit trail for this decision.)

**Replacement.** ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol, 100 ml, GTIN 4305615946733, rossmann.de Artikelnummer 124771. Genuinely researched this pass (not carried from any prior lane report):

- **INCI** — confirmed via rossmann.de's own embedded product JSON (`GRP_INHALTSSTOFFE` block, extracted after the client-rendered accordion loaded — a plain `WebFetch` of the URL returns only a "Client Challenge" bot-block shell): `Aqua, Cetearyl Alcohol, Glycerin, Dicaprylyl Ether, Guar Hydroxypropyltrimonium Chloride, Betaine, Cetrimonium Chloride, Distearoylethyl Hydroxyethylmonium Methosulfate, Sodium Benzoate, Parfum, Panthenol, Sodium Hyaluronate, Lactic Acid, Potassium Sorbate, Hexyl Cinnamal, Citric Acid, Alpha-Isomethyl Ionone, Geraniol, Citronellol, Tocopherol, Phenoxyethanol` — this matches the string supplied in the adjudication brief exactly, and independently matches a second, independent source, codecheck.info (T3 aggregator), character-for-character.
- **Directions of use (verbatim, from the same rossmann.de product JSON, `GRP_ANWENDUNGGEBRAUCH` block):** *„Den Conditioner auf die handtuchtrockenen Längen und Spitzen verteilen und einmassieren. Anschließend die Haare wie gewohnt stylen."* No rinse instruction anywhere in this text or in the separate storage block (*„Vor direkter Sonneneinstrahlung schützen. Trocken lagern."*). **Rinse test: PASS.** This is the genuine-leave-in read that the excluded predecessor failed.
- **Claim-authority tier (R11).** rossmann.de is nominally a C3 "exact-GTIN German retailer" per the R11 hierarchy (C1 current German pack / C2 manufacturer German/EU page / C3 exact-GTIN German retailer / C4 other retailer, corroborate only). ISANA PROFESSIONAL is Rossmann's own house brand — a web search this pass confirmed no independent ISANA manufacturer website exists, and Rossmann does not publicly disclose its ISANA contract manufacturer. On that basis, this lane treats the rossmann.de product page as carrying **C2-equivalent** claim authority for this specific product (it is the brand owner's own first-party product data, not third-party retail copy) — flagged in the entry's `directions_source.claim_tier_basis` field as a judgment call for adjudicator confirmation, not asserted as a clean C2.
- **Identity note.** rossmann.de's own body-copy description block names the product "...Hyaluron & Care", while the same page's title/name field and every third-party listing found (codecheck.info, and via search: hautschutzengel.de, incibeauty.com, discounto.de, drogeria.nl) say "...Hyaluron & Panthenol". Same GTIN (4305615946733) and Artikelnummer (124771) throughout — an internal retailer copy inconsistency, not a product-identity conflict. Recorded in `known_conflicts`; `identity_status` set to `verified_with_minor_source_difference` (the same enum used for the Neqi naming trap in the original freeze, §2 slot 13 above). "Hyaluron & Panthenol" (the page's title/name field, matching the adjudication brief) is used as `exact_product_name`.
- **Hashes.** Computed with a Node script re-using the exact normalization method documented in §1 above (verified this pass by reproducing slot 1's already-frozen hashes bit-for-bit before trusting the script on the new entry): `rawInciSha256 = c7071e3c34ca86157dd263fb88c5c0ff52c34f6565562f617070081d44e927fa`, `formulaFingerprintSha256 = ae0cdabd5102dbe40748f9098b6ccb1de70ee4097329bcc064cda0b569bcf3a8`.
- **Gap remaining.** Only one first-party source (rossmann.de) plus one independent T3 aggregator (codecheck.info, INCI-only match) were fetched this pass. No independent manufacturer-distinct source exists or can exist (Rossmann house brand). Several other aggregators corroborating the same GTIN/name variant were seen in search results but not independently fetched.

### 5.2 R11 directions-of-use pass across the remaining 12 entries

Per R11, every product's `directions_of_use` must be verbatim with source and claim-authority tier. `reference-key/0*.md` and `reference-key/1*.md` — a same-day (2026-09-03) engine run for the classification lane — had already captured verbatim directions text with T1-T3 sourcing for every one of the 12 remaining slots, so a `directions_status: "missing - capture required"` outcome was not needed anywhere in this pass; every entry now carries `directions_of_use` (verbatim), `directions_status: "captured"`, and a `directions_source` object (`claim_tier`, `claim_tier_basis`, `domain`, `url`, `date`, and a rinse-test note).

- **4 slots already had a `directions_of_use` string** (4, 6, 11, 13). Two of these (6 Curlsmith, 13 Neqi) were already full verbatim and left as-is; two (4 alverde Nutri-Care, 11 Balea Leichtkämmspray) had only captured a partial/paraphrased fragment (e.g. slot 4 previously read just "Vor Gebrauch gut schütteln.") — both were **expanded to the full verbatim text** available in the reference-key, since R11 specifically requires verbatim capture. Neither product's `raw_inci`, `normalized_ingredients`, or either SHA-256 hash was touched; this was re-verified by recomputing all 13 entries' hashes from their `raw_inci` strings and confirming a match against the stored `rawInciSha256`/`formulaFingerprintSha256` values (all 13 passed).
- **8 slots were `directions_of_use: null`** (1, 3, 5, 7, 8, 9, 10, 12) and were populated from the reference-key's verbatim citations:
  - Slot 1 (alverde Sprühkur Express 7in1) — C3, dm.de.
  - Slot 3 (Cantu) — C3, dm.de.
  - Slot 5 (EVO) — **C2-equivalent (judgment)**: T1 manufacturer page, but `evohair.com/us` is a US-region storefront, not confirmed DE/EU-specific; no German-language directions text exists for this product.
  - Slot 7 (Maria Nila) — **C2-equivalent (judgment)**: T1 manufacturer page (marianila.com), region not confirmed DE/EU-specific; per the reference-key, a German-language capture was attempted (flaconi.de) but its directions accordion did not render.
  - Slot 8 (Schwarzkopf GLISS) — C2, schwarzkopf.de (a genuine German manufacturer domain).
  - Slot 9 (Redken) — C3, douglas.de (exact-product German retailer; the slot's underlying GTIN conflict, unrelated to directions, remains open per §2 slot 9 above).
  - Slot 10 (Olaplex) — **C2-equivalent (judgment)**: T1 manufacturer page (olaplex.com), region not confirmed DE/EU-specific; also carries a manufacturer FAQ quote explicitly calling the product "an out-of-shower leave-in treatment."
  - Slot 12 (Kevin Murphy) — **C2-equivalent (judgment)**: T1 manufacturer page (kevinmurphy.com.au), Australian-region, not DE/EU-specific. Directions capture does not touch or resolve this slot's pre-existing G0 boundary tension (leave-on exposure regime per directions vs. silicone-leading/anhydrous-serum-like architecture per formula) — no classification is made here; that tension is unchanged from §2 slot 12 above.

  For each "C2-equivalent (judgment)" case, the manufacturer page is not confirmed DE/EU-region-specific, so it does not cleanly satisfy R11's literal C2 definition ("manufacturer German/EU page"); rather than discard these as `missing - capture required`, this lane captured the text and explicitly flagged the reduced-authority read in `directions_source.claim_tier_basis`, on the reasoning that a same-brand manufacturer source (already the frozen INCI's own source, in every one of these cases) is materially better evidence than treating a known, sourced fact as absent. This judgment call is recorded per-entry for adjudicator review, not silently normalized to a clean tier.

### 5.3 Directions-of-use coverage summary (post-pass)

| Slot | Brand / Product | `directions_status` | Claim tier |
|---|---|---|---|
| 1 | alverde Leave-In Sprühkur Express 7in1 | captured | C3 |
| 2 | ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | captured | C2-equivalent (judgment) |
| 3 | Cantu Leave-In Haarkur Repair Creme | captured | C3 |
| 4 | alverde Nutri-Care 2-Phasen-Sprühkur | captured | C3 (archived) |
| 5 | EVO Head Mistress Cuticle Sealer | captured | C2-equivalent (judgment) |
| 6 | Curlsmith Hydrate & Plump Leave-In | captured | C3-equivalent (judgment) |
| 7 | Maria Nila Curlicue Cream | captured | C2-equivalent (judgment) |
| 8 | Schwarzkopf GLISS Sprüh-Conditioner Express-Repair | captured | C2 |
| 9 | Redken Extreme Anti-Snap Leave-In Treatment | captured | C3 |
| 10 | Olaplex N°.6 Bond Smoother | captured | C2-equivalent (judgment) |
| 11 | Balea Leichtkämmspray Pure Styling | captured | C3 |
| 12 | Kevin Murphy Young.Again Oil | captured | C2-equivalent (judgment) |
| 13 | Neqi Diamond Glass Ultimate Styling Spray | captured | C2 |

**Remaining directions gaps: none.** All 13 entries now carry verbatim directions-of-use, a source, and a claim-authority tier. Six entries (5, 6, 7, 10, 12, and the new slot 2 partially) carry a "judgment"-flagged tier because the underlying source is a manufacturer or exact-pack retailer page that does not cleanly satisfy R11's literal C1-C3 wording (non-DE/EU manufacturer domain, or no established GTIN) — these are flagged for adjudicator confirmation, not silently treated as full-strength C1-C3 sources. All thirteen entries passed the rinse test (no rinse instruction found in any captured directions text).

### 5.4 Integrity check

All edits in this pass were additive (new fields) or confined to `directions_of_use` text and the full slot-2 entry replacement. No other product's `raw_inci`, `normalized_ingredients`, `rawInciSha256`, or `formulaFingerprintSha256` was altered — verified by recomputing all 13 entries' hashes from their `raw_inci` strings against the method in §1 and confirming an exact match to the stored values, and separately by confirming `blind-packet.json`'s `raw_inci`/`normalized_ingredients`/`directions_of_use` values are identical to `calibration-packet.json`'s for every slot. `blind-packet.json`'s alphabetical-by-brand ordering was preserved: the new ISANA PROFESSIONAL entry was placed between EVO and Kevin Murphy, not left in Balea PROFESSIONAL's old position. Both JSON files validated with `node -e` and `jq empty` after every edit.

---

## 6. 2026-09-04 — Claim-capture pass and fingerprint repair

New rule for this pass: marketing claims are frozen at research time like INCI and directions. Every claim is anchored to a **claim-authority tier**: **C1** current German pack, **C2** manufacturer's German-market product page (a retailer's page for its own private label — dm for alverde/Balea, Rossmann for Isana — counts as C1/C2, since the retailer *is* the brand owner), **C3** exact-GTIN German retailer (corroborate only, never create), **C4** other retailer (corroborate only, never create), **C5** non-German-market manufacturer page (record for the audit trail, but cannot create a claim). Only claims stated at C1/C2 count as established manufacturer positioning; a claim seen only at C3/C4/C5 is recorded, flagged, and explicitly marked as unable to create the claim.

Six claim types were tracked, matching the standard's own dimensions: `heat_protection` (incl. any °C/°F figure), `humidity_frizz`, `repair_bond`, `curl`, `sensitive_fragrance_free`, `finish_weight`. Claim text is verbatim German only — an English-only source (no German text anywhere, at any tier) yields `claims: []` for that product rather than a translated or paraphrased entry; where a German-language claim exists only at C3/C4, it is recorded with `creates_claim: false` and flagged.

### 6.1 Per-product claim summary

| Slot | Product | Claims found at C1/C2 | Heat claim | Best tier reached | Gaps / notes |
|---|---|---|---|---|---|
| 1 | alverde Leave-In Sprühkur Express 7in1 | 1 (finish_weight) | No | C2 (dm.de, house brand) | Live-refetched. No heat/humidity/repair/curl/fragrance-free claim anywhere on the page. |
| 2 | ISANA PROFESSIONAL Leave-In Conditioner Hyaluron & Panthenol | 0 | No | C2 (rossmann.de, house brand) | Live-fetched, full text captured — genuinely no claim in any of the 6 tracked categories. `claims_status: none_found_at_C1_C2`. |
| 3 | Cantu Leave-In Haarkur Repair Creme | 2 (repair_bond) | **Yes, but C3-only** | C2 (cantubeauty.de) | **Named case**: heat-protection claim exists only at dm.de (C3); cantubeauty.de (C2, live-fetched, genuine German manufacturer site newly found this pass) makes NO heat claim at all. Cannot create the heat claim. Also: cantubeauty.de's own INCI for this product matches the packet's already-documented US-formula variant (known_conflicts), not the frozen DE-pack — recorded as an observation only, `raw_inci` untouched. |
| 4 | alverde Nutri-Care 2-Phasen-Sprühkur | 0 | No | C2 (dm.de, archived) | SKU still delisted (re-confirmed live 2026-09-04); Wayback Machine was itself offline during this pass, so the on-file archived C2 capture (reference-key, 2026-09-03) could not be independently re-verified live. No claim in any tracked category regardless. |
| 5 | EVO Head Mistress Cuticle Sealer | 0 | No | C4 (nicebeauty.com) — cannot create | No C1/C2 EVO German-market source exists (no evohair.de/evo.de; evohair.com has no /de region). A German-language C4 retailer page states heat- and frizz-adjacent claims, but per the rule cannot create them. `claims_status: none_found_at_C1_C2`. |
| 6 | Curlsmith Hydrate & Plump Leave-In | 0 | No | C4 (flaconi.de) — generic tag only | eu.curlsmith.com (brand's own EU site) is English, not German. flaconi.de gives only a generic "Wirkung: Volumen" tag, outside the 6 tracked categories. `claims_status: none_found_at_C1_C2`. |
| 7 | Maria Nila Curlicue Cream | 0 | No | C4 (flaconi.de) — cannot create | No C1/C2 German-market Maria Nila source (marianila.com has no /de region). flaconi.de's "Wirkung: Anti-Frizz" tag recorded but flagged cannot-create. |
| 8 | Schwarzkopf GLISS Express-Repair Ultimate Repair | 3 (heat_protection ×1, repair_bond ×2) | **Yes, with figure** | C2 (schwarzkopf.de) | Clean case: "Hitzeschutz bis zu 230 °C" live-confirmed on the genuine German manufacturer page, corroborated by dm.de (C3). |
| 9 | Redken Extreme Anti-Snap Leave-In Treatment | 2 (heat_protection, repair_bond) | **Yes, but no °C figure at C2** | C2 (redken.eu/de-de — new find this pass) | redken.eu/de-de is a genuine German-market Redken page not previously in the reference-key lane. Its heat claim is generic ("Hitzeschutz", no figure); douglas.de (C3) additionally carries "effektiven Hitzeschutz" and an "Anti-Frizz" tag, both corroboration-only. The T1 US "73% less breakage" figure is explicitly a 3-product-system result per the manufacturer's own asterisk and is English (excluded). |
| 10 | Olaplex N°.6 Bond Smoother | 0 | **Yes, but C3-only** | C3 (douglas.de) — cannot create | **The task's named case.** olaplex.de does not exist; olaplex.com is US/global English, and the only "EU" Olaplex storefront found (es.olaplex.com/en/…, Spain-hosted) is still English, not German. "bis zu einer Hitze von 232 °C" exists only in German retail copy (douglas.de, C3). No bond-repair claim was found for N°.6 at any tier or in any language — the FAQ explicitly answers "Will it repair my hair?" with "strengthen, hydrate, and protect"; the bond claim is carried by the product **name** only (E0, out of scope for claim capture). |
| 11 | Balea Leichtkämmspray Pure Styling | 2 (finish_weight, sensitive_fragrance_free) | No (actively checked, absent) | C2 (dm.de, house brand) | Live-refetched; "Ohne Parfüm" badge and "Kein Verkleben oder Beschweren" both re-confirmed live. |
| 12 | Kevin Murphy Young.Again Oil | 2 (heat_protection, finish_weight) | **Yes, but no °C figure at the Austrian source** | C2-equivalent (judgment) — Austria, not Germany | **The task's named case.** kevinmurphy.de was checked and found to **redirect to kevinmurphy.com.au** (the Australian/global site; the specific product URL 404s) — confirmed no genuine German-market page exists. kevinmurphy.at (Austria, German-language, brand-owned) is the closest available source and states a general heat-damage claim with no °C figure — a materially weaker claim than the English kevinmurphy.com.au page's "93°C" figure, which is excluded here as non-German. |
| 13 | Neqi Diamond Glass Ultimate Styling Spray | 3 (heat_protection, humidity_frizz, finish_weight) | **Yes, with figure** | C2 (neqi-hair.com) | Clean case, live-reconfirmed. "Hitzeschutz bis 230°" (unit not marked on page, presumed °C, not asserted). Corroborated by a "Hitzeschutz" badge at dm.de (C3). No hold/"Halt" claim anywhere, confirming the existing negative finding. |

**Headline finding — the heat-protection claim-authority split.** Of the 8 products carrying any heat-protection claim, only 3 (Schwarzkopf GLISS, Neqi, and — with a caveat — Redken) have that claim stated at C1/C2 with the manufacturer's own German-market voice; Kevin Murphy's best German-language source is Austrian, not German; and **two products (Cantu, Olaplex) carry a heat-protection claim that exists only at C3 (dm.de / douglas.de respectively) and is absent from — in Cantu's case, actively checked and confirmed absent from — the brand's own C2 German-market page.** Per the claim-authority rule, neither of those two claims can be treated as an established manufacturer position; both are recorded with `creates_claim: false` and an explicit flag. This is the sharpest, most consequential finding of this pass: two of the gold set's four "boundary"/flagship heat-claim products would silently gain manufacturer-grade heat-claim authority if C3 retailer copy were ever conflated with C1/C2 — which the rule and this record now explicitly prevent.

### 6.2 Fingerprint repairs (normalization defect)

**Defect.** The documented normalization rule (§1) splits `raw_inci` on every comma. Two INCI names in this gold set contain an internal comma that is part of the chemical name itself, not an ingredient delimiter: `1,2-Hexanediol` (slot 11, Balea) and `2-Oleamido-1,3-Octadecanediol` (slot 9, Redken). A literal comma-split therefore broke each of these into two spurious fragments — `"1"` / `"2-HEXANEDIOL"` and `"2-OLEAMIDO-1"` / `"3-OCTADECANEDIOL"` — which is what both `calibration-packet.json` and `blind-packet.json` contained going into this pass.

**Method.** Fixed with a script (not by hand): the two known internal-comma INCI names are protected (temporarily substituted with a placeholder) before the comma-split, then restored intact as single tokens after. Before trusting this on the two affected slots, the script was run against all 13 entries' `raw_inci` strings and its output compared against every currently-stored `formulaFingerprintSha256` and `normalized_ingredients` array: **all 11 unaffected slots reproduced their stored fingerprint and array exactly, confirming the corrected method is a strict repair — it changes nothing for any slot except the two defective ones.** The whole gold set was also re-scanned for any other numeric-fragment artifacts (a bare `"1"`, `"2-…"`-style token, etc.); none were found beyond the two known cases.

**Entries repaired (2 of 13):**

| Slot | Brand | Old `normalized_ingredients` tail | New `normalized_ingredients` tail | Old `formulaFingerprintSha256` | New `formulaFingerprintSha256` | `rawInciSha256` |
|---|---|---|---|---|---|---|
| 9 | Redken | `..., "POTASSIUM SORBATE", "2-OLEAMIDO-1", "3-OCTADECANEDIOL"` | `..., "POTASSIUM SORBATE", "2-OLEAMIDO-1,3-OCTADECANEDIOL"` | `239f65c85fea4997b2df1be0570c42f4b50858e465d6cfb0d4304468e5e50f00` | `ff9c329e18e2b241d246a71a4fd42d7882a03ae4b327574890318d341c8dc628` | unchanged: `2f2fb1d8c62ea11ed91781923a056d3ceac38a210cb2484d0fdd857ec5768dfe` |
| 11 | Balea | `..., "HYDROXYACETOPHENONE", "1", "2-HEXANEDIOL", "CAPRYLYL GLYCOL", ...` | `..., "HYDROXYACETOPHENONE", "1,2-HEXANEDIOL", "CAPRYLYL GLYCOL", ...` | `eb6380538aa46481031c813e124efd0fed156b6c3fc5e5c0f4a372c958c685f8` | `ef2af7781e942a7f0bff9398d89bd2ef8221745d74106516a162b6ab9e9b7328` | unchanged: `9de11a3f4c3972170c2f06aa27e93e9c5c7345b1f3a75342d8388d6c99b43c2e` |

Applied identically to `blind-packet.json`'s `normalized_ingredients` for the same two slots (that file carries no fingerprint fields, so no hash recomputation applies there). `raw_inci` and `rawInciSha256` were **not** touched on either slot, in either file, per the task's explicit constraint. The `fingerprint_method` block in `calibration-packet.json` was amended to document the two-name exception list so the repair is reproducible and auditable going forward.

### 6.3 Claims found only at C3/C4/C5 — could NOT be resolved to C1/C2 (honest gaps)

- **Cantu (slot 3) — heat-protection claim.** "Zudem bietet sie einen Schutz vor Hitzeschäden, die durch das Styling entstehen können." exists only on dm.de (C3). cantubeauty.de (C2, live-fetched this pass — a genuine German manufacturer site not previously known to this research lane) was actively checked and makes **no heat claim of any kind**. Not resolved; recorded with `creates_claim: false`.
- **Olaplex (slot 10) — heat-protection claim.** "bis zu einer Hitze von 232 °C vor Stylingschäden geschützt" exists only in German retail copy (douglas.de, C3). No olaplex.de exists; the only Olaplex "EU" storefront found (es.olaplex.com/en/…) is still English. Not resolved; recorded with `creates_claim: false`. This is the exact case named in the task brief.
- **EVO (slot 5) — heat-protection and humidity/frizz claims.** German text exists only at C4 (nicebeauty.com: "wirkt die Multifunktionscreme auch als UV- und Hitzeschutz"; "Reduziert Frizz"). No evohair.de/evo.de domain exists and evohair.com has no /de region. Not resolved; `claims_status: none_found_at_C1_C2` (the C4 text is recorded in the entry's `claims_search_note`, not as a creatable claim).
- **Maria Nila (slot 7) — humidity/frizz claim.** "Wirkung: Anti-Frizz" exists only at C4 (flaconi.de). No marianila.com /de region found. Not resolved; recorded with `creates_claim: false`.
- **Kevin Murphy (slot 12) — no .de site, as the task anticipated.** `kevinmurphy.de` was checked this pass and found to **redirect to kevinmurphy.com.au** (the product URL 404s there) — confirmed dead, not a genuine German site. The best available German-language source is **kevinmurphy.at** (Austria), tiered C2-equivalent (judgment) rather than a clean C2/DE match; its heat claim carries no °C figure, unlike the English `.com.au` page's "93°C" figure (excluded here as non-German). Recorded honestly at the Austrian tier rather than silently upgraded to DE or silently discarded.
- **Curlsmith (slot 6) — no German claim in any tracked category at any tier.** The brand's own EU site (eu.curlsmith.com) is English throughout; the only German retailer text found (flaconi.de) is a bare "Wirkung: Volumen" tag outside the 6 tracked categories. `claims_status: none_found_at_C1_C2`.

### 6.4 Integrity check

Both JSON files were validated with `python3 -c "json.load(...)"`, `node -e "JSON.parse(...)"`, and `jq empty` after every edit in this pass, and again after the final metadata amendment — all passed. `calibration-packet.json`'s and `blind-packet.json`'s `claims` and `claims_status` fields were diffed programmatically and confirmed byte-identical per slot, consistent with claims being E0 product data (blind-safe, same as `raw_inci`/`directions_of_use`). No field outside `normalized_ingredients`, `formulaFingerprintSha256`, `claims`, `claims_status`, `claims_search_note` (where present), `source_authority_tier`, and the top-level `fingerprint_method`/`amendment_log`/`last_amended_at` metadata was touched in either file this pass — `raw_inci`, `rawInciSha256`, `directions_of_use`, `directions_source.claim_tier`, `identity_status`, `known_conflicts`, `remaining_gap`, and `notes` are all unchanged from the 2026-09-04 R11 pass. `gold-set-candidates.md` was again not modified (out of scope).
