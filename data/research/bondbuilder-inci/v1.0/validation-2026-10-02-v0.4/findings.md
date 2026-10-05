# Bondbuilder new-submission validation — four-product result

Date: 2026-10-02. **Completed bounded v0.4 applicability test, with a corrected source-preparation omission. Not method-locked, intake-active or database-applied.**

Both fresh lanes agreed on all four formula candidate sets and all four final category/family/policy outcomes. The one qualifying new product receives low / owner_default and false recommendation by the approved policy; low is not an empirical weak-evidence verdict. This tests repeatable extraction and category/policy handling, not scientific efficacy or discovery of new high/medium grades.

| New test product | Result under agreed rules | Trust / recommended simulation | What the test caught |
| --- | --- | --- | --- |
| [Curlsmith Bond Curl Rehab Salve 237 ml](https://eu.curlsmith.com/products/bond-curl-rehab-salve) | In scope, gluconamide/gluconate | Low / false | Specific pair + targeted role; preserve conditional 15/20/30 minutes and 4–5/3–4/2–3 washes; current medium 20 beats differing editorial 30. |
| [Balea Professional Keratin Repair 300 ml](https://www.dm.de/p/d/1688653/balea-professional-haarkur-keratin-repair) | Outside Bondbuilder scope | Not applicable / false | Generic keratin/protein/Pro-Strength label does not qualify; no invented post-shampoo placement. |
| [Garnier Pro-Keratin Filler Haarkur 200 ml](https://www.garnier.de/haarpflege/haarpflege-marken/fructis/schaden-loescher/pro-keratin-filler) | Outside Bondbuilder scope | Not applicable / false | Citric Acid + Glycine alone is not acid/calcium-treatment proof; before **or** after shampoo preserved; cadence unknown. |
| [L'Oréal Professionnel Molecular Rinse-Off Serum](https://www.lorealprofessionnel.de/alle-produkte/haarpflege/absolut-repair-molecular-serum) | Technology/category review | Held / false | Unmapped peptide-bonder claim is not sh-Oligopeptide-78; work-in time is distinct from extra dwell; system evidence stays system-bound. |

“Outside scope” does not mean ordinary conditioning cannot work. The unfamiliar technology row needs category review, not an automatic fifth/sixth technology or a new trust promotion. Source-version identities are resolved; none is a scanned pack. The four test rows are not newly approved enrichment targets.

## Facts, discrepancies and correction

The two lanes initially satisfied 17/18 preregistered protocol checks each. Root audit found one source-preparation omission: the original S05 observation compressed out the maker's explicit aftercare order. Both lanes appropriately left it unknown rather than inventing it. Original packets and outputs remain sealed. A [separate frozen source amendment](source-amendment-01.json) restores the same inspected page's order: rinse serum, optional Metal DX mask, then recommended matching leave-in. Two bounded independent supplemental extractions agreed; corrected checklist coverage is 18/18 for each lane. Mask dose/dwell/rinse instructions remain unknown. This is a corrective source replay, not an extra unseen product or method-only experiment.

Other differences are retained in [adjudication.json](adjudication.json): no-extra-wait numeric representation (0/0 vs null/null), protocol/exclusion-confidence scope and prose/step partitioning. They did not change category, trust, numerical working time, selected dwell branches or cadence. Root's proposed canonical no_wait value keeps contact bounds null and work-in bounds 1/2; confidence for an excluded final family is null, with high confidence in the marker/exclusion findings kept separately. These are research adjudications, not a demonstrated production adapter. Do not describe the original records as byte-equivalent or every property as raw-schema identical.

Each lane's overall confidence: three moderate, one low. Twelve diameter-fit values per lane stay null; two cadences and three physical textures remain unstated. No arbitrary weekly schedule, pump-to-ml conversion, cream texture, all-diameter fit or scientific adverse rationale was fabricated. Historical creator reports, supplier statements and system studies retain version/commercial/attribution limits. No inspected exact original Abbey Yung/Tom Hannemann/Dejan Garz take is claimed in this bounded search.

## Verification and limits

Frozen [inputs/method receipt](freeze-receipt.json), [Stage A seal](stage-a-seal.json), [Stage B seal](stage-b-seal.json), [amendment input receipt](source-amendment-01-freeze.json), [amendment seal](source-amendment-01-seal.json) and final seal preserve the original history. Root read both results, checked factual conclusions against selected producer sources and reconciled discrepancies. The run-local verifier checks strict record keys/bounds, actual read/file hashes, sources, named-stage default policy and the hidden preregistration oracle. Supplement shape/read/source checks are separate; final hash closure covers them. Running complete mode before adjudication correctly refused the absent adjudication; it was not reported as a completed pass.

```sh
node data/research/bondbuilder-inci/v1.0/validation-2026-10-02-v0.4/verify.mjs --complete
node plans/bondbuilder-research-engine/verify-review-draft.mjs
node data/research/bondbuilder-inci/v1.0/replay-2026-09-30-v0.3/verify.mjs --complete
git diff --check
```

This is **one of five positive technology families**, two ordinary repair controls and one unfamiliar-technology boundary. Other positive families, incomplete/conflicting INCI, overnight/layering and legacy-transfer fixtures are not covered here. Calibration is not relabeled as holdout. Full engine validation, method lock, catalog/pack reconciliation, strict adapter/runtime protocol compatibility, database integration and activation remain open. No runtime tests, migration, Supabase, intake publish, browser or production CI ran.

Nick's latest decision places **all eight original pilot products** in enrichment scope, with all grades preserved, including low OGX/Aveda. Enrichment intent does not promote recommendation flags. Next dependent work is the exact additive database/adapter/intake compatibility proposal and guarded product packages—not another trust interview or an automatic apply. The existing [integration handoff](../../../../../plans/bondbuilder-research-engine/validation-integration-handoff-2026-10-01.md) owns those seams; its concrete schema and execution safety remain separate approval gates.

