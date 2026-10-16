# Round 1 ingredient seed — lookup contract

Prepared 2026-10-01, version `oil-round-1-seed-0.1.0-draft`. Product-blind source work: no cohort capture, named product labels or classification records were consulted. This is a capture seed for parent review/freeze, not a frozen standard, complete regulatory inventory or engine implementation. The mechanism proposal was read only as the controlling method, not as source evidence for ingredient facts.

## Matching

Preserve the complete raw declaration and one-based ingredient ranks. Normalize only Unicode, case and redundant whitespace; use whole-token canonical names and the enumerated aliases. Do not remove plant parts, parentheses indiscriminately, oil/extract/water distinctions, hydrogenation, PEG/PPG numbers, slashes, stereochemistry or nano declarations. Do not split a slash polymer name. Bilingual wrappers are finite accepted aliases, not a general rule for stripping text. Separate ingredients only at documented declaration separators.

`admitted` means the stated identity/function evidence is adequate for this seed, within each row's limitations. It does not admit every source's marketing claim or every penetration candidate into the positive-anchor set. `pending` and novel forms require source review. An unknown token cannot become five false flags or be erased as a negligible tail ingredient. The parent must audit every encountered token and decision-relevant role before freezing.

No dictionary rank cutoff, inferred percentage, fragrance boundary, volatility-by-origin or finished-product label is encoded. Roles describe ingredient evidence; the separately approved mechanism governs estimated base, weight, penetration, residue and prominence. The `possible_*` roles explicitly need formula/grade context.

## Five independent flags

Complete records emit `silicones`, `mineral_oil`, `drying_alcohol`, `fragrance`, and `scalp_active_botanicals`. Each positive retains the exact raw match/rank. A negative means no recognized declared match after complete relevant identity review, never analytically absent or safe for a user. An omitted flag on an admitted row means that row does not establish that membership; unresolved forms remain review metadata.

- Silicone recognition is exact; Silica is a particulate, not a silicone-polymer alias. Polysilicone-15 independently establishes silicone and filter recognition.
- Mineral oil is the agreed liquid-mineral-oil identity, not every petroleum-derived hydrocarbon. Squalane, Isododecane, Isohexadecane and C13-15 Alkane do not match it.
- Solvent-alcohol recognition excludes fatty alcohols, glycols, Phenoxyethanol and Benzyl Alcohol. SD variants map to the denatured-ethanol flag class without equating their denaturants.
- Fragrance means declared fragrance/aromatic/allergen exposure, regardless of intent. Benzyl Alcohol may therefore be fragrance-positive during preservative use. It is not synonymous with intentionally perfumed. This is a narrow seed, not an exhaustive Annex III extraction.
- The scalp grouping is the agreed closed watch-out set: specified rosemary/mint/tea-tree/eucalyptus oils and isolated Menthol/Camphor. Botanical extracts, every aromatic plant and Lavender are not silently added. No growth, treatment, tolerability or application permission follows.

`Lavandula Oil/Extract` is an official group declaration and already supports fragrance=true. Oil versus extract remains unresolved for preparation-sensitive roles. Per the parent's closed scalp-group scope, this token alone neither adds a scalp match nor blocks an otherwise reviewed scalp-negative result. It is not a false fragrance result.

## Material and evidence boundaries

Dicaprylyl Ether is explicitly an ether emollient/unmapped carrier, not an ester. Its functional role is supported by BASF; deciding whether to expand the base-family vocabulary belongs to the parent. Jojoba remains an intact botanical oil despite wax-ester chemistry. Squalane is not its botanical feedstock oil. Modified triglycerides, hydrogenated oils and coconut-derived esters do not inherit whole-coconut penetration evidence.

`penetration_evidence` describes the bounded evidence review: `direct` is chemical/spatial evidence, `indirect` is surface/endpoint evidence, `none` means no admitted evidence in this review, and `not_assessed` means this seed did not assess it. Neither last value means nonpenetration. The initially admitted positive policy anchors are exact whole coconut, Camellia oleifera seed and safflower seed oils. Direct Raman reports for avocado/argan remain outside that initial admission pending full-method review. The primary oil experiments used laboratory exposures; ingredient presence cannot establish concentration, routine delivery, whole-formula penetration or benefit. Pure mineral oil has affirmative surface-film evidence, not proof of zero entry.

Source raw-material grade claims do not identify the grade in a retail formula. Dimethicone viscosity/volatility, Acrylates Copolymer film behavior, gum loading and removal remain context-dependent. Polyquaternium-10 is a conditioning/deposition signal, not a universal build-up cancellation.

`uv_filter` is optical-filter/function recognition from exact identities, not product compliance or hair efficacy. Ethylhexyl Salicylate is separately anchored to Annex VI/20, CAS 118-60-5. Final hair UV is still filter recognition AND an accepted exact-product manufacturer hair-UV claim. Benzyl Salicylate, Tocopherol and arbitrary benzophenones do not inherit filter membership.

## Remaining source gaps and handoff

1. `Cocos Nucifera Fruit Oil` and `(Coconut) Fruit Oil` are not universal aliases in this seed. The Twin Rivers producer SDS lists the latter among several preparations sharing a CAS, including extract/juice/butter. This supports occurrence of the name but cannot make all those preparations equivalent. The parent may resolve the exact oil form with a primary exact-name source or retain a per-record material mapping supported by authoritative INCI plus explicit unmodified whole-oil manufacture. Generic CAS ambiguity alone is not a reason to reject positive exact-form evidence.
2. Current 2025 glossary retrieval was challenged. Historical Commission inventory entries are used only for stable identity/function facts, never current authorization. Supplier and SCCS exact modern names replace historical rows where nomenclature changed. Some supplier/publisher sources were accessible as indexed primary text rather than full downloads; archived source bytes/row receipts remain a parent freeze task.
3. No comprehensive UV or fragrance-list claim is made. Any new filter, allergen, ester, polymer, botanical preparation or alias needs exact-source review before automated negatives. Generic Perfume, taxonomic Salvia rosemary forms, unlabeled mint species and spelling repairs are not auto-admitted.
4. No cohort coverage assertion is possible from this blind assignment. The parent owns the encountered-token audit, conditional form resolution, source snapshot retention, mechanism integration and final hash freeze.

Verification for this slice: JSON parse and schema/enum checks, canonical/alias uniqueness, all positive filter identities source-backed, all flags in the five-key vocabulary, guard review for ether/ester, oil/extract, feedstock/oil, silicone/silica, solvent/fatty alcohol and initial penetration-anchor boundaries. No application code, database writes or product labels were created.
