# Price audit: four-bucket handover

Prepared **2026-10-05** for the next agent. This is a continuation of the pricing task, not a new catalog-classification or server-rollout project.

**Outcome:** resolve outstanding purchase links, whole-package prices, package sizes and verified recognition barcodes, using Nick's preferred retailers. Keep existing product properties and recommendation status unless Nick explicitly approves a concrete change.

**Evidence date:** the offers, stock states, prices and catalog snapshots below were verified on **2026-10-04**. They were not refreshed on October 5 while writing this handover. Refresh relevant offers and live rows before proposing or applying further changes. An earlier failed search is not proof that a product cannot now be bought.

## Where to continue

- Primary repository: `/Users/nick/AI_work/hair_conscierge`.
- Existing pricing worktree (`TASK_ROOT`): `/Users/nick/AI_work/hair_conscierge/.worktrees/price-audit-rollout-receipt`.
- Branch: `codex/price-audit-rollout-receipt`.
- Handover baseline: commit `26bffa72`, clean before this file was created; branch was 28 commits ahead and 3 behind `origin/main`. Inspect current ownership/status; do not reset, rebase or replay old operations to recreate that snapshot.
- Relevant completed commits: `087b9a80` restores recommendation flags; `26bffa72` records verified bucket-1 commerce and barcodes.
- All relative local links in this file resolve from this `plans/` directory. Machine-readable source packets are under `TASK_ROOT/docs/price-audit-rollouts/`.

Read current `AGENTS.md` and the [Product Intake Research Ops runbook](../docs/product-intake-research-ops.md), particularly **Source and Purchase URL Priority**, before acting. Use Branch Gate for repository writes, Product Intake for catalog/intake work, and the appropriate category research skill only for an actual research dependency. Supabase project: `pqdkhefxsxkyeqelqegq`; use the Supabase skill for any database access.

## Settled rules from Nick

1. **Universal shop order:** **dm → Rossmann → Müller → brand-direct → Amazon DE → reputable German/EU specialists**. This applies across every category, including oils. Prefer verified direct offers over marketplace partner listings; record seller and German orderability where relevant.
2. **Shop and purchaseability outrank package size and price.** Record the chosen bottle/package's actual size and whole-package EUR price. Do not optimise per litre or insist on preserving a particular size. A smaller/larger pack of the same verified product is acceptable under the chosen-base-product rule.
3. **One chosen purchase offer:** one product can have multiple verified recognition barcodes but one recommended purchase link, package size and price. Those fields describe the chosen base offer, not necessarily the scanned barcode's package. Preserve old identifiers and check canonical ownership across the entire catalog before adding a barcode. Do not attach a different formula/variant's barcode simply to widen recognition.
4. **No sourcing-driven pauses.** Missing links, disabled carts, search misses, blocked requests, store-only stock or absent online prices do not authorize changing `is_chaarlie_recommended`, `is_active`, lifecycle or availability stamps without supporting evidence. Nick explicitly rejected pausing products as bucket 1's resolution.
5. **Existing properties stay by default.** Filled category properties, suitability and protocols are not an edit target just because a new assessment differs. Research proposals from buckets 2–4 are not approval to reclassify products, broaden thickness eligibility or require a full reassessment before ordinary verified price/link maintenance.
6. **Identity and formula evidence are separate.** Same article/name/pack and strong barcode/package evidence may support commerce or recognition. They do not prove identical concentrations or historical chemistry. Ingredient-order, fragrance-declaration or GTIN changes alone do not prove a reformulation or performance change.
7. **Distinct replacements need a concrete decision.** Prepare the best purchasable alternative and show its category/formula/use differences. Do not change an old row's link to a different product while retaining its old identity, barcodes and properties. Reuse an existing exact catalog product when appropriate; otherwise research the selected candidate on its own facts through ordinary intake.
8. **Keep material choices explicit.** Prior approval covers the completed exact maintenance and continued research/preparation. It is not blanket approval for new-product publication, replacement activation, formula/version decisions, protocols or suitability changes. Ask only about the concrete unresolved choice; do not restart settled approvals.

The package/variant architecture investigation is separate work in `.worktrees/product-package-architecture`. Do not expand this pricing handover into a schema or scanner redesign.

## Four buckets at a glance

