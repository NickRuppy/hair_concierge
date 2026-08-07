---
category: heat_protectant
document_type: evidence
status: reviewed
last_reviewed_at: 2026-08-06
decision_file: docs/personal-plan/categories/heat-protectant/decision.md
---

# Heat Protectant external evidence

## Evidence question

For ordinary cosmetic, leave-on Heat Protection used before airflow shaping or direct-contact heat:

1. does evidence support Heat Protection as a real finished-product capability;
2. does hair thickness or formula “weight” determine protection efficacy or strict product eligibility;
3. which recurring application-protocol differences are visible in current German Drogerie products;
4. which claims remain too weak for deterministic routing?

This file records external evidence only. Current repository behavior and future product policy remain separate in `decision.md`.

## Conclusions

### Finished-product formulation and application matter

**Evidence strength: moderate.** Controlled cosmetic-hair research supports that selected polymer pretreatments can reduce thermal degradation of cortex keratin and surface damage during hot flat ironing. The result supports finished-formulation evidence and applying a product before heat. It does not validate every marketed product, ingredient, or claimed temperature as equivalent.

Implementation evidence boundary: credit Heat Protection only from reviewed finished-product evidence. Do not infer protection from a product name, format, category, or one ingredient.

### Hair thickness is not a validated Heat-protection efficacy selector

**Evidence strength: weak/absent for thickness-based selection.** The reviewed thermal-protection studies did not establish a consumer rule assigning Heat Protectants by fine, normal, or coarse hair diameter. Current Drogerie product pages repeatedly describe standalone sprays as suitable for all hair types.

“Ultralight,” “light formula,” and “does not weigh down” are primarily sensory/finish claims. Fine hair may experience unwanted residue, greasiness, or reduced volume from an individual formula or amount, but the reviewed evidence does not justify treating thickness as a hard protection or eligibility gate.

Evidence boundary: do not route fine hair automatically to sprays or coarse hair automatically to creams. Format alone does not prove formula weight. An explicit user-reported sensory experience may support a preference alternative, not a Heat-protection verdict.

### Product directions collapse into a small application-state model

**Evidence strength: strong for observed label variation, not universal efficacy.** The reviewed German product directions repeatedly use three application states:

- damp/towel-dried hair;
- dry hair;
- either state.

Some labels instruct a second application on dry sections before straightening/curling, while others describe one earlier damp-hair application before drying and later styling. Recurring label modifiers include shaking, spray distance, even distribution, no-rinse behavior, and ensuring hair is dry before direct-contact tools.

Evidence boundary: exact verified product directions should control application timing and reapplication. The category should not invent a universal wet/dry rule, amount, wait time, temperature, or reapplication requirement.

### Mainstream standalone Drogerie products are overwhelmingly sprays

**Evidence strength: high for the scoped V1 market, medium for an absolute market-wide claim.** A targeted review of 22 current German/EU retailer and manufacturer listings classified 11 products as protection-first standalone Heat Protectants. All 11 were sprays or mists, including pump, aerosol, setting, and two-phase delivery.

The reviewed protection-first set included Balea Hitzeschutzspray, Balea Ultralight, ISANA Hitzeschutz Spray, got2b Schutzengel, Syoss Keratin Hitzeschutzspray, Jean&Len Protect & Care, Elvital Defeat the Heat, OGX Bond Protein Repair, Wella EIMI Thermal Image, ghd Bodyguard, and OSiS Flatliner. Several sit near a care/Styling boundary, but none supplied a credible mainstream standalone cream, gel, serum, foam, balm, lotion, milk, or oil counterexample.

Apparent non-spray Heat products resolved to another primary category:

- Garnier Wunderöl and Elvital Öl Magique are Oils/care products;
- Garnier Keratin Sleek & Stay, Balea Brilliant Blond Hair Sealer, and John Frieda Frizz Ease are serum/care or anti-frizz products;
- Taft Locken and Balea Keratin & Volumen are hold/volume mousses;
- Session Label The Miracle is a Styling balm;
- Oil Ultime is a finishing Oil.

Non-spray protection products exist in the wider salon/premium market, including a Heat-protection foam, but this did not establish material German Drogerie presence and does not justify a speculative V1 standalone enum.

Evidence boundary: use `spray` for the scoped V1 standalone market. Treat pump, aerosol, mist, and two-phase as delivery/packaging details rather than distinct fit formats. Leave Oils, serums, creams/Leave-ins, mousses, and balms in their primary home categories and expose Heat Protection as a separate verified capability.

### Supplied Drogerie B4/D4 product audit

**Evidence strength: high for primary-job classification where official pages are explicit; availability remains time-sensitive.** Exact-product review narrowed the supplied B4/D4 orientation cells to the confirmed complete initial seed cohort: six currently available German standalone candidates plus one verified candidate that is temporarily unavailable in Germany.

