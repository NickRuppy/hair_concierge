# Styling category concept, Rev. 2

**Status.** Concept for Nick's review, 2026-10-09. Nothing here is implemented or activated. It supersedes `00-taxonomy-draft.md`.

**Rev. 2** (2026-10-09) folds in Nick's rulings D1–D6 (ledger: `02-rulings.md`, which governs if anything here disagrees) and the D5 evidence (`03-d5-evidence.md`). Round-2 calibration results are added in §7 when the lanes finish.

**Rev. 1** incorporated the Codex whole-concept review, which returned **rework**. It made nine findings, all accepted and fixed:
- the routing-gate order;
- the oil test;
- full G0 reuse;
- two guessed hold levels;
- hold route vs result mechanism;
- claim authority (T7 and the house-brand rule);
- the `shine_finish` definition;
- the `smoothing_styler` justification;
- the matching gaps.

**Evidence.**
- `data/research/styling-inci/concept-v0/samples/*.json`: 72 unique DE products (77 records), each with a full published INCI. 65 INCIs come from a retailer product page and 7 from the manufacturer.
- `data/research/styling-inci/concept-v0/calibration-set.json`: route, subtype, proposed hold and finish per product, built by `build-calibration.js`. This is a **dry run** of the rules below. Most claims were captured from third-party retailer pages (tier C3), so every hold level stays provisional until round 2 freezes C1/C2 claims.

## 0. Owner rulings this concept builds on (Nick, 2026-10-09)

| ID | Ruling |
|---|---|
| SD1 | Scope covers every styling family, including short-hair modelling, plus the overlap product types at the edges of Leave-in, Heat Protectant, Oil and Dry Shampoo. |
| SD2 | One category key `styling` with subtypes. |
| SD3 | Shine and finish products that contain no oil belong to Styling, not Oil. |
| SD4 | Styling is optional by default. A stated matching problem or goal (e.g. too little volume) turns it into an active suggestion. |
| SD5 | Chaarlie defines its own coherent hold scale. |

**Cross-category consequences** (see §8):
- **Oil:** no amendment needed. D2 keeps everything sold as „Öl"/„Serum" in Oil, so Oil's ownership of "immediate dry shine" stays.
- **Leave-in:** gets one exception (D6). Products with no care and no hold that promise a styling look move to Styling. T15 is unchanged (D3).

## 1. What a styling product is

**Definition.** A styling product is a leave-on product whose **primary promise is a visible styling result**:
- shape or hold
- curl/wave definition
- volume
- texture
- sleekness
- shine or finish

It is not a styling product when the primary promise is care (conditioning, repair, moisture), protection (heat), or refresh/cleansing (dry shampoo).

**Why promise first, not formula first.** The samples show that no formula signal alone separates Styling from its neighbours:
- **got2b Hitzeschutzspray Schutzengel** has VP/VA at rank 2 but promises protection. It stays Heat Protectant.
- **L'Oréal Elnett Stylingspray 3 Tage Glatt** has no fixative but promises a sleek, held result.
- **Balea Föhnlotion Volume Effect** has no fixative but is a volume styler.

Formula still decides the hard cases, inside each boundary.

### S0 routing gate

S0 runs as steps, not as "first match wins". Every step fails toward review, never toward a confident new route (leave-in §1.1 conservative-failure invariant).

1. **Evidence gate.** S0 needs three inputs:
   - a C1/C2 primary promise (German pack, manufacturer DE page, or a house brand on its own retailer page, per leave-in §2.4.1 rule 6);
   - captured directions;
   - a complete INCI.

   If any is missing or unreadable, or two C1/C2 sources conflict, the result is `provisional_boundary`. The product **stays in its current category** and routes to human review.
2. **Promise class** (C1/C2 only): `styling_result` · `care` · `heat_protection` · `refresh` · `mixed`.
   - `mixed` → `provisional_boundary`.
   - The class names which boundary rule applies in step 3. It never routes on its own.
