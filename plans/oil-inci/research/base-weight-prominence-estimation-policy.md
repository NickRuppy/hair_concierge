# Exploratory estimation policy: base, weight and named oils

Historical proposal. Operative first-round rules are in `docs/research/oil-inci/v1.0/02_classification-standard-v0.1.md`; new weight derivations use `03_weight-reference-v0.2.md` and its reference. Earlier proposal heuristics do not override those rules.

Date: **2026-10-01**. Nick authorized **“Use approximate rules, clearly marked as estimates.”** This is a proposed operational interpretation for exploratory research, not new scientific evidence or a calibrated standard. It supplements [the evidence note](base-weight-prominence-evidence.md); that note remains unchanged. No selected products are labelled here.

## Output contract

- Every base, weight and non-absent prominence judgment carries `estimate: true`, confidence `moderate` or `low`, its rule, positive evidence and strongest counterevidence. Exact ingredient identity/rank remain observations. No estimate represents percentage, analytical purity or measured finished-hair performance.
- A resolved exact-match `absent` is a formula-list fact: `estimate: false`, with complete formula and reviewed claim identity. Ambiguous claim identity is `unknown`, not absent. Reviewed positioning without any named oil gives an empty list.
- Missing grades lower confidence when one architecture still wins. Use `unknown` only for missing essential identity/evidence, an unmapped principal carrier, or genuinely competing anchors that these rules cannot separate. Do not force medium/hybrid to conceal that conflict.
- Freeze ingredient roles and blind base/weight before reading hero-oil positioning. The same ingredient has the same group assignment regardless of advertising.

## 1. Assign roles and an auxiliary-context suffix

Use the evidence note's versioned exact-identity families: intact botanical oils, silicone carriers, ester/carbonate emollients, alkane carriers, water, residual-film/structural components, and auxiliaries. Botanical seed oil takes precedence over ester chemistry; plant-derived squalane does not become intact plant oil. A silicone emulsifier does not become a principal carrier merely through its name.

**Auxiliary functions for this heuristic:** fragrance (`Parfum`, `Aroma`, recognized fragrance declarations); preservation (a recognized preservative with that role established); oxidation protection (e.g. tocopherol in a credible stabilizer context); chelation/pH adjustment; colour. Multiple fragrance allergens count as **one function**. A dual-purpose ingredient cannot supply two functions by itself. Context-ambiguous ingredients remain unassigned until reviewed. Colourants may occur in this group but, because of their ordering exemption, **cannot supply either of the two qualifying functions** or establish a boundary by themselves.

Define a **probable auxiliary suffix** only if all of the following hold:

1. At least two different qualifying auxiliary functions occur in the proposed suffix, represented by different ingredients.
2. From its first qualifying auxiliary to the end, every entry is either a recognized auxiliary or an intact botanical oil; no water/solvent carrier, synthetic emollient, bulk silicone, structurant or unresolved ingredient interrupts that interpretation.
3. At least one established carrier appears before the suffix. A wholly aromatic/essential-oil composition does not obtain a fictitious fixed-oil carrier group.

Choose the earliest suffix satisfying all three conditions. These are **deliberately approximate policy criteria**, not a detected 1% line. A single parfum, preservative or tocopherol never creates this suffix. A weak or ambiguous role match means no suffix is established. Preserve original ranks, including colorants; do not renumber to make a result fit.

Botanical oils within or following that suffix are **contextual tail oils**. All other carrier/emollient entries remain available for the backbone and secondary groups below. An ordinary blend with many oils followed only by tocopherol therefore has no tail boundary under this rule.

## 2. Base and carrier groups: apply in order

1. **Water-led:** if water is the first declared carrier and the list supports an aqueous/emulsified matrix, assign `water_based`. For the named-oil step, oils in its dispersed emollient phase are secondary, unless that phase is genuinely unresolved. This does not identify phase continuity or imply light weight. If water is only a later delivery component, continue.
2. **Plant-only:** if every carrier/emollient is an intact botanical oil, assign `pure_plant_oil` for one declared fixed-oil identity or `plant_oil_blend` for two or more, counting contextual tail oils as declared oils too. Only the non-tail oils form the principal group. Recognized auxiliaries, including antioxidants/fragrance, do not alter the *base* class. Here “pure” means one plant-oil carrier base, **not** a literal one-ingredient or 100%-purity claim. A separate synthetic emollient prevents this shortcut.
3. **Other nonaqueous formulas:** inspect the first two non-tail carrier/emollient entries, preserving their actual order. If they belong to one family, that family is provisionally leading. Its initial uninterrupted run of carrier entries is the principal group; later other-family emollients are secondary. If there is only one carrier, its family leads. Apply `silicone_led` or `ester_alkane_led` only for their recognized families.
4. **Mixed initial pair:** when those first two entries belong to different recognized carrier families, estimate `hybrid`; the initial uninterrupted carrier run containing those two families is principal, until an auxiliary, structural modifier or third family interrupts it. Later emollients are secondary. Ester and alkane belong to the same approved combined family, so their mixture alone is not hybrid. This initial-pair rule is an **ordinal approximation of co-backbone architecture**, not proof that their amounts are similar or material. It receives low confidence when the second carrier could plausibly be only a small addition.
5. **Vocabulary gap:** a principal ether, mineral-oil mixture without an agreed mapping, unusual solvent or other unmapped family yields `unknown`. Do not use hybrid to conceal a single unsupported family. A plant-led formula containing a secondary synthetic emollient that fails both plant-only and the mixed-initial-pair rule also yields `unknown`; the approved vocabulary has no general `plant_oil_led` class.
6. **Challenge:** record the strongest rival. Repeated later carrier entries from a competing family lower confidence because first rank does not establish total family mass. Override the ordinal estimate with `unknown` only when a different architecture is comparably supported, or exact technical composition contradicts the proxy. Record that reason explicitly.

