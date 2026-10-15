# Recheck R6 notes (2026-10-12)

Companion to `recheck-r6.json`. Pack text was read by eye from dm pack photos; clipped or unclear parts are marked in the JSON. Tiers follow the brief (C1 pack, C2 German manufacturer / house brand, C3 retailer, C5 non-German).

## 1. Wella EIMI Nutricurls Fresh Up (`wella-eimi-nutricurls-fresh-up`)

- The German manufacturer page exists: `wella.com/professional/de-DE/products/haar-styling/eimi-nutricurls/eimi-fresh-up` (the old `.../hair-styling/eimi-nutricurls/fresh-up` path redirects there). Wella names the product **EIMI Fresh Up** ("Auffrischendes Lockenspray"). "Nutricurls" is only the line.
- All five cohort lines that were stamped C2 from lookfantastic.de are on the Wella page word for word: "Frische deine Locken auf und erhalte Definition, Glanz und Anti-Frizz-Effekt.", "Anti-Frizz-Effekt bis zum 72 Stunden", "Definition und Glanz", "Haltegrad 1", and the directions ending "...um die Locken zu reaktivieren." The hair-type line is "Lockenspray für Locken und Wellen" (cohort had "Locken").
- "Detangling" / "entwirrt" is NOT on the Wella page, the pack front, or the en-NL page. It comes only from the retailer title/description (lookfantastic.de, C3: "entwirrendes Spray").
- "Pflege" wording exists only at line level: "Die Formel mit Weizenkleieextrakt und Jojobaöl pflegt, definiert und macht die Locken weich." (Nourish-In Complex block).
- Pack: only Wella's own packshot of the front was found: "FRESH UP 72H / NUTRICURLS / EIMI / 72h Anti-Frizz Spray", 1 of 4 hold dots. No pack back, so the INCI cannot be taken from a pack.
- **Contradiction:** the INCI printed on the Wella DE page is a wax/pomade list (Ceresin, Petrolatum, Carnauba, Mineral Oil, parabens, Iron Oxides, Mica, Titanium Dioxide) with no jojoba or wheat bran, which contradicts the page's own formula text. Our cohort INCI (lookfantastic.de, 29 items, with jojoba and wheat bran) is also on beautyflash.co.uk. The Wella DE INCI looks like a wrong block on the manufacturer page. The English Wella pages have an empty Ingredients section. The owner should decide which list stands; I would keep the retailer list as C3 and flag the conflict.

## 2. GUHL Locken Pflege & Styling 3in1 (`guhl-locken-pflege-und-styling-3in1`)

- Pack front (what is printed first): headline "LOCKEN PFLEGE & STYLING", tagline "Mit wenig Aufwand zu definierten Locken & Wellen¹", badge "MULTIFUNKTIONALE ANWENDUNG", band **"3in1 | LOCKENCREME, KUR & SPÜLUNG"** (Lockencreme first).
- Pack back directions: "3in1 ANWENDUNG: **1 - Spülung** ... **2 - Kur** ... **3 - Lockencreme** ..." (Spülung first). Heat protection (220 °C) is tied to use 3 only.
- guhl.com (German manufacturer): product name "3in1 Lockencreme, Kur & Spülung" (Lockencreme first, like the front); description "Als Haarspülung ohne Silikone, Haarkur für Locken oder Locken-Styling-Creme ..." (Spülung first, like the back). Also says "Der Halt entsteht dabei durch Pflege, nicht durch Fixierung."
- Shelving: guhl.com lists it under "Spülungen, Kuren & Seren", not under Leave-in Pflege or Styling & Auffrischen. dm: title "Haarkur, Conditioner & Lockencreme Pflege & Styling 3in1", breadcrumb **Haare > Locken Produkte** (neither Conditioner nor Haarstyling).
- INCI on the pack matches the cohort list (24 items; Benzoic Acid, Sodium Benzoate, Potassium Sorbate) and guhl.com, so the INCI can be re-stamped C1/C2.
- Differs from the cohort: the cohort directions are a paraphrase ("3 uses. Spülung: ..."); the verbatim text is in the JSON. The cohort lists use order as Spülung / Kur / Lockencreme; the front says the opposite, so "which use is first" depends on where you look.

## 3. Balea Haarwachs Styling Stick (`balea-haarwachs-styling-stick`)

- Pack front name: **"Styling WAX STICK"**, bullets "einfache Fixierung", "glattes, glänzendes Finish", pill "Ideal für den Sleek-Look". dm name: "Haarwachs Styling Stick, 25 g"; dm text says "Wax Styling Stick von Balea".
- Pack back: "Trendige Styles: schnelle und einfache Fixierung, ohne zu verkleben, auch gegen Babyhaare"; "ANWENDUNG Mit dem Stick sparsam über das trockene Haar streichen, um abstehende Härchen zu fixieren."; "Den Wax Stick unter 25 °C lagern."
- dm breadcrumb: **Haare > Haarstyling > Haarwachs**.
- No hold statement ("Halt"/"Haltegrad") on the pack or on dm. The word is "Fixierung".
- Babyhaare vs styles: dm bullet "Bändigt abstehende Babyhaare"; pack "auch gegen Babyhaare" as a side use under "Trendige Styles"; "Sleek-Look" is the headline use on the pack front and in the dm text.
- **Contradiction:** the pack INCI has 14 items, the cohort (dm text) has 12. On the pack PERSEA GRATISSIMA OIL comes before PARFUM, and DIMETHYL PHENETHYL ACETATE and VANILLIN are at the end. The pack reads "HYRDOGENATED RAPESEED OIL" (spelling as read, unverified). The cohort INCI should be replaced by the pack list.