3. **Pair boundary rule.** Exactly one applies:

   | Neighbour | Rule |
   |---|---|
   | **Leave-in** (promise `styling_result` or `care`, aqueous leave-on) | Run **Leave-in G0 unchanged**, both halves and the §2.3.2 precedence:<br>• `excluded_styling_first` (fixative-class route with thin conditioning **and** C1/C2 directions or positioning leading on durable hold or texture) → **Styling**.<br>• `in_category` (incl. T15's `incidental_film`: a conditioning film with a supporting fixative) → **Leave-in**, whatever the styling words say.<br>• G0's own `provisional_boundary` → stays put, review.<br>**Middle band D7 (ruled):** a product with **both** a fixative-class polymer above the tail **and** a substantive conditioning system that is sold as a curl/styling cream or balm → **Styling** `curl_cream`. Curl creams without a real fixative stay Leave-in per T15.<br>**Exception D6 (ruled):** a product with *neither* a fixative-class hold route (Leave-in L5 list) *nor* a substantive conditioning architecture, whose C1/C2 promise is a styling result (refresh mists, beach sprays, starch-only curl sprays), → Styling. "Real hold" here means the Leave-in HOLD sense, so salt, starch and particle mechanisms do **not** block D6. T15 itself is unchanged (D3). |
   | **Heat Protectant** | Primary promise decides, per `heat-protectant/decision.md`:<br>• protection-first → Heat Protectant, even with a fixative (Schutzengel);<br>• result-with-heat-first → Styling. |
   | **Dry Shampoo** | Directions and promise decide, per `dry-shampoo/decision.md`:<br>• refresh / oil absorption → Dry Shampoo;<br>• texture/grip with no refresh positioning → Styling;<br>• tie → Dry Shampoo. |
   | **Oil** (shine / finish / anti-frizz products) | **Name rule, the way retailers sort (D2).**<br>• A product sold as „Öl" or „Serum" stays in **Oil**, whatever its formula.<br>• Shine and finish products sold under any other name (Glanzspray, Shine Spray, Finishing Spray, Brillantine, Anti-Frizz-Spray) → **Styling** `shine_finish`.<br>• Oil keeps "immediate dry shine" in `oil/decision.md`; no Oil catalog re-sort.<br>• A water-based „Serum" that is really a leave-in conditioner still follows the Leave-in G0 rule. |

   Results on the calibration products:

   | Product | Name | Route |
   |---|---|---|
   | Elvital „Öl Magique" (silicone-led) | Öl | Oil |
   | John Frieda Frizz Ease „Haarserum" (silicone-led) | Serum | Oil |
   | Garnier Sleek & Stay „Haarserum" (pure silicone) | Serum | Oil |
   | Bumble and bumble Brilliantine (oil-led) | Brilliantine | Styling |
   | Balea Glow & Shine Finishing Spray | Finishing Spray | Styling |
4. **Names route in exactly two places:** the Oil boundary (D2: „Öl“/„Serum“ → Oil) and the curl-cream middle band (D7: a real fixative plus full care, sold as a curl/styling cream or balm → Styling). Everywhere else a name never routes: "Gel Wax" contains no wax, "Texture Clay" contains no clay.
5. **Styling never fills the Personal-Plan heat-protection role.** This is kept from the Heat-Protectant decision.

**Dry-run outcomes (72 products, after D2; before round 2).**

| Route | Count | Note |
|---|---|---|
| Styling | 61 | 7 of them are flagged `g0_pending` until the round-2 G0 lane rules on them (incl. D6) |
| Leave-in | 5 | includes NEQI under T15 |
| Heat Protectant | 2 | |
| Oil | 3 | Frizz Ease, Öl Magique, Sleek & Stay (D2 name rule) |
| Dry Shampoo | 1 | |

## 2. Subcategories: 5 families, 12 subtypes

Subtypes describe **how and when the product is used**, which is what the user recognises and what the routine compiler needs. **What the formula does** is carried by properties (§3).

The samples showed that splitting by product name produces lookalike subtypes:
- the mousse, Föhnlotion and root-spray samples share the same VP/VA, PQ-11 and starch systems;
- the wax, paste and clay samples share one wax/fatty-acid chassis.

Each subtype maps to one Stage-5 semantic role. Those roles already exist in `src/lib/routines/personal-plan/application/contracts.ts`: `styling` and `finish`.

| Family → Stage-5 role | Subtype key | DE label | Core job | Calibration samples |
|---|---|---|---|---|
| **A · Formen** (damp, before drying) → `styling` | `gel` | Haargel | hold + definition, sleek looks | 8 |
| | `curl_cream` | Lockencreme | soft definition + frizz control with a real hold route | 3 (+1 routed to Leave-in) |
| | `mousse` | Schaumfestiger | volume + light-to-strong hold, wave/curl lift | 5 |
| | `blowdry_lotion` | Föhnlotion & Föhnspray | volume/hold created by blow-drying, incl. root-lift sprays | 8 |
| | `smoothing_styler` | Glättungsstyler | sleek result created with heat (spray, cream; products named „Serum“ go to Oil per D2) | 4 |
| **B · Finish** (dry, at the end) → `finish` | `hairspray` | Haarspray & Haarlack | fixes the finished style | 6 |
| | `shine_finish` | Glanz- & Anti-Frizz-Finish | shine and flyaway control on dry hair; products **not** sold as „Öl“/„Serum“ (D2) | 2 (+3 routed to Oil) — round 2 fills |
| **C · Textur & Volumen** → `styling` | `salt_spray` | Salz- & Beach-Spray | beachy, piecey texture | 3 |
| | `texture_spray` | Texturspray | dry grip, airy volume, matte texture | 3 (+1 routed to Dry Shampoo) |
| | `hair_powder` | Haarpuder | root grip, matte volume | 4 |
| **D · Modellieren** (dry, mostly short hair) → `styling` | `molding` | Wachs, Paste & Pomade | restylable shape, separation, finish | 11 |
| **E · Auffrischen** → `styling` | `refresher` | Locken-Refresh | revive curls/waves between washes | 4 |

### What changed against the draft, and why

| Change | Evidence |
|---|---|
| `setting_lotion`, `root_lift` and volume Föhn-sprays merged into **`blowdry_lotion`**. Root lift becomes the property `target_zone: roots`. | In the samples, Taft Föhn-Spray, Alcina Föhn Lotion and Balea Ultra Volumen are near-identical alcohol + VP/VA systems, and no root-specific ingredient appeared; only nozzle and directions differ. Two lanes independently filed the same Föhn-sprays under different draft subtypes. |
| `heat_styling_spray` renamed **`smoothing_styler`**, defined by **job**: a sleek or sealed result produced with heat. | Mechanism is a separate property, and the members differ: Polysilicone-29 coats (Color Wow), silane silicone (Garnier Sleek & Stay), a silicone emulsion (Elnett), PVP in a cationic balm (Wella EIMI Flowing Form). Volume Föhn-sprays moved to `blowdry_lotion`. |
| `wax` + `paste` + `pomade` + clay/fiber merged into **`molding`**. `form` stays as a display property. | The Henkel wax, paste and clay share one chassis; got2b "Texture Clay" has no clay; Taft "Gel Wax" has neither gel former nor wax. The real split is base (anhydrous vs water-based) × finish × hold, all properties. |
| `styling_cream` dissolved. | Men's creams go to `molding` (form: cream). Curl creams go to `curl_cream`. Glättungscreme goes to `smoothing_styler`. Balea "Styling Creme Power Flex" is a PVP/carbomer gel and goes to `gel`. |
| `edge_control` is a zone (`target_zone: hairline`), not a subtype. | Only two DE products were found, one of them Amazon-only. Bali Curls Sleek Stick is a PVP/acrylates gel. §5 adds a matching branch for it. |
| `curl_refresher` renamed `refresher`. | Waves use it too. |

## 3. Properties

Three kinds of property:
- **formula-derived (F):** a deterministic read of the INCI; the research-engine side, classifiable blind.
- **claim-captured (C):** a C1/C2 manufacturer claim recorded verbatim, then normalised; never derived from formula.
- **usage-derived (U):** authoritative directions.

Routing (S0) and claim capture need authoritative sources. That makes them a separate capture step, not part of blind formula classification. Fit fields are derived policy on top (echo fields).

### 3.1 Category-wide (every styling product)

| # | Property | Values | Kind | Why it matters (sample evidence) |
|---|---|---|---|---|
| 1 | `styling_subtype` | 12 keys above | routing | user-facing type, plus a Stage-5 role via its family |
| 2 | `primary_job` + `secondary_jobs` (≤2) | definition · volume · texture · sleek · hold_fix · shine · frizz_control · refresh | C | ties products to user goals; one product can serve two jobs |
| 3a | `result_mechanisms` | fixative_film · natural_film · wax_lipid · particulate · salt · silicone_coat · humectant_only · none | F | Describes *how* the product makes its result:<br>• Taft mousse = starch<br>• Wellaflex mousse = PVP/VP/VA<br>• powders = silica silylate<br>• Color Wow = Polysilicone-29 |
| 3b | `hold_route` | present · absent · ambiguous | F, derived from 3a | **Present** when fixative_film, natural_film, wax_lipid, particulate or salt is present.<br>**Not hold routes:** silicone_coat (leave-in rule: Polysilicone-29 alone never sets HOLD) and humectant_only.<br>**Rheology exclusion** (leave-in L5 rule): carbomer, xanthan, guar, cellulose ethers, unmodified starches/gums and acrylates crosspolymers are **not** a natural film by themselves.<br>**Natural film:** hydrolysed/modified starches, chitosan and gum arabic count.<br>**Ambiguous** (→ review): carrageenan/gellan-only gels and unmodified-starch sprays. |
| 4 | `chaarlie_hold_level` | 0–4, or `review` (§4) | C, normalised | the user-facing strength |
| 5 | `flexibility` | beweglich · fest · unbekannt | C (explicit claims only) | "flexibel/elastisch/ohne zu verkleben" vs "Kleber/Crunch/Freeze"; Alcina publishes a Flex-Faktor |
| 6 | `finish` | matt · natürlich · glänzend · unbekannt | C, with an F sanity check | Taft Glanzstufe and American Crew Glanzfaktor exist. Matt follows wax/powder/soap, gloss follows oils/silicones/mineral oil. |
| 7 | `format` | gel · cream · foam · pump_spray · aerosol · serum · solid (wax/paste/pomade) · powder | identity | application template, aerosol preference |
| 8 | `application_moment` | damp_before_drying · before_heat · dry_finish · dry_restyle · second_day · unresolved | U | Gate for the routine compiler (anchors `dry_pre_heat`, `heat_tool`, `dry_finish` already exist). `unresolved` when the directions are missing or untrustworthy (Elnett Stylingspray). |
| 9 | `target_zone` | all · roots · lengths · surface · hairline | U | replaces the root_lift and edge_control subtypes |
| 10 | `heat_activated` | yes · no · unresolved | U | Guhl, Color Wow and Garnier Sleek & Stay say heat activates them; drives routine order |
| 11 | `weight` | light · medium · heavy | F (structured: form + non-volatile load) | sprays/powders/foams light, gels/lotions medium, creams/waxes heavy → fine-hair downshift |
| 12 | `drying_alcohol_load` | high (top 3) · present · none | F | sensitive-scalp caution; optional "ohne Alkohol" preference (dm offers that filter); weak evidence for hair damage, so never a hard rule |
| 13 | `washability` | normal · hard_to_wash | F | anhydrous petrolatum/wax leading (Balea MEN Pomade, Syoss Power Wax) → clarifying-wash hint |
| 14 | `ingredient_flags` | silicones · oils · fragrance · salt · propellant | F | existing flag pattern, sensitive-scalp filter |
| 15 | `captured_claims` | hold raw, duration, humidity, heat, hair type, free-from | C, verbatim, with tier | Stored, **never used for selection or ranking**: humidity and duration ("bis zu 48 h") follow the leave-in T9 precedent, and heat claims never fill the heat role. |

### 3.2 Which properties discriminate inside each subtype

| Subtype | Distinguish products by | Typical sample spread (dry-run hold) |
|---|---|---|
| `gel` | hold level, result mechanism (synthetic vs natural film), flexibility (crunch vs soft), format (gel/spray gel), alcohol load | Taft Power 4 (PVP + alcohol r2) · Bali Flaxseed 4 (carrageenan) · Syoss Creme-Gel 3 · Balea Crunchgel review |
| `curl_cream` | hold level, weight, conditioning co-load (G0 decides membership) | Taft Balm 2 · Balea Traumlocken 2 · Maria Nila Curlicue review |
| `mousse` | hold level, result mechanism, target_zone, silicone flag | Taft Volumen 3 (starch) · Wellaflex Locken 3 (PVP/VP/VA + dimethicone) · Alcina 2 |
| `blowdry_lotion` | hold level, target_zone (roots/all), heat_activated, alcohol load | Alcina Föhn 1 · Taft Föhn 2 · Alcina Ansatz 3 (roots) · Guhl (heat-activated starch) review |
| `smoothing_styler` | heat_activated, format, weight, hold 0–1 | Color Wow · Garnier Sleek & Stay · Garnier Diamond Sleek · EIMI cream |
| `hairspray` | hold level, flexibility, aerosol vs pump, finish | Taft 2/3/4 · Elnett 4 · Gard pump 4 · Syoss Max 4 |
| `shine_finish` | weight, base (ester/oil vs silicone), fixative present | got2b Glanz Spray (esters) · feschi (silicone) · Balea Glow aerosol (fixative + oils) · Brilliantine |
| `salt_spray` | result mechanism (salt vs salt+polymer), finish, moment | Balea Sea Salt · Bumble Surf (MgSO4) |
| `texture_spray` | fixative present, finish, residue | Living Proof 1 (VP/VA + particles) · Balea Volumenpuder 1 (starch only) |
| `hair_powder` | fixative add-on, residue | four silica-silylate powders; Kevin Murphy adds VP/VA |
| `molding` | hold level, finish, base (anhydrous vs water-based), form | Taft Gel Wax 1 glänzend · Taft Matt Wax 4 matt · AC Fiber 4 matt · AC Pomade 2 glänzend · Balea MEN Pomade 2 (anhydrous) |
| `refresher` | hold route (none/light), weight, alcohol | Balea humectant mist · got2b near-anhydrous aerosol · alverde aloe mist |

## 4. The Chaarlie hold scale (SD5)

**Finding that shapes the design.** Hold strength is a brand claim, not a formula fact:
- Taft Haarspray Classic "Halt 3" and Glanz "Halt 4" have **identical INCI in identical order**.
- Elnett "Normaler Halt" and "Extra Starker Halt" have identical INCI.
- Taft Volumen mousse "Halt 4" has no synthetic polymer.

No brand discloses a test, and the literature shows hold is not comparable across product forms.

The scale therefore normalises **C1/C2 manufacturer claims** onto one ladder. It is never derived from the formula, which is exactly leave-in rule T7, now with a normalisation on top.

| Level | DE label (= dm's filter wording) | Meaning |
|---|---|---|
| 0 | Kein Halt | only when the manufacturer explicitly says so; unclaimed strength is „keine Herstellerangabe“, never 0 (D8) |
| 1 | Leichter Halt | soft structure, hair moves freely |
| 2 | Mittlerer Halt | holds a normal style through the day, restylable |
| 3 | Starker Halt | firm, noticeably set |
| 4 | Sehr starker Halt | fixes demanding shapes; expect stiffness |

### Assignment (only C1/C2 claims)

House brands on their own retailer page count as C2: dm ↔ Balea/alverde, Rossmann ↔ Isana.

1. **Brand number with a known scale**, using a normalisation table:

   | Brand scale | Level 1 | Level 2 | Level 3 | Level 4 |
   |---|---|---|---|---|
   | Taft/Syoss sprays, foams, Föhnspray; Wellaflex; Maria Nila (x/5) | 1–2 | 3 | 4 | 5 / 5+ |
   | NIVEA MEN, Gard, Taft 6 (printed 1–6) | 1–2 | 3 | 4 | 5–6 |
   | Alcina Hold-Faktor x/10 | 1–2 | 3–5 | 6–7 | 8–10 |

   - Taft **gels** use a separate 4–14 scale, so their numbers are not comparable; only their words count („maximaler Halt“ → 4).
   - Brands with no stated maximum (Wella EIMI, American Crew) are read by their strength words.
   - Henkel numbers are shared across Taft, Syoss and got2b, and the number wins over inflated words (Syoss "3 = starker Halt" → 2).
   - The table grows per brand; the exact tables live in `build-calibration-r2.js`.
2. **Brand's own strength words.** When a pack has both a number and a word, the number wins: Taft Glanz says "Halt 4" and "Ultra starker Halt" and lands on 3.

   | Words | Level |
   |---|---|
   | leicht, sanft, soft, weich | 1 |
   | mittel, normal | 2 |
   | stark | 3 |
   | sehr / extra / ultra / mega / extrem stark, Max, Power, Kleber | 4 |

   These words describe flexibility or look, **not strength**: "flexibel", "elastisch", "natürlich (aussehend)". They alone send the product to review.
3. **Brand word ladders** (Elnett: Normal < Stark < Extra stark < Sehr stark). Mid-ladder steps are marked uncertain.
4. **Retailer chips** (dm "Halt" on third-party brands, Douglas "Haltgrad") are C3. They are **recorded as a trace and never assign a level** (T7). In the dry run they contradicted the brand claim on 4 products (e.g. Wellaflex "Starker Halt" vs dm chip "leicht") and were the only source on Bumble Surf, which therefore goes to review.
   - *Owner option:* admit C3 chips as a last resort. Not recommended.
5. **No strength claim → „keine Herstellerangabe“ (D8).** No level is derived from the formula, in either direction.

   A strength is never borrowed from a similar formula. Example: Balea Haarpuder keeps its own house-brand "starker Halt" even though got2b's identical base says "leicht".
6. **Plausibility flag (D8b; internal, never changes a level).** Two cases are flagged for review:
   - a strength claim with no hold mechanism above the tail;
   - same brand, identical INCI, different stated level → verify against the pack.

   Round-2 trips:
   - Elnett Stylingspray (pack "Starker Halt", level 3 kept, flagged);
   - Cantu "Extra Hold" (C3 only, so no level anyway);
   - Taft Classic/Glanz (identical INCI).

### Comparability rule

Levels compare only **within a hold family**:
- film: gel, curl_cream, mousse, blowdry_lotion, hairspray, salt/texture spray;
- molding;
- powder.

The app never says "this wax holds like that hairspray".

### Products without a stated strength (ruled D8, option A "for now")

**When hold matters.**
- In `salt_spray`, `texture_spray`, `hair_powder`, `shine_finish`, `smoothing_styler` and `refresher`, hold plays **no part** in selection; finish, weight and application decide.
- In `gel`, `curl_cream`, `mousse`, `blowdry_lotion`, `hairspray` and `molding`:
  - a stated level inside the person's hold band ranks first;
  - a product with **no** stated level stays eligible, is ranked after those, and is shown as „Halt: keine Herstellerangabe“;
  - Chaarlie never estimates a level and never excludes a product for lacking one.

**Filling the gaps.** Gaps are filled over time from pack photos (intake/scanner).

**Coverage in round 2.** Strength is stated on 6/6 hairsprays and 9/11 molding products, but on only 3/10 gels.

**After the research (ruled D8b).**
- **Internal plausibility flag.** Two cases go to review, and the flag never changes a level:
  - a strength claim with no hold mechanism (e.g. Cantu „Extra Hold“);
  - the same brand with identical INCI but a different stated level.
- **Neutral fact on the product card.** When no level is stated, show „Enthält Stylingpolymere (z. B. PVP)“ next to „Halt: keine Herstellerangabe“.
- **Later, as a separate feature:** user hold ratings, grouped by hair profile.

Evidence: `round2/hold-research-community.md` and `round2/hold-research-ingredients.md`. Ingredients cannot predict hold; the best simple rule was right 3 times out of 6.

### Dry-run result (historical: round 1, after D2, before round 2 and D8; current numbers in §7)

Of the 61 Styling products:

| Assigned | Count |
|---|---|
| Level 1–4 | 35 (1:7 · 2:7 · 3:12 · 4:9) |
| Level 0 | 5 |
| Review | 21 |

The ladder is used end to end. The review share is high because the honest rules refuse to guess. The review cases are:
- no claim but a hold route present;
- duration-only claims ("48 h");
- look or flexibility words only;
- C3-only chips.

Round 2's C1/C2 capture from packs and manufacturer pages is expected to resolve most of them.

## 5. Need tier and matching (sketch for the Personal-Plan decision doc)

### 5.1 Priority and need tier (SD4)

Two separate contracts.

**Functional priority** uses the shared scale:

| Situation | Priority |
|---|---|
| A styling problem plus a matching goal | 3 |
| Problem only | 2 |
| Goal only | 1 |

Styling problems: `lost_shape`, `low_volume_or_weighed_down`, and frizz/flyaways *after* care coverage. Styling goals: `shape_definition`, `volume_balance`, `manageability_styling`, plus the new look goals in §5.3.

**Need tier (ruled D4):**

| Situation | Tier | Behaviour |
|---|---|---|
| Any matching styling **problem or goal** (priority 1–3) | **basis** | actively in the plan („Hey, mach das“) |
| No stated problem/goal, but the **profile** suggests a likely benefit | **optional** | offered with a considerate note (below) |
| Neither | **not_needed** | still browsable |

Profile triggers for the optional suggestion (proposed; Nick may adjust):

| Profile | Optional suggestion | Note (German UI) |
|---|---|---|
| Fine hair | volume helper: `mousse`, `blowdry_lotion` (roots) or `hair_powder` | „Für Tage, an denen das Volumen nicht ganz mitspielt.“ |
| Wavy/curly/coily, air-dries | light `gel` or `mousse` | „Für Tage, an denen deine Wellen/Locken etwas mehr Halt brauchen.“ |
| Short hair | `molding` | „Falls du deiner Frisur mal mehr Form geben willst.“ |

Hair type can trigger an *optional* suggestion, never a *basis* one. Frizz alone is first a care job (Leave-in/Oil).

### 5.2 Choosing the subtype

Inputs: goal/problem × hair_texture × thickness × hair_length × drying_method/heat tools. All of these exist in the profile today.

Rows are evaluated top-down and the first match wins. The short-hair row comes first so that short hair never gets long-hair stylers by default.

| # | Situation | First choice | Alternatives | Hold band (default) |
|---|---|---|---|---|
| 1 | Short hair (very_short/short) + any styling goal | `molding` | `texture_spray`/`hair_powder` for volume; `gel` for a wet look | 2–4 |
| 2 | Sleek look without heat (slicked back, bun, edges) | `gel` (target_zone all or hairline) | `molding` (glossy pomade) for short hair | 3–4 |
| 3 | Waves/curls/coils, definition, air-dry or diffuse | `gel` (curly/coily) or `mousse` (fine, wavy) | `curl_cream` (normal–coarse curly/coily) | wavy 1–2, curly 2–3, coily 2–4 |
| 4 | Volume, fine/normal, blow-dries | `blowdry_lotion` (roots) | `mousse` | 1–2 |
| 5 | Volume, fine, air-dries | `mousse` | `texture_spray` / `hair_powder` (medium length) | 1–2 |
| 6 | Sleek/smooth, uses heat tools | `smoothing_styler` | — | 0–1 |
| 7 | Frizz/shine on dry hair, no heat, not owned by Oil per S0 | `shine_finish` | — | 0 |
| 8 | Style does not hold (`lost_shape`), straight hair or heat curls | `hairspray` (flexible for fine hair) | — | 2–3 |
| 9 | Beach/texture look | `salt_spray` (wavy/straight) | `texture_spray` | 1 |
| 10 | Second-day curls | day-2 **instruction** with the existing gel (D5) | `refresher` product only as an optional extra | — |

Within a subtype, products are ranked by:
- hold band match (**only in** gel, curl_cream, mousse, blowdry_lotion, hairspray, molding; D8);
- weight vs thickness (fine → light);
- finish preference (molding/texture only);
- flexibility preference;
- cautions:
  - `salt_spray` → bleached or highly damaged hair;
  - high alcohol + root application → sensitive or irritated scalp;
  - `hard_to_wash` → clarifying hint;
  - aerosol → optional "lieber Pumpspray" preference.

Captured humidity, duration and heat claims never influence selection.

**Plan composition (ruled D5: one product per job).** Evidence: `03-d5-evidence.md`.
- **One shaping styler** (Stage-5 role `styling`). Never two products of the same subtype.
- **Exception:** curly/coily hair with normal–coarse or dry lengths may get `curl_cream` + `gel` — two stylers with different jobs (cream for softness/definition first, gel for hold last).
- **Finisher** (role `finish`): `hairspray` is the **default** for blow-dried and heat-styled looks (rows 4, 6, 8); for air-dried curls and short-hair `molding` it appears only on `lost_shape`.
- **Refresh:** a day-2 *instruction* reusing the existing gel („Wasser + etwas Gel, kurz anföhnen“); a `refresher` product is only an optional extra for wavy/curly/coily people who don't wash daily.
- **Ceiling: 3 styling products.** Leave-in and heat protection don't count (own categories).
- Routine order: Leave-in → Styling → Finish (reuses the Leave-in decision).

Examples: Lisa (fine, straight, blow-dries, „wenig Volumen“) → `blowdry_lotion` at the roots + flexible `hairspray`. Anna (thick curls, dry ends) → `curl_cream` + `gel`, day-2 tip. Ben (short hair) → `molding` (paste).

### 5.3 Inputs the quiz does not capture today (small)

- Look goal values: add `texture` and `sleek` next to the existing definition/volume goals.
- Optional hold preference ("leicht & beweglich / mittel / stark"). Its default comes from the goal band, so the question can be skipped.
- Finish preference, asked only when `molding` or `texture_spray` is in play.
- Aerosol ok?, asked only when a spray candidate wins.

## 6. Honesty rules (user-facing)

- Show the hold level as "laut Hersteller: Starker Halt". Never show "hält 48 h" or humidity guarantees.
- Never compare hold across families.
- A styling product never counts as heat protection.
- Never claim that alcohol or salt "damages" hair. Use caution copy only ("nicht auf die Kopfhaut sprühen").
- Confidence levels stay internal (existing rule).
- Keep medically adjacent items separate from cosmetic guidance: pomade acne at the hairline, aerosol inhalation, and hairline thinning (→ existing hair-loss escalation).

## 7. Calibration set and round 2

**Round 2 is done.** Results are in `data/research/styling-inci/concept-v0/round2/SUMMARY.md` and `calibration-set-r2.json` (90 products; after D7 and the pre-push review fixes: 70 Styling, 56 of them with C1/C2 claims; hold 1:4 · 2:9 · 3:11 · 4:10 · keine Herstellerangabe 36). Two new owner rulings came out of it: D7 (curl-cream middle band) and D8 (products without a stated hold strength). The round-1 plan below is kept for traceability.

`calibration-set.json` lists all 72 products with route, subtype, proposed hold and finish, and flags (`g0_pending`, `house_brand_c2`, `claim_formula_conflict`, `retailer_chip_*`, `decision_D3`). The per-subtype first set is listed in §2.

**Round 2** (target 5–8 per subtype, drugstore-first, ≥1 premium):

1. **Freeze C1/C2 claims and directions** from the German pack or manufacturer DE page for every record. Today 65 of 72 INCIs, and most claims, are third-party retailer copies (C3).
   - Re-capture Maria Nila "Hold 3/5".
   - Capture Elnett Stylingspray directions.
2. **Run Leave-in G0 formally** on the 7 `g0_pending` records.
3. **Fill the gaps:**

   | Subtype | Missing |
   |---|---|
   | `curl_cream` | Isana Curltastic, Cantu, one more salon product |
   | `shine_finish` | a drugstore Glanzspray, Living Proof No Frizz |
   | `salt_spray` | Jean&Len, one salt-free sugar spray |
   | `texture_spray` | Syoss/got2b texture spray |
   | `refresher` | a curl-specialist brand |
   | all | Rossmann-only and Müller own brands |
4. **Run the repo's research-engine method** (mask template), with authoritative capture kept separate from blind classification:
   1. frozen packets;
   2. two blind lanes classify the F properties;
   3. diff;
   4. owner rulings;
   5. logic lock.

## 8. Decisions (D1–D8b ruled 2026-10-09)

See `02-rulings.md` for the full wording.

| ID | Ruling |
|---|---|
| D1 | 12 subtypes; all three merges accepted. |
| D2 | Oil ↔ Styling by product name, like retailers: „Öl“/„Serum“ → Oil; other shine/finish names → Styling. |
| D3 | Keep T15 as the Leave-in ↔ Styling border; NEQI stays Leave-in. |
| D4 | Problem or goal → basis; profile-based optional suggestions with a considerate note. |
| D5 | One product per job; hairspray default for blow-dry looks; cream + gel for curly/coily with normal–coarse or dry lengths; refresh as instruction; max 3. |
| D6 | No care + no hold + styling-look promise → Styling (exception to Leave-in G0). |
| D7 | Curl-cream middle band (real fixative + full care): if sold as a curl/styling cream or balm → Styling. T15 stays for clear cases. |
| D8 | Hold is used only where brands state it; never guessed, never a reason to exclude. |
| D8b | Plus an internal plausibility flag and a neutral „Enthält Stylingpolymere“ fact; user hold ratings by hair profile are a later feature idea. |

## 9. Research inputs (not re-stated here)

- **Taxonomy and evidence review** (hair-care-expert lane): fixative chemistry; PVP humidity weakness vs VP/VA and acrylates; Robbins & Scott on body and style retention; medical adjacency (aerosol inhalation, pomade acne, traction alopecia).
- **DE retail map:** core shelves are Haarspray, Schaumfestiger, Haargel, Haarwachs and a creme/spray catch-all; dm is the only retailer with a hold facet (4 words); the curly segment is about 9–13 % of styling SKUs.
- **Hold measurement:** HHCR, three-point bending, omega loop and junction strength are not comparable across forms (Hoessel et al., J Cosmet Sci 2010); no public brand-scale mapping exists.
- **Codex review (Rev. 0 → Rev. 1):** nine findings, all accepted; data totals independently reproduced; Taft INCI equality confirmed character-for-character.