These are research/handling buckets for the **original 27 catalog rows**, not four activation/readiness states. Rows in one bucket can also have a sourcing problem; retain the original bucket labels for continuity.

| Bucket | Original rows | What is unresolved | Proposed resolution |
| --- | ---: | --- | --- |
| 1. No verified acceptable exact purchase offer | 18 rows / 16 physical products | Old URLs, unavailable/store-only packs, missing usable online offers, or identity needing a barcode bridge | Search preferred shops for the exact product at any size; apply verified same-product commerce/recognition only within approval; if unresolved, preserve the row and prepare a distinct alternative for Nick |
| 2. Ingredient-order / fragrance-declaration differences | 3 | Current declarations differ from historical sources, while same-product association may be plausible | Separate commerce/identity from optional protocol or property corrections; source the exact current offer without automatically reclassifying |
| 3. More substantial current declaration / formula-version differences | 3 | Current formula declarations or packs need careful association; existing facts are already populated | Preserve stored facts; resolve whether current evidence belongs to the same marketed product or a distinct version; use completed research as review evidence only |
| 4. Missing/conflicting identity, market or formula evidence | 3 | Conflicting GTIN/market labels or conflicting formulas under the same identifier | Resolve the precise identity/version with primary/package evidence; then choose the preferred-shop offer; make any actual version change an explicit proposal |

## What has actually been applied

The October 3 pass incorrectly paused 16 bucket-1 recommendation flags. **All 16 were restored on October 4.** Two alverde bucket-1 rows were already non-recommended before that mistake and remain so. Restoration was checked across the then-current 371-row catalog and all recognition identifiers; it was not a new promotion/readiness audit.

Across the subsequent correction and bucket-1 sourcing passes:

- **Six commerce rows** received verified maintenance: Glow & Shine; Macadamia conditioner and leave-in; Gliss Aqua Revive; got2b Schutzengel; Herbal Essences Aloe conditioner.
- **Only one price value changed:** Gliss Aqua Revive **€4.75 → €4.50 / 400 ml**. The other five rows already had the verified price; links, package metadata and/or check timestamps were refreshed instead.
- **Three barcodes were added:** Glow & Shine `4070765006483`; Gliss `8410436457873`; Hibiskus `4058172926181`. Existing identifiers were retained.
- **No proposed category/suitability/protocol changes and no distinct candidates were applied or activated.**

The later bucket-1 pass checked all **376** catalog rows and all identifiers: rollback dry run restored the snapshot exactly; apply readback found no changes outside the allowlist and preserved target categories/protocols/flags. The 371 and 376 totals describe different October 4 snapshots, not a freshly queried October 5 catalog or a count of products this task added.

Completed SQL/manifests are **evidence only, not instructions to rerun**. See the [correction receipt](../docs/price-audit-rollouts/2026-10-04-correction/README.md) and [bucket-1 receipt](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/README.md).

## Bucket 1 — exact offers first, alternatives only where needed

### Four commerce rows already resolved