“First two” is an openly chosen exploration convention, not a scientific concentration threshold. Retain disagreements about it for calibration; do not silently tune the rule for individual products.

## 3. Weight: ordered approximate anchors

Assess the whole INCI after assigning groups. Record four subjudgments: **vehicle/spreading**, **nonvolatile residual film**, **structure/matrix**, and **counter-signals**. Bottle viscosity and user-specific application amount are not the output.

Apply the first supported anchor, then challenge it against the remaining anchors:

1. **Rich:** the principal/secondary system has a coherent substantial-residue or structured-film pattern: for example, several mutually reinforcing nonvolatile lipid/structurant signals in the early formula; or a single-ingredient formula whose exact sole material has a documented rich/slow-spreading anchor. A lone late wax, castor oil or silicone gum never imposes a rich floor. Strong mobile/volatile co-carriers are counterevidence and can move the estimate to medium.
2. **Light:** the principal group is a documented volatile or mobile/fast-spreading carrier system, and the remaining architecture contains no strong competing residual/structural pattern. An early gum/resin/oil cluster can defeat this anchor even when the first carrier evaporates. A mobile ester/alkane system can qualify without proving evaporation. Water first cannot qualify by itself.
3. **Medium:** a recognizable mobile, nonvolatile emollient/oil system, or a mixed carrier-plus-residual-film system, supports intermediate expected load without either extreme winning. An ordinary fluid botanical-oil blend is an exploratory medium anchor when there is no stronger species/structure evidence; it is not a universal plant-oil rule.
4. **Unknown:** neither a recognizable intermediate architecture nor a winning extreme is supported, or light versus rich remains a genuine unresolved competition. This is different from a known intermediate combination.

**Unknown-grade dimethicone:** never infer its volatility. If the rest of a simple mobile carrier system supports light, or a coherent residual-film system supports medium/rich, emit that estimate at low confidence and name the grade uncertainty. Only abstain when plausible grades would leave genuinely competing anchors after considering the rest of the list. The formula must not become light merely because “silicone” occurs.

**Water-based formulas:** judge the dispersed emollients, conditioning/film components and structural matrix. Sparse recognizable residue without a structuring pattern can support light; a fluid emollient matrix can support medium; a coherent butter/fatty-alcohol/structured-lipid system can support rich. Water rank contributes no automatic weight class.

Moderate confidence requires a coherent anchor and weak counterevidence. Strong but non-decisive competing signals, unknown relevant grades, or reliance on the default fluid-botanical anchor give low confidence. These classes estimate expected load, not measured build-up or hair suitability.

## 4. Named-oil prominence: ordered rule after unblinding

Resolve the exact advertised oil and its accepted INCI aliases first. Extracts, derivatives, essential oils and feedstocks are not interchangeable with the advertised fixed oil.

1. No exact match in a complete, resolved formula: `absent` as a list fact.
2. Match in the frozen principal group: `leading`, estimated architectural prominence.
3. Match in the frozen secondary emollient group: `supporting`, estimated secondary role.
4. Match in the probable auxiliary suffix: `trace`, **estimated late/auxiliary-context prominence only**. Record both auxiliary functions, their ingredient matches, the suffix start and the oil's actual rank. Default confidence is low. Never translate this to actual trace amount, <1%, negligible efficacy or marketing deception.
5. A present match that cannot be assigned confidently to any of those groups: `unknown`, with the competing roles retained. Do not invent a boundary just to avoid it.

Suggested explanation for contextual `trace`: **“Im hinteren INCI-Kontext eingeordnet; die tatsächliche Menge ist daraus nicht ableitbar.”** Do not use “nur in Spuren enthalten”. Later evidence may overturn this estimate without making the identity/rank observation wrong.

## Hypothetical acceptance checks

| Fictional declaration/context | Expected policy behavior |
| --- | --- |
| One intact plant oil, tocopherol | Pure plant-oil **base**; no suffix from one auxiliary function. Hero oil leading. No 100%-purity statement. |
| Silicone carrier A, silicone carrier B, botanical oil, parfum | Silicone-led; botanical oil supporting. One fragrance function cannot manufacture trace. |
| Silicone carrier, ester carrier, botanical oil, parfum | Initial pair gives estimated hybrid; initial uninterrupted carrier run stops at the third family, making the botanical oil supporting. Lower confidence for unknown mass balance. |
| Carrier, parfum, botanical oil, recognized preservative | Two independent auxiliary functions and only allowed suffix entries: contextual trace estimate for the oil; no concentration conclusion. |
| Carrier, parfum, linalool, botanical oil | Only one auxiliary function: no tail rule. Do not infer trace from several fragrance entries. |
| Carrier, parfum, CI colorant, botanical oil | Colour cannot supply the second qualifying function: no tail rule. |
| Carrier, parfum, preservative, unresolved polymer, botanical oil | Unresolved entry invalidates that suffix; investigate or preserve uncertain group assignment. |
| Water, conditioning/structural lipid system, botanical oils, auxiliaries | Water-based; weight judged from matrix. Oils are supporting, unless contextual-tail rule separately applies. |
| Dimethicone with unknown grade and coherent mobile-emollient companions | Grade uncertainty lowers weight confidence; it need not prevent a supported estimate. |

Verification for this proposal is a rule-consistency read and the hypothetical cases above. No executable tests, selected-product calibration, code, database changes or publication were performed. Source claims and limitations are in the linked evidence note; the initial-pair and two-function suffix thresholds are explicitly **policy**, not discoveries from those sources.