| Product | External finding | Standalone cohort treatment |
|---|---|---|
| [Balea Hitzeschutzspray Ultralight](https://www.dm.de/p/d/3101587/balea-hitzeschutzspray-ultralight) | Current German protection-first aerosol spray; dry-hair directions | include |
| [Jean&Len Beat the Heat](https://www.jeanlen.de/hitzeschutzspray-beat-the-heat) | Current German protection-first spray; official SKU `2925000002`, EAN `4262401732270`, and damp-or-dry application verified | include |
| [Taft Aloe Boost Hydra Protect](https://www.schwarzkopf.de/marken/haarstyling/taft/aloe-boost/aloe-boost-hydra-protect-hitzeschutz-spray.html) | Current protection-first Heat spray with care benefits | include |
| [got2b Schutzengel](https://www.dm.de/p/d/1267310/got2b-hitzeschutzspray-schutzengel) | Current German protection-first spray; towel-dried directions | include |
| [Taft x Gliss Lovely Long](https://www.schwarzkopf.de/marken/haarstyling/taft/taft-x-gliss/lovely-long-hitzeschutz-spray.html) | Current German protection-first spray; EAN `4015100810400`, retailer availability, and damp-or-dry application verified | include |
| [Elvital Dream Length Defeat the Heat](https://www.dm.de/p/d/1571140/l-oreal-paris-elvital-hitzeschutzspray-dream-length-langes-und-glattes-haar) | Current German protection-first Heat spray with care/Styling benefits | include |
| [Balea Hitzeschutzspray 2-Phasen](https://www.dm.de/p/d/1460813/balea-hitzeschutzspray) | Exact current 200 ml SKU verified as dm article `1460813`, EAN `4070765073546`; the German page says `Momentan nicht lieferbar`, while the identical SKU remains orderable at [dm Austria](https://www.dm.at/p/d/1460813/balea-hitzeschutzspray-2-phasen-rezeptur) | include as `temporarily_unavailable`; keep the German identity URL and expose no substitute purchase link |
| [Bali Curls Curl Defining Spray](https://www.rossmann.de/de/pflege-und-duft-bali-curls-curl-defining-spray/p/4262391990490) | Curl-definition/Styling job is primary; Heat Protection is ancillary | exclude; later Styling scope |
| [NEQI Moisture Mystery Leave-In Cream](https://en.neqi-hair.com/products/moisture-mystery-leave-in-cream) | Explicit Leave-in moisture care with Heat Protection | exclude; retain in Leave-in |
| [Bali Curls Bonding Repair Leave-In](https://www.dm.de/p/d/3120011/bali-curls-leave-in-cream-bonding-repair) | Leave-in repair/styling-base job; generic Heat wording | exclude; retain in Leave-in and do not credit Heat without sufficient finished-product verification |
| [Pantene Moisture Boost Heat & Glow](https://www.dm.de/p/d/3088304/pantene-pro-v-leave-in-moisture-boost-heat-und-glow) | Explicit Leave-in moisture care with Heat activation/protection | exclude; retain in Leave-in |

Product placement in a user-supplied spreadsheet column is orientation evidence, not category authority. Primary routine job and exact finished-product evidence control intake classification.

The current Balea 2-Phasen product is not evidenced as discontinued: the identical article and EAN remain orderable in Austria and other dm markets. A same-day German-shop search found no verified orderable German page for that exact EAN. Germany-facing marketplace pages without the EAN, stale availability, or a different EAN are not acceptable substitutes for the canonical German product or purchase URL.

### Claimed maximum temperature is not a defensible matching axis

**Evidence strength: insufficient for comparative consumer matching.** Product pages commonly make maximum-temperature claims, but the reviewed public evidence does not establish a consistent cross-brand test standard that would support ranking one finished product against another by the number alone.

Evidence boundary: retain a claim in source notes when useful for traceability, but do not use it as a V1 fit or ranking axis.

## Source record

| Source | Type | Supports | Limitations |
|---|---|---|---|
| [The effect of various cosmetic pretreatments on protecting hair from thermal damage by hot flat ironing](https://pubmed.ncbi.nlm.nih.gov/21635854/) | Controlled cosmetic-hair study | Selected polymer pretreatments reduced cortex keratin degradation and surface damage | Formulation-specific and industry-affiliated; does not validate all marketed products or thickness routing |
| [Particle deposition on healthy and damaged hair](https://pubmed.ncbi.nlm.nih.gov/39134775/) | Experimental hair-surface/deposition study | Deposition depends on formulation/particle properties and hair-surface condition | Does not establish a consumer Heat Protectant selector by hair diameter or format |
| [ISANA Hitzeschutz Spray](https://www.rossmann.de/de/pflege-und-duft-isana-hitzeschutz-spray/p/4305615612300) | Official German retailer product page | All hair types; damp/towel-dried before blow-drying; reapply to dry sections before straightener/curling iron | Manufacturer/retailer claim; not independent comparative efficacy evidence |
| [Balea Hitzeschutzspray Ultralight](https://www.dm.de/p/d/3101587/balea-hitzeschutzspray-ultralight) | Official German retailer product page | All hair types; dry-hair application; “ultralight” is presented as a finish/formula claim | Manufacturer/retailer claim; does not prove all sprays are lightweight |
| [Jean&Len Protect & Care](https://www.dm.de/p/d/3095719/jean-und-len-hitzeschutzspray-protect-und-care) | Official German retailer product page | All hair types; application to towel-dried or dry hair | Manufacturer/retailer claim; not an efficacy comparison |
| [Taft Aloe Boost Hitzeschutz-Spray](https://www.rossmann.de/de/pflege-und-duft-taft-hitzeschutz-spray-aloe-boost/p/4015100893403) | Official German retailer product page | All hair types; primary towel-dried application; dry-hair use also described | Dry-hair instruction is framed partly as shine/care, so exact Heat role must follow reviewed directions |
| [got2b Schutzengel](https://www.dm.de/hitzeschutzspray-schutzengel-p4015100800128.html) | Official German retailer product page | Towel-dried application followed by blow-drying; warning against direct heat on wet hair | Manufacturer/retailer claim; does not resolve whether reapplication is required |
| [dm Hitzeschutzspray & Co.](https://www.dm.de/haare/haarstyling/hitzeschutzspray-und-co) | German retailer category | Current mainstream assortment and protection-first naming orientation | Category mixes protection-first and care/Styling hybrids; every SKU still requires primary-job review |
| [Rossmann Hitzeschutzspray & Haarstylingprodukte](https://www.rossmann.de/de/pflege-und-duft/haarstyling/hitzeschutzspray-und-haarstylingprodukte/c/olcat3_6095733) | German retailer category | Dedicated use case is principally presented as Heat-protection sprays | Retail category also contains broader Styling products |
| [Syoss Keratin Hitzeschutzspray](https://www.dm.de/p/d/3047023/syoss-hitzeschutzspray-keratin) | Official German retailer product page | Protection-first spray example | Product claims are not independent comparative efficacy evidence |
| [OGX Bond Protein Repair Hitzeschutzspray](https://www.dm.de/p/d/3096745/ogx-hitzeschutzspray-bond-protein-repair) | Official German retailer product page | Spray-format repair/protection boundary example | Primary-job classification still requires review during intake |
| [Garnier Keratin Sleek & Stay Serum](https://www.dm.de/p/d/3042323/garnier-fructis-haarserum-keratin-sleek-und-stay-anti-frizz) | Official German retailer product page | Non-spray Heat claim attached to an anti-frizz serum | Supports home-category exclusion, not standalone format expansion |
| [Taft Locken Schaumfestiger](https://www.rossmann.de/de/pflege-und-duft-taft-locken-schaumfestiger-haltegrad-3-anti-frizz-vegan-silikonfrei-hitzeschutz-150-ml/p/4015100810004) | Official German retailer product page | Heat claim attached to a hold/definition mousse | Styling-primary and outside V1 standalone Heat scope |
| [Session Label The Miracle](https://www.schwarzkopf-professional.com/de/de/styling/session-label/the-miracle.html) | Official manufacturer page | Heat claim attached to a definition/control balm | Salon/Styling-primary; outside scoped Drogerie standalone market |

## Excluded or weak evidence

- Commerce/editorial “best for fine hair” lists were not used as deterministic evidence. They commonly repeat lightweight-format heuristics without controlled comparative support.
- User reviews and social posts may reveal sensory preferences but cannot verify Heat Protection efficacy.
- Ingredient lists alone cannot verify a finished product's protection.
- Product temperature numbers were not treated as comparable efficacy grades.
- High-end products in the user-supplied orientation sheet were deliberately outside the requested Drogerie-focused review.
- The format audit was a targeted current-market sample, not a complete German SKU census. Assortments may change, so a newly submitted non-spray product should be primary-job reviewed rather than rejected from its name alone.

## Evidence versus policy boundary

External evidence supports a conservative binary capability gate, exact-product application instructions, and rejection of thickness/format inference. The exact Hair Tools tier rules, event cadence, carrier hierarchy, comparison UX, lifecycle, and Stage 3 compilation behavior are Nick-confirmed product policy recorded only in `decision.md`.
