# Personal Plan Anwendung — instruction review

**Review state:** Proposed copy and exception policy; no production content changed
**Inventory checked:** 273 active protocol rows / 224 active products on 2026-08-12

## Decision rule

A brand sentence is not an application technique. The visible guidance is owned by Chaarlie and is
shared whenever the physical action is the same.

A product may supply only a typed value that changes execution:

- where it goes;
- wet, damp, or dry state;
- rinse or leave in;
- exact or label-directed contact time;
- conditioner before, after, replaced, or forbidden;
- heat state, activation, maximum claimed temperature, or reapplication;
- a safety/caution code;
- a genuinely composite sequence that cannot be expressed by those values.

Manufacturer prose, marketing phrasing, “repeat if needed,” and “follow with our matching product”
do not create a bespoke protocol.

## Proposed shared German techniques

### 1. Regular shampoo — one canonical instruction

Applies to all 33 current regular-shampoo protocols, including every OGX shampoo.

1. `Haare und Kopfhaut vollständig anfeuchten.`
2. `Eine kleine Menge auf die Kopfhaut geben und sanft einmassieren. Die Längen werden beim Ausspülen mitgereinigt.`
3. `Gründlich ausspülen.`

No product may add “danach Conditioner verwenden.” If the accepted Routine contains a
conditioner, the Routine composer places that actual conditioner next.

Evidence: the American Academy of Dermatology recommends applying shampoo to the scalp rather than
the full lengths and using conditioner after washing, with placement adapted to hair type:
[AAD healthy-hair guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/healthy-hair-tips).

**Product-specific values:** none for OGX. The current OGX wording is removed from visible authority.

**Real shampoo exceptions:**

- `Swiss-O-Par Teebaumöl`: exact two-pass workflow with a three-minute second pass.
- Dandruff/treatment shampoos: same scalp technique, plus a verified contact-time value or the
  explicit instruction `Einwirkzeit auf der Verpackung beachten.` The product does not get bespoke
  prose. AAD likewise advises applying dandruff shampoo to the scalp and following the label time:
  [AAD curly-hair guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/curly-hair-care).
- `Guhl Kraft & Fülle`: retain a two-minute value only if the current manufacturer label is
  reconfirmed; otherwise it becomes ordinary canonical shampoo.

### 2. Conditioner — one canonical instruction with optional time

1. `Überschüssiges Wasser sanft aus dem Haar drücken.`
2. `Eine kleine Menge gleichmäßig in Längen und Spitzen verteilen.`
3. Optional typed wait: `{{contact_time_de}} einwirken lassen.`
4. `Gründlich ausspülen.`

For dry or curly hair, the profile may extend placement higher through the lengths; it never changes
the wording product by product. This follows the same AAD guidance cited above.

Current product-specific values to review:

| Product                           | Proposed typed value  |
| --------------------------------- | --------------------- |
| Nivea Power Repair Conditioner    | 1 minute              |
| Elvital Fiber Booster Conditioner | 3 minutes             |
| Other 39 conditioners             | no separate wait step |

### 3. Standard leave-in — shared by format

Common preparation: `Das Haar nach dem Waschen sanft handtuchtrocknen.`

| Format                     | Canonical application                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Spray                      | `Sparsam in die mittleren Längen und Spitzen sprühen und gleichmäßig verteilen. Nicht ausspülen.`    |
| Cream, lotion, milk, serum | `Eine kleine Menge in den Händen verteilen und in Längen und Spitzen einarbeiten. Nicht ausspülen.`  |
| Between-wash dry care      | `Mit einer sehr kleinen Menge in trockenen Längen und Spitzen beginnen und nur bei Bedarf ergänzen.` |
| Damp refresh               | `Die betroffenen Längen leicht anfeuchten, sparsam verteilen und nicht ausspülen.`                   |

AAD supports a small amount on damp hair, applied to hair rather than scalp, with spray versus
cream/lotion technique separated:
[AAD leave-in guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/leave-in-conditioner-tips).

Heat protection is a separate composed role. A leave-in claim does not silently become heat
protection unless the catalog has a verified heat fact.

### 4. Rinse-out mask — one canonical shell, product time and conditioner policy

1. `Nach dem Shampoo überschüssiges Wasser sanft ausdrücken.`
2. `Die Maske gleichmäßig in Längen und Spitzen verteilen.`
3. `{{contact_time_de}} einwirken lassen.`
4. `Gründlich ausspülen.`

The current `all_hair` value is retired because it cannot distinguish hair from scalp. A mask may
reach higher through the hair only with an explicit `root_to_tip_hair` fact; scalp application
requires `scalp_roots` and explicit evidence.