## 4. NEQI Diamond Glass Styling Spray All (`neqi-diamond-glass-styling-spray-all`)

- The dm INCI is NOT truncated. neqi-hair.com (tab "INHALTSSTOFFE", C2) prints the same 14 items ending in Glycerin; the pack back (read by eye, curved bottle, edges clipped) matches in order and ends with GLYCERIN. The earlier gap came from the Shopify products.json body, which leaves the tabs out; the tab text is in the page HTML. The cohort flag says "13 items": the list has 14.
- No classic preservative is declared. Candidates for preservation help are Pentylene glycol, Hydroxyacetophenone, Ethylhexylglycerin.
- New C2 directions from neqi-hair.com: three numbered steps, "handtuchtrockene (nicht nasse) Haar", sectioned, blow-dry under heat and tension. Cohort directions are the dm text (C3).
- Pack: "STYLING SPRAY / SPRAY COIFFANT / Diamond Glass / for all hair types"; back "Sofort seidige, glatte Textur ... Hitzeschutz bis zu 230°C – für alle Haartypen" (230 °C is only on the pack). Manufacturer product type: "Leave-in Styling Spray mit Hitzeschutz"; dm title "Leave-In Spray Diamond Glass".
- Mis-source: the five hair_type claims ("Personen mit stumpfem, glanzlosem Haar" etc.) are on neqi-hair.com ("Ideal für:"), not on dm (dm says "alle Haartypen").

## 5. Balea PROFESSIONAL Styling Cream Traumlocken (`balea-professional-styling-cream-traumlocken`)

- "Verbesserte Geschmeidigkeit" is the second dm bullet on `products.dm.de` DAN 1536368 (house brand, C2_house_brand). Other dm bullets: "Für definierte lebendige Locken", "Schützt effektiv vor Frizz", "Hitzeschutz bis zu 220 °C". Hold is the dm attribute "mittlerer Halt". Also in the description: "Die Anti-Statik-Formel verhindert Frizz und sorgt für ein geschmeidiges Haargefühl."
- **The pack does not say "Verbesserte Geschmeidigkeit".** Pack back: "Locken-Forming-System für Geschmeidigkeit und verbesserte Kämmbarkeit." (the "verbessert" belongs to Kämmbarkeit). Pack front also carries "BIS ZU 24h DEFINIERTE LOCKEN", which the cohort lacks. The pack has no hold wording.

## 6. Host check (claims with tier C2 but a non-German or retailer host)

I scanned every claim, directions source and INCI source in `r2/cohort.json`. Findings:

| Product | What is stamped C2 | German C1/C2 source? |
|---|---|---|
| wella-eimi-nutricurls-fresh-up | 6 claims, lookfantastic.de (retailer) | Yes: wella.com DE has them; re-source (hair type wording differs). |
| redken-one-united-... | 10 claims + INCI, redken.co.uk (UK English, texts are German translations of the UK 25-benefits list) | Partly: redken.eu/de-de has the INCI, directions, "Leave-in-Pflege für allen Haartypen. Bietet 25 Vorteile in einem Produkt.", "verbesserte Kämmbarkeit", "schützt vor Hitze, Haarbruch und Spliss", "gibt Glanz". Not found in German: Mehrfachwirkung, Umwelteinflüsse, Styling & Haarschnitt, antistatisch, ombré / colour-treated, "seidig", "Haarzustände". |
| kevin-murphy-powder-puff-volume, kevin-murphy-killer-curls | 9 claims + 2 INCI, kevinmurphy.com.au/de/de | Same page. It is the manufacturer's German-language storefront; kevinmurphy.de redirects to it. No German-domain page exists. Host-rule question for the owner, not a wrong source. Claims verified today. |
| neqi-diamond-glass-styling-spray-all | 5 hair_type claims, products.dm.de (retailer) | Yes: neqi-hair.com "Ideal für:". |
| evo-head-mistress-cuticle-sealer | 6 claims + INCI, evohair.com/us (US English) | No. evohair.de is behind a 403 (not bypassed), the cited URL is now 404, no German page found. |
| wella-professionals-eimi-flowing-form | INCI source en-SE | Yes: de-DE page has the identical list; change the URL only. |

Not an issue for this check: `source: "product_name"` rows (hold/flexibility words taken from the product name, 19 claims) and the Cantu claims sourced to an Amazon pack image (C1).

## Open points for the owner

1. Wella DE page INCI conflict (item 1).
2. Balea stick: replace the dm INCI with the 14-item pack list (item 3).
3. GUHL: which of Lockencreme / Spülung counts as "first" (front vs back vs guhl.com shelving under Spülungen, Kuren & Seren; dm shelves it under Locken Produkte).
4. Kevin Murphy: whether the manufacturer's German storefront on .com.au counts as C2.