| Ref / existing row ID | Chosen offer at October 4 | Applied / important evidence limits |
| --- | --- | --- |
| B1-01 Glow & Shine mask — `1f3920fe-c91e-4298-a40e-99dccd13ea30` | [dm](https://www.dm.de/p/d/3050111/balea-professional-haarkur-glow-und-shine-laminier-kur), **€2.75 / 200 ml** | Current URL/package/check metadata; added `4070765006483`, retained `4067796166453`. Same DAN/name/pack; declaration differs by added Limonene. No concentration/chronology claim or property edit. |
| B1-02 Macadamia conditioner — `4c3e1a63-4696-406a-be67-f2aacc678b0c` | [Amazon DE](https://www.amazon.de/dp/B0BH7ZW2T4), **€5.95 / 400 ml**, single jar, sold/shipped by Amazon | Exact manufacturer-linked ASIN; commerce refreshed. This is the **3in1 jar**, not the separate 350 ml rinse-out bottle. No duplicate barcode inserted. |
| B1-03 Macadamia leave-in — `a72d630d-547a-465f-9846-3006b38af0a2` | Same Amazon single **400 ml / €5.95** jar | Commerce refreshed. `3600542511612` already belongs to this row; do not duplicate it onto the conditioner row. Manufacturer/Amazon versus dm INCI conflict remains a formula-evidence limit, not a property change. |
| B1-04 Gliss Aqua Revive mask — `7a1d7fe1-3240-4d6d-9c92-96a4bcf46ea9` | [Nutritienda](https://www.nutritienda.com/de/gliss/gliss-aqua-revive-4-in-1-maske-400-ml), **€4.50 / 400 ml** | Preferred shops checked first; Douglas partner offer rejected. Added regional `8410436457873`. Existing/current printed front and corroborated current INCI support the association; archived full legacy INCI is missing. Old Rossmann URL's `4015100813555` was not a registered catalog identifier. |

Do not repeat these writes merely because they appear in this list. First compare fresh live state to the committed receipt.

### Fourteen remaining rows / thirteen physical products

Eleven unique dm candidates were prepared for these fourteen rows. They are **sourced candidates, not approved selections, successors or publish payloads**. The two Aqua Hyaluron rows represent the same legacy physical product in different categories. Some suggestions preserve only broad category/use; strengthen weak matches before asking Nick to select one.

| Ref / existing row ID | Prepared candidate: chosen pack price, barcode, link | What needs resolution |
| --- | --- | --- |
| B1-05 Balea Kopfhaut Sensitive dry shampoo — `41e09958-5a1f-4997-b99b-f8384b7a8c0c` | [Batiste Sensible Kopfhaut, leichter Duft](https://www.dm.de/p/d/3048778/batiste-trockenshampoo-sensible-kopfhaut-leichter-duft), **€3.95 / 200 ml**, `5010724004777` | Old `4066447438789` 200 ml dm cart disabled. Different brand/formula; sensitive-scalp positioning is not an efficacy guarantee. |
| B1-06 Balea Ultimate Volume shampoo — `d01de47e-e360-4b31-9924-e3e5bc31ccdc` | [Balea Hydra Volume](https://www.dm.de/p/d/3126236/balea-professional-shampoo-hydra-volume), **€1.35 / 250 ml**, `4066447990126` | Old `4067796075021`; same brand/volume focus but distinct identity/formula. Review as a replacement, not an alias. |
| B1-07 Hair Biology Revitalize & Soothe shampoo — `a06cfc4d-c4f5-457e-a94e-26559f96f0e9` | [GUHL Kopfhaut Sensitiv](https://www.dm.de/p/d/1446989/guhl-shampoo-kopfhaut-sensitiv), **€3.95 / 250 ml**, `4072600283172` | Old `8006540153963` 250 ml. Scalp-sensitive alternative; does not preserve menopause/thinning positioning. |
| B1-08 Balea Natural Beauty Hibiskus conditioner — `007a0b35-2372-4836-9aa5-fd089cd588d4` | [Balea Beauty Essentials Aloe Vera & Kokosmilch](https://www.dm.de/p/d/3155215/balea-conditioner-feuchtigkeitsspendend-beauty-essentials), **€1.45 / 350 ml**, `4070765053326` | **Recognition-only maintenance already done:** added `4058172926181`, retained `4066447238952`; official dm DE/PL same DAN/name/350 ml/full ordered INCI. Exact Hibiskus purchase remains unavailable. Beauty Essentials is a distinct variant/formula, not an alias/proven successor. Commercial fields unchanged. |
| B1-09 Nivea Volumen & Kraft conditioner — `26985fdd-1b41-46e3-9c9a-94b98f92310a` | [Nivea Power Repair conditioner](https://www.dm.de/p/d/1620990/nivea-conditioner-power-repair), **€2.95 / 200 ml**, `4006000192598` | Old `4005900918031` 200 ml. **Repair differs from volume**; first seek a stronger volume-use match at preferred shops. A Volumen & Kraft shampoo is the wrong category. |
| B1-10 Alterra Intensiv Repair Feuchtigkeit mask — `1568b623-f411-4ed6-a89f-e797bb1b48f5` | [Garnier Aloe Vera Hair Food 3in1](https://www.dm.de/p/d/1676340/garnier-fructis-haarmaske-aloe-vera-hair-food-3in1-trockenes-haar), **€5.95 / 400 ml**, `3600542511049` | Old `4068134014122` is a 20 ml store-only pack with no verified online price. Different brand/formula; natural-cosmetics equivalence not established. An existing Aloe Hair Food mask row may be reusable; see note below. |
| B1-11 Balea Natural Beauty 3in1 Locken mask — `f212a8ff-0a03-404a-aad5-773d5bb6f7c9` | [Balea Intensivpflege 3in1](https://www.dm.de/p/d/1671219/balea-haarmaske-intensivpflege-3in1), **€1.95 / 300 ml**, `4066447982817` | Old `4066447704709`. Repair/Mandel/Vanille positioning differs from curl-focused use; seek the strongest use match before selection. |
| B1-12 Balea Aqua Hyaluron 3in1 mask — `55727898-2a5e-4f01-ace1-bd91521d98ab` | Same **Balea Intensivpflege 3in1, €1.95 / 300 ml**, `4066447982817` | Old `4066447668315` 150 ml. Repair differs from hyaluron/moisture positioning; compare a better moisture-focused candidate before selection. |
| B1-13 Garnier Wahre Schätze Aktivkohle mask — `17c50884-3c17-479a-848a-10447464e086` | [Wahre Schätze 1-Minute Traube](https://www.dm.de/p/d/3115711/wahre-schaetze-haarkur-1-minute-traube), **€4.95 / 340 ml**, `3600542656191` | Old `3600542510271` 340 ml. Different formula/use; current candidate contains amodimethicone. Do not inherit charcoal/scalp or silicone-free properties. |
| B1-14 ISANA 3in1 Milchprotein & Mandel mask — `47795618-40e7-4ef6-8034-0fd8eb747575` | [GLISS 4in1 Total Repair](https://www.dm.de/p/d/1431891/schwarzkopf-gliss-haarmaske-4in1-total-repair), **€5.75 / 400 ml**, `4015100813517` | Old `4305615627441` 250 ml Rossmann PDP explicitly out of assortment. Distinct keratin-repair multi-use mask; no milk-protein/almond or fit equivalence. |
| B1-15 Sante Intense Hydration mask — `869abd97-a499-4f39-97e5-2722773e46ae` | **Exact option:** [Taleoo](https://taleoo.de/sante-intense-hydration-maske-hyaluron-150ml-63237), **€6.64 / 150 ml**, existing `4055297220682`. Distinct fallback: Aloe Hair Food above | Exact order button enabled but says **“In einigen Tagen wieder lieferbar.”** A question to Nick about accepting this restock-delay offer is still unanswered. **Recommendation: retain exact Sante if Nick accepts the delay.** Do not mark in stock/guaranteed dispatch. Brand's 20 ml and 150 ml carts disabled; never attach 20 ml €1.79 to 150 ml. |
| B1-16 alverde 4in1 Repair & Care Wunderkur mask — `e3571e45-1126-4431-bef8-43153ef64c20` | Same **GLISS Total Repair, €5.75 / 400 ml**, `4015100813517` | Old `4067796145861` 200 ml. Conventional versus natural-cosmetics formula is a material difference. Existing recommendation flag was already false; preserve it. |
| B1-17 alverde Hydro Feuchtigkeit mask — `96f4cf13-7a71-4924-b44e-9d5612d55d32` | [Elvital Hydra Hyaluronic](https://www.dm.de/p/d/3122676/l-oreal-paris-elvital-haarmaske-hydra-hyaluronic), **€4.95 / 300 ml**, `3600524245849` | Old `4066447918946` 20 ml. Moisture alternative, not natural-cosmetics equivalent. Existing recommendation flag was already false; preserve it. |
| B1-18 Balea Aqua Hyaluron 3in1 leave-in — `c6e80f39-20ba-401e-b041-6ee7c89a5996` | [Balea Aqua Hyaluron Feuchtigkeitsfiller](https://www.dm.de/p/d/3151631/balea-professional-feuchtigkeitsfiller-aqua-hyaluron), **€2.95 / 50 ml**, `4070765026894` | New leave-in filler differs from the legacy 3in1 mask. Do not inherit old formula/properties; coordinate any replacement decision with B1-12. |

The prepared Aloe Hair Food candidate already has a mask catalog row, `52264c47-f339-49db-9fb2-207d1ad3b470`. Check exact current formula/identity/readiness before reuse; do not create duplicates or assume its historical facts apply to the current “Neue Formel” pack.

**Proposed bucket-1 sequence:**

1. Refresh exact-product searches in the settled shop order, accepting any verified size. Record separately: buyable, backorder, store-only, disabled cart, transport blocked, or no exact match.
2. Resolve a same-product barcode bridge where that is the obstacle. Preserve globally owned identifiers and the single chosen offer.
3. For a genuinely unresolved purchase offer, leave the existing row/properties/flags intact and prepare the strongest distinct candidate. Do not use “pause” as closure.
4. Present Sante's exact restock-delay decision first. Group the remaining candidate choices by material tradeoff; improve weak volume/curl/natural-cosmetics matches before recommending them as settled replacements.
5. After Nick selects a distinct candidate, reuse a verified exact existing row or complete ordinary intake on its own facts. Publication/promotion is a separate explicit handoff; sourcing alone does not authorize either.

## Bucket 2 — declarations differ, separate maintenance from reassessment

| Ref / existing row ID | Current source at October 4 | Result and proposed next action |
| --- | --- | --- |
| B2-01 Balea Oil Repair Intensiv conditioner — `e7cde77e-e9d5-4976-a8ed-830c8a30c62a` | [dm DAN 1703916](https://www.dm.de/p/d/1703916/balea-professional-conditioner-oil-repair-intensiv), **€1.25 / 200 ml**, current `4070765001402`, old `4066447365443`; enabled cart | Same DAN/name/pack supports a possible same-product association; historical canonical formula missing. Keratin position and fragrance declarations differ in comparative sources. **Nothing applied.** Verify/review the identity association and commerce separately from the optional F4 property proposal; differing declarations do not force changing current rich/high-repair/protein/coarse facts. |
| B2-02 got2b Schutzengel heat protectant — `efaff579-e411-41eb-972a-2734a8517356` | [dm DAN 1267310](https://www.dm.de/p/d/1267310/got2b-hitzeschutzspray-schutzengel), **€4.95 / 200 ml**, current `4015100894141`, old `4015100800128`; enabled cart | **Size 200/ml and check timestamps already applied; price/link unchanged.** Current barcode and optional reapplication proposal were **not** applied. Recheck global ownership before proposing the alias. Optional reapplication must not create a mandatory extra routine occurrence. |
| B2-03 Balea 2-Phasen Hitzeschutz — `a0cc0c36-b5ce-4a38-b224-64c666a83809` | [dm DAN 1460813](https://www.dm.de/p/d/1460813/balea-hitzeschutzspray), displayed **€1.95 / 200 ml**, current `4070765016758`, old `4070765073546`; **disabled cart** | MCP `purchasable=true` did not establish actual stock: rendered PDP prevented purchase. Same DAN/name/core directions; declaration chronology uncertain. **Nothing applied.** Resume exact sourcing as in bucket 1; retain existing flags and protocols. No orderable fallback was verified in the bounded search. |

For both heat sprays, keep `maximumClaimedTemperatureC=null` under current **AD-6**. Numeric marketing temperatures remain source evidence; a schema accepting a number does not approve new temperature-threshold semantics. Do not invent contact times, doses or required reapplication from descriptions.

The [bucket-2 proposal](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket2/bucket2-proposal.json) contains earlier instructions to integrate fresh Conditioner classification before a combined proposal. **That is not a new blanket prerequisite or user approval to reclassify:** Nick subsequently clarified that existing populated properties should stay. Use the packet as evidence, separating any optional semantic proposal from commerce maintenance.

## Bucket 3 — substantial declaration/version differences

| Ref / existing row ID | Current source at October 4 | Evidence, existing state and recommended handling |
| --- | --- | --- |
| B3-01 Langhaarmädchen Beautiful Curls shampoo — `1623a993-3ff4-43be-82c1-95a1ee57ec52` | [dm DAN 1678985](https://www.dm.de/p/d/1678985/langhaarmaedchen-shampoo-beautiful-curls), **€4.95 / 300 ml**, `4070765004649`; orderable in recorded research | Historical list has aloe juice powder at position 5; current list has aloe juice at position 2. This alone does not quantify concentration or prove performance change. Existing coarse-only / normal bucket / balanced route / gentle intensity are populated. F1 proposed fine+normal defaults with coarse conditional; core route/bucket/intensity unchanged. **No commerce, property or eligibility proposal applied.** Preserve existing facts; resolve exact version association for pricing without treating the assessor's differing fit as a required edit. |
| B3-02 alverde Glanz conditioner — `79ce764e-7acf-48ba-b0be-c6d977a81cd0` | [dm DAN 1714048](https://www.dm.de/p/d/1714048/alverde-naturkosmetik-conditioner-glanz), displayed **€1.25 / 200 ml**, `4066447919202`; **not purchasable** in recorded research | Protein order/fragrance declaration differs. Historical Romanian URL now shows the new identifier/list; it is not a frozen old-version source. Existing fine-only/lightweight/low-repair/balanced properties are populated. F2 proposed all thicknesses/medium weight/medium repair/balanced plus oils/proteins/humectants, with mapped uncertainty. **Nothing applied.** Source the offer and clarify provenance; don't replace stored fit bands just because new research differs. |
| B3-03 Schaebens Arganöl mask — `3ce9a9da-4d58-4a66-a424-f8818960b5dc` | [dm DAN 3132757](https://www.dm.de/p/d/3132757/schaebens-haarmaske-arganoel-2x7-ml), **€0.95 / 2 × 7 ml**, current `4003573125015`; old `4003573025018` / 20 ml | Current declaration contains materially different conditioners/emollients; current pack is a distinct candidate, not an approved alias. F3 ordinary research proposes ingredient-presence flags/benefits/5-minute directions; weight/concentration/balance/repair/fit remain unsupported. **Nothing applied.** Present the exact version/pack difference for Nick before any association/replacement. Do not invent a Mask engine or transfer old facts. |

### Research already completed — reuse it, do not mistake it for approval

An early named-product comparison was provisional. A fresh assessor subsequently froze anonymous **F1, F2, F3 and F4** formula findings before seeing product names, claims or old labels. Root checked exact-GTIN raw INCI, supplied identity/claims after the blind freeze, and replayed the three applicable canonical adapters. Outputs matched; all **19 frozen artifacts** remained hash-identical. Post-unblind overlays and normalization traces are retained separately.

- **F1:** Beautiful Curls, Shampoo engine + Production Light.
- **F2:** alverde Glanz, Conditioner engine + Production Adapter.
- **F3:** Schaebens, ordinary mask research; no invented mask-engine projections.
- **F4:** bucket-2 Balea Oil Repair, Conditioner engine + Production Adapter. Proposed medium/medium/balanced/all thicknesses differs from current rich/high/protein/coarse; uncertainty remains explicit.

See [exact before/proposed values](../docs/price-audit-rollouts/2026-10-04-correction/classification-review.json), [blind handoff](../docs/price-audit-rollouts/2026-10-04-correction/research/blind/HANDOFF.md) and [exact current formula captures](../docs/price-audit-rollouts/2026-10-04-correction/research/root/fresh-formulas.json). Projection success means a projection can be produced, not that the old facts are wrong or the candidate is promotion-ready.

**Default action:** preserve existing classifications. Only raise a narrow property correction if concrete evidence establishes an actual error that matters; show the exact old/new values and consequence to Nick. Empty ingredient flags in some existing rows can be a separate completeness issue; they do not authorize changing thickness eligibility, weight, balance or repair bands. Do not use new candidate readiness flags to declare existing catalog rows unready.

## Bucket 4 — close the exact identity/version gap

| Ref / existing row ID | Current evidence at October 4 | Result and proposed next action |
| --- | --- | --- |
| B4-01 Herbal Essences Aloe conditioner — `4e9428b9-8cc9-4db2-89b1-cb272aa9a4d6` | [dm DAN 1409620](https://www.dm.de/p/d/1409620/herbal-essences-conditioner-feuchtigkeit-aloe-vera), **€3.95 / 250 ml**, current `8700216210546`, stored `8700216211598` | Printed old-GTIN Hebrew/Arabic pack confirms brand/variant/250 ml; all **21/21 ingredients match the current German list in order**. **Size 250/ml and check timestamps already applied; price/link unchanged.** Current DE barcode is still a proposal. Recheck global ownership and present the additive recognition association, preserving old GTIN. Full Conditioner reclassification is not a prerequisite for this evidence-backed alias. No chronological/concentration equivalence claim. |
| B4-02 Langhaarmädchen Lovely Long shampoo — `e76e0ed4-bd20-40cd-84ae-e93030610d40` | [dm DAN 1559584](https://www.dm.de/p/d/1559584/langhaarmaedchen-shampoo-lovely-long), **€4.95 / 300 ml**, current `4066447864694`, stored `4067796002621` | Current identity/INCI/directions frozen. Old URL redirects and cross-market sources do not prove historical formula continuity; no immutable old formula bridge recovered. **Nothing applied.** Seek exact old/current package or manufacturer provenance. If marketed identity association is established, review commerce separately; if materially distinct, prepare a current-version proposal without overwriting the old identity/facts. Existing stored properties remain. |
| B4-03 Innersense Harmonic Treatment Oil — `7f5207e6-d281-416e-922c-3135dd9a8cc8` | Same `850006575039` / 118 ml has conflicting INCI: [Belladonna €79 / 118 ml](https://www.belladonna-naturkosmetik.de/innersense-harmonic-treatment-oil-118-ml/850006575039) versus [Hagel €63.20 / 118 ml](https://www.hagel-shop.de/innersense-harmonic-treatment-oil-118-ml.html) | Manufacturer/Belladonna full list starts sunflower and includes camellia/tamanu; Hagel lists safflower/evening primrose. Manufacturer and Belladonna descriptions themselves retain conflicting Evening Primrose claims. No current German-stock back-label captured. **Neither offer selected; nothing applied.** Obtain exact stock/batch back-label or version confirmation, then refresh the universal preferred-shop search. Do not pick the cheapest conflicting formula or add an alias based on GTIN alone. |

Innersense details:

- Brand's US/USD 118 ml variant was unavailable; available 29 ml USD evidence was not a German offer. Preferred-host searches had a mix of no exact results and blocked/unusable results, so the specialist lead was provisional, not proof of universal preferred-shop absence.
- Hagel's small listing shows `852415001833`, €29, title 29 ml, but unit-price arithmetic implies 25 ml. Do not infer the package size or formula from that arithmetic. A verified different pack is allowed by Nick's general rule; this particular evidence is unresolved.
- No external request was sent. Seek existing public label/version evidence first. If outreach is needed, prepare a precise draft for Nick; sending it needs explicit authorization.
- Do not turn scalp-before-shampoo wording into a fibre pretreatment protocol, or introduce an oil exception to retailer priority.

See [bucket-4 handback](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket4/HANDBACK.md), [Herbal ordered comparison](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket4/herbal-ordered-inci-comparison.json), [printed old label](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket4/herbal-stored-back-large.jpg) and [current-version input packets](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket4/bucket4-current-research-candidates.json).

Some earlier candidate packets list missing category/protocol payload fields and `catalog_intake_ready=false` / `global_recommendation_ready=false`. Those describe **unfinished hypothetical new-version packages**, not missing properties on every existing product. They do not create a requirement to reassess Herbal before adding a reviewed recognition barcode or to pause any existing row.

## Recommended continuation order and review points

1. **Establish current state:** inspect branch/ownership, current runbook and receipts; get a fresh read-only catalog/identifier snapshot before any production proposal. Compare already-applied rows to the exact receipts. Refresh relevant offers; keep observations distinct from conclusions.
2. **Close low-ambiguity maintenance:** Sante's exact restock-delay choice is the clearest unanswered user decision. Prepare exact current barcode proposals such as Herbal/got2b independently from optional formula/protocol changes. Review current identity/ownership and approval scope for each before writing.
3. **Finish bucket-1 sourcing:** exact-product searches first, then strengthen and group the fourteen remaining replacement choices. Show Nick pack price/link/GTIN and the real functional tradeoff. Eleven sourced dm candidates are not eleven approved replacements. Preserve all existing rows while decisions are pending.
4. **Target bucket-4 conflicts:** Lovely Long provenance and Innersense actual stock/version need focused identity work. Ask Nick only when a concrete consequential alternative remains or evidence cannot be obtained independently.
5. **Keep buckets 2/3 proportionate:** reuse completed captures and blind research. Retain populated classifications; do not turn optional reassessment into the main pricing job. Any supported correction is a separate exact proposal with current authority and explicit decision.
6. **Apply only the reviewed scope:** prepare an exact allowlist/expected-before manifest from fresh live rows; run rollback dry run, inspect result, then use the same guarded transaction for the approved apply. Independently read back all target fields, identifiers and protected category/protocol/flag state, plus outside-scope fingerprints. Retain a concise receipt and clear changed/unchanged/deferred counts.

Research and reversible local preparation can continue autonomously within this scope. A distinct replacement, material identity/version decision, category/eligibility/protocol change, backorder-policy choice, new-product publication or promotion needs the concrete applicable user decision. Do not infer that this handover itself grants production approval. Carry forward prior exact authorization; do not ask again for already settled work.

## Evidence index and operational limits

| Need | Durable source |
| --- | --- |
| Latest bucket-1 inventory, applied values, candidate sources and status | [review-summary.json](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/review-summary.json) |
| Applied bucket-1 allowlist and whole-catalog verification | [maintenance-manifest.json](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/maintenance-manifest.json), [verification.json](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/verification.json), [before.json](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/before.json), [after.json](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/after.json) |
| Exact dm offers/INCI/directions/images for prepared candidates | [dm final offers](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/sources/dm/final-offers.json), [brand findings](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/sources/brands/brands.json), [identity findings](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/sources/identity/identity-offers.json), [Rossmann checks](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/sources/rossmann/exact-checks.json) |
| Byte-preserved raw browser evidence and hashes | [raw-browser-captures.zip](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/sources/raw-browser-captures.zip), [member hashes](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/sources/raw-captures.json), [artifact hashes](../docs/price-audit-rollouts/2026-10-04-bucket1-sourcing/artifact-sha256.json) |
| Restoration of 16 flags and got2b/Herbal maintenance | [correction receipt](../docs/price-audit-rollouts/2026-10-04-correction/README.md), [restore manifest](../docs/price-audit-rollouts/2026-10-04-correction/restore-manifest.json), [commerce manifest](../docs/price-audit-rollouts/2026-10-04-correction/commerce-manifest.json), [verification](../docs/price-audit-rollouts/2026-10-04-correction/verification.json) |
| Bucket-2 findings and optional proposals | [JSON](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket2/bucket2-proposal.json), [brief](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket2/bucket2-proposal.md) |
| Bucket-3/F4 research, uncertainties, frozen inputs and adapter results | [classification review](../docs/price-audit-rollouts/2026-10-04-correction/classification-review.json), [blind handoff](../docs/price-audit-rollouts/2026-10-04-correction/research/blind/HANDOFF.md), [machine handoff](../docs/price-audit-rollouts/2026-10-04-correction/research/blind/HANDOFF.json), [fresh formula sources](../docs/price-audit-rollouts/2026-10-04-correction/research/root/fresh-formulas.json) |
| Bucket-4 identity evidence / candidate inputs | [handback](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket4/HANDBACK.md), [candidate inputs](../docs/price-audit-rollouts/2026-10-04-correction/research/bucket4/bucket4-current-research-candidates.json) |

**Superseded historical material:** [October 3 hold plan](2026-10-03-price-audit-hold-buckets.md), the `2026-10-03-hold-buckets/` receipt, and `2026-10-03-preferred-shop-resolution/remaining-holds.json` retain the original inventory/evidence. Their pause/disposition instructions and stale hold reasons are superseded by Nick's rejection and the October 4 correction. **Do not execute old pause/disposition/apply SQL.** Preserve immutable historical receipts rather than editing them to appear correct.

**Scope exclusions:** no intake-worker/queue retries, timer/service/SSH rollout changes, schema changes, scanner architecture, deployments or secret output. The original server-rollout handover is not an instruction to rerun first apply or timer installation. No external communication, push, PR or merge is authorized by this handover. Meaningful whole-branch review, including the read-only Claude counterpart lane, remains required before a future authorized push; an old reviewer timeout is an unavailable verdict, not approval.

**Next-agent handback:** report each row as verified maintenance applied, exact offer awaiting decision, distinct candidate awaiting selection/intake, identity/version evidence unresolved, or unchanged by design. Separate actual price changes from link/size/check updates and barcode additions. State source check dates, exact remaining questions/recommendations, verification evidence and preserved fields. Do not call research results “applied” when they exist only in local proposal files.