General support: masks are normally used after washing on clean, damp hair, left for the labeled
time, and rinsed thoroughly:
[dm mask guidance](https://www.dm.de/haare/haarpflege/haarkur-und-haarmaske/haarmasken-3261232).

The 34 current masks keep a shared shell. Their only visible variations are the following typed
values:

| Time             | Products                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 30 seconds       | Guhl 30 sec. Feuchtigkeit                                                                                                                                                               |
| 1 minute         | Garnier Wahre Schätze Aktivkohle; Sante Intense Hydration; Wahre Schätze Argan & Camelia; Wahre Schätze Avocado & Sheabutter                                                            |
| 2 minutes        | Pantene Bond Repair; Pantene Hydra Glow; Pantene Keratin Repair & Care                                                                                                                  |
| 2–3 minutes      | Balea Haarkur reparierend; Bali Curls Deep Repair; Gliss Aqua Revive; Gliss Liquid Silk; Guhl Panthenol + Reparatur; Syoss Intense Curls; Syoss Intense Keratin                         |
| 3 minutes        | Balea 3in1 Intensivmaske; Balea Natural Beauty 3in1 Locken; Balea Plex Care 2in1; Balea Aqua Hyaluron; Fructis Hair Food Papaya; Neqi Build Boost; Neqi Gloss Glaze; Neqi Peptide Power |
| 3–5 minutes      | Isana Milchprotein & Mandel; Jean&Len Tiefenreparatur; Syoss Lamination Intense Glaze                                                                                                   |
| 5 minutes        | Balea Glow & Shine; Pomélo+Co Shine Therapy; Schaebens Argan-Öl                                                                                                                         |
| 5–10 minutes     | Alterra Intensiv Repair; Fructis Hair Food Aloe Vera; Neqi Repair Reveal                                                                                                                |
| up to 10 minutes | Hask Argan Oil Deep Conditioner                                                                                                                                                         |
| 10–20 minutes    | Bali Curls SOS Protein Treatment                                                                                                                                                        |

Conditioner is not written into a mask step. The composer applies one of these policies to the
actual Routine:

| Proposed policy         | Current products needing explicit confirmation                               |
| ----------------------- | ---------------------------------------------------------------------------- |
| Replaces conditioner    | 29 products                                                                  |
| Conditioner before mask | Balea Professional Glow & Shine                                              |
| Conditioner after mask  | Bali Curls Deep Repair; Bali Curls SOS Protein Treatment; Neqi Repair Reveal |
| No conditioner that day | Pomélo+Co Shine Therapy                                                      |

Those five non-default conditioner relationships are specific enough to require Nick's content
review and current-source confirmation. The remaining 29 share `replaces_conditioner`.

### 5. Finishing oil — shared by role

| Role              | Canonical technique                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dry finish        | `Mit 1 Tropfen oder einer sehr kleinen Menge beginnen, in den Händen verteilen und in Spitzen und trockene Längen geben. Nur bei Bedarf ergänzen.` |
| Damp conditioning | `Sparsam in handtuchtrockene Längen und Spitzen verteilen. Nicht ausspülen.`                                                                       |
| Pre-wash oil      | `In Längen und Spitzen verteilen, {{contact_time_de}} einwirken lassen und danach shampoonieren.`                                                  |

The product decides its supported role; it does not decide new prose. General role and amount
support comes from Kérastase's guidance to start small and apply through mid-lengths and ends unless
otherwise stated:
[Kérastase oil guidance](https://www.kerastase.com/kerastase-club/most-asked/hair-guide/how-to-use-hair-oil).

Current timed pre-wash values:

| Product                               | Time       |
| ------------------------------------- | ---------- |
| Nuxe Huile Prodigieuse                | 10 minutes |
| NANOIL Avocadoöl                      | 15 minutes |
| Garnier Wahre Schätze Curl Revival Öl | 60 minutes |

### 6. Deep-cleansing shampoo — one reset template

1. `Haare und Kopfhaut vollständig anfeuchten.`
2. `Auf die Kopfhaut geben und sanft einmassieren.`
3. `Gründlich ausspülen.`

The reset focus (`product buildup`, `mineral/hard water`, or `broad spectrum`) determines when the
Routine schedules it, not different application prose. A following conditioner is composed only
from the actual Routine.

Applies to all five current products / six roles: Balea, Gliss, Isana, NEQI, and Swiss-O-Par.

### 7. Dry shampoo — shared by physical format

**Aerosol (eight current products)**

1. `Dose kräftig schütteln.`
2. `Trockenes Haar scheiteln und sparsam aus Abstand auf fettige Ansätze sprühen.`
3. `Nach der angegebenen Zeit mit den Fingerspitzen verteilen und Überschüsse ausbürsten.`

This follows both AAD and manufacturer guidance:
[AAD dry-shampoo guidance](https://www.aad.org/public/everyday-care/hair-scalp-care/hair/dry-shampoo-best-results),
[Batiste format guidance](https://www.batistehair.com/faqs).

**Foam (Balea Sensitive):** apply a small amount to dry roots, distribute, allow to dry, then style.

**Liquid-to-dry (got2b):** apply sparingly to dry roots, wait 15 seconds, massage/distribute, then
style.

Foam and liquid are format templates, not bespoke brand prose. Dry shampoo remains a bridge between
water washes and never replaces regular shampooing.

### 8. Heat protection — shared by supported state

| Family      | Canonical technique                                                                           |
| ----------- | --------------------------------------------------------------------------------------------- |
| Damp only   | `Gleichmäßig auf handtuchtrockenem Haar verteilen. Erst danach föhnen oder stylen.`           |
| Dry only    | `Gleichmäßig auf vollständig trockenem Haar verteilen. Erst danach das heiße Tool verwenden.` |
| Damp or dry | Render the matching one of the two instructions for that heat event.                          |

Optional verified facts add `Schutz bis {{max_temperature_c}} °C` and whether a separate later heat
event requires reapplication. Heat activation is a typed fact, not inferred from marketing copy.

This applies to the seven dedicated heat protectants and verified heat-carrying leave-ins/oils. The
only currently heat-activation-specific product is `Neqi Diamond Glass Ultimate Styling Spray`.

### 9. Scalp care — shared shell by rinse mode, product facts required

**Leave-on:** `Scheitelweise sparsam direkt auf die saubere Kopfhaut geben, sanft verteilen und nicht ausspülen.`

**Rinse-off exfoliant:** `Scheitelweise auf die Kopfhaut geben, sanft verteilen, {{contact_time_de}} einwirken lassen und gründlich ausspülen.`

Every scalp-care product must supply an explicit rinse mode, state, amount/cadence source, and
cautions. Density-claim tonics remain cosmetic guidance; Anwendung must not imply diagnosis or
treatment.

Specific values requiring review:

| Product                                      | Family / value                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Balea Kopfhautpflege Peeling Tiefenreinigung | rinse off / 15 minutes                                                                                  |
| Isana Kopfhautpeeling Tiefenreinigung        | rinse off / 15 minutes                                                                                  |
| Eucerin Intensiv-Tonikum                     | leave on                                                                                                |
| Gliss Klärendes Serum                        | leave on                                                                                                |
| Head & Shoulders Leave-In Serum              | leave on                                                                                                |
| L'Oréal Anti-Haarverlust Serum               | leave on; cosmetic claim boundary                                                                       |
| The Ordinary Multi-Peptide Serum             | leave on; clean, dry scalp; cosmetic claim boundary                                                     |
| Balea Kopfhautpflege Serum Sensitive         | **current contradiction:** family says leave on, payload says rinse out; re-research before publication |

The Ordinary's official direction confirms a few drops on clean, dry scalp, leave in, and stop on
irritation:
[The Ordinary product directions](https://theordinary.com/on/demandware.store/Sites-deciem-Site/en_CA/Product-GetProductDirections?pid=rdn-multi-peptide-serum-for-hair-density-60ml).

### 10. Bond repair — exact workflows retained

These four current products are materially different and remain exact. They are reviewed as
workflows rather than arbitrary product copy.

| Product                                 | Proposed exact workflow                                                                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Epres Bond Repair Treatment             | Mix concentrate as directed; spray onto dry unwashed hair until evenly damp; wait at least 10 minutes; then shampoo and condition. **Repair needed:** set rinse transition explicitly to `follow_with_shampoo`, not null.     |
| K18 Leave-In Molecular Repair Hair Mask | Shampoo; do not condition first; towel-dry; apply **1–3 pumps for the full-size product** from ends upward; wait 4 minutes without rinsing; then continue with styling/care.                                                  |
| OLAPLEX No.0                            | Apply section by section to dry hair; wait 10 minutes; apply the linked No.3 without rinsing No.0; wait another 10 minutes; then rinse, shampoo, and condition. The Routine must contain the required companion relationship. |
| OLAPLEX No.3PLUS                        | Apply generously to wet hair before shampoo; wait 3 minutes; rinse; then shampoo and condition.                                                                                                                               |

Official evidence confirms the materially different sequences:
[K18 directions](https://www.k18hair.com/products/leave-in-molecular-repair-hair-mask-15ml),
[OLAPLEX No.0/No.3 FAQ](https://olaplex.com/pages/frequently-asked-questions-pro),
[OLAPLEX No.3PLUS directions](https://olaplex.com/products/n-3plus-complete-repair-treatment).

**OLAPLEX blocker:** the current catalog relationship points No.0 to No.3PLUS, while the verified
No.0 sequence names No.3 Hair Perfector and that catalog row is discontinued. The No.0 product row
owns the one composite workflow, but it resolves only when a currently supported compatible
companion is explicitly verified and present. Until then, No.0 is one unresolved exact product; it
does not create a sixth workflow and it must not substitute No.3PLUS by inference.

## Exhaustive disposition of current content

| Current category |    Rows | New authority                                                                  |
| ---------------- | ------: | ------------------------------------------------------------------------------ |
| Shampoo          |      48 | canonical regular or treatment template; Swiss-O-Par exact workflow            |
| Conditioner      |      41 | one template + two optional wait values                                        |
| Leave-in         |      61 | format/state templates + typed heat facts                                      |
| Mask             |      34 | one shell + time + five non-default conditioner policies to confirm            |
| Oil              |      54 | role templates + three pre-wash times + typed heat facts                       |
| Dry shampoo      |      10 | three format templates + one 15-second value                                   |
| Deep cleansing   |       6 | one reset template; reset focus schedules use                                  |
| Heat protectant  |       7 | state template + heat facts                                                    |
| Scalp care       |       8 | two rinse-mode templates; one current contradiction to repair                  |
| Bondbuilder      |       4 | four exact reviewed workflows                                                  |
| **Total**        | **273** | **shared by default; four exact product rows plus the Swiss two-pass shampoo** |

## In-use family to template map

The live 273-row product inventory contains 21 distinct application families across 26
category/family combinations. This table also includes `post_wash_booster`, one of the three active
shared seed protocols, so it contains 22 reviewed mappings in total. No executor may invent a new
template while backfilling a family in this table. Families absent from both the live product rows
and this reviewed seed set, including powder dry shampoo, remain inactive until separately reviewed.

| Current application family           | V2 template / disposition                                                   |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `standard_rinse_out_cleanse`         | `shampoo.standard-scalp-cleanse.v2`                                         |
| `targeted_treatment_shampoo`         | `shampoo.targeted-scalp-cleanse.v2` + typed label time/caution; Swiss exact |
| `standard_rinse_out_conditioning`    | `conditioner.standard-rinse-out.v2` + optional time                         |
| `post_wash_damp_conditioning`        | category-specific `leave-in.damp.v2` or `oil.damp.v2`                       |
| `post_wash_booster`                  | `leave-in.damp.v2`                                                          |
| `between_wash_damp_refresh`          | `leave-in.damp-refresh.v2`                                                  |
| `between_wash_dry_care`              | `leave-in.dry-care.v2`                                                      |
| `post_shampoo_rinse_out_mask`        | `mask.rinse-out.v2` + time + conditioner policy                             |
| `dry_finish`                         | `oil.dry-finish.v2`                                                         |
| `pre_wash_lengths_treatment`         | `oil.pre-wash.v2` + time                                                    |
| `reset_cleanse`                      | `deep-cleanse.standard-reset.v2`                                            |
| `aerosol_spray`                      | `dry-shampoo.aerosol.v2`                                                    |
| `foam`                               | `dry-shampoo.foam.v2`                                                       |
| `liquid_to_dry`                      | `dry-shampoo.liquid-to-dry.v2` + time                                       |
| `pre_heat_damp`                      | category-specific `heat.damp.v2`                                            |
| `pre_heat_dry`                       | `heat.dry.v2`                                                               |
| `either_state_protection`            | category-specific `heat.by-event-state.v2`                                  |
| `leave_on_scalp_care`                | `scalp.leave-on.v2` + state/caution facts                                   |
| `rinse_off_scalp_care`               | `scalp.rinse-off.v2` + time/caution facts                                   |
| `pre_shampoo_single_treatment`       | exact product workflow: Epres or OLAPLEX No.3PLUS                           |
| `pre_shampoo_booster_plus_treatment` | exact OLAPLEX No.0 companion workflow                                       |
| `post_shampoo_timed_leave_in`        | exact K18 workflow                                                          |

The remaining contract families are not present in the current live inventory and are not silently
activated by this backfill.

## Proposed owner decisions

1. Approve the canonical German copy above as Chaarlie's visible authority.
2. Approve exactly five full exact workflows: Swiss-O-Par Teebaumöl plus the four bond treatments.
3. Review the five mask conditioner relationships and confirm or correct them.
4. Approve replacing ambiguous `all_hair` with explicit hair-versus-scalp placement.
5. Require current-source repair for the Balea scalp serum, Epres rinse transition, and K18 amount
   before the new resolver can publish them.

No other product receives bespoke visible wording.
