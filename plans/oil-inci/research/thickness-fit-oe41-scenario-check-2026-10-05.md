# OE41 — light/coarse conditional fit and scenario check

Nick asked to make light oils conditional for coarse hair because they may fit less well than medium/richer oils, and explicitly approved the next step of checking concrete leave-on and pre-wash examples. The adopted cell preference is **light retained-fibre oil + coarse hair = conditional**. It remains an option for a desired lighter finish. This is a practical preference estimate, not evidence that light oil fails to condition coarse hair.

OE40's rich/fine conditional decision remains. The revised [candidate table](../../../docs/research/oil-inci/v1.0/05_thickness-fit-proposal-v0.1.md) considers two kinds of caveat: excessive load and a finish that may be less substantial than wanted. It supersedes the original proposal's light/coarse suitable cell for this new candidate check. Other matrix cells and full scenario rules await final review; the check authorization is not sensory validation or permission to activate production recommendations.

## Completed check

Inputs: the frozen round-6 v0.1.1 working records, separate weight carry-in, and the candidate fit proposal. Exact input hashes are in the [new scenario overlay](../../../data/research/oil-inci/v1.0/corpus/exploratory/thickness-fit-scenario-check-v0.1/candidate-scenario-overlay.json). [Readable CSV](../../../data/research/oil-inci/v1.0/corpus/exploratory/thickness-fit-scenario-check-v0.1/candidate-scenario-sheet.csv).

Six exact products supplied 11 source scenarios, split into 15 role/scenario combinations and 45 thickness cells. Candidate output: 25 suitable, 11 conditional, 9 unknown. All nine unknowns belong to scalp-role thickness assessments. These counts demonstrate execution of the proposed map, not classification accuracy or actual hair performance.

| Example | Candidate retained-use result | Candidate pre-wash/scalp distinction |
| --- | --- | --- |
| Evolve, accepted light/low estimate | Fine/normal suitable; coarse conditional for a possibly less substantial finish. Source establishes 3–4 drops on clean wet/dry mid-lengths/ends. | No pre-wash/scalp role is invented. |
| Biopark coconut, prior-trial rich/low estimate | Retained ends: fine/normal conditional for greater load; coarse suitable. | Its explicit fibre pre-wash followed by shampoo has no weight-only thickness exclusion. A separate scalp role has unknown fibre-thickness fit. |
| Kerastase Elixir Ultime, prior-trial medium/low estimate | Fine conditional; normal/coarse suitable. Exact retained directions and source restrictions remain attached. | Separate explicit fibre pre-wash has no weight-only thickness exclusion; no scalp permission. |
| NEQI Rosemary, accepted medium/low estimate | No retained-fibre verdict: the current source establishes scalp application only. | Scalp-role thickness remains unknown even though the treatment is followed by shampoo. |
| Kerastase Soleil Huile Sirene, prior-trial medium/low estimate | Fine conditional; normal/coarse suitable. Keep the supplied shake instruction; dose remains unestablished. | No pre-wash role is invented. |
| Aroma-Zone seven-oil blend, prior-trial rich/low estimate | Retained dry-end dab: fine/normal conditional; coarse suitable. | Explicit fibre pre-wash with shampoo has no weight-only exclusion. Keep that scenario's 1–3 tablespoons and contact time separate from the retained dab. Scalp-role thickness is unknown. |

## Sensitivity and limits

Thirteen of the 45 candidate cells change if their carried weight is replaced with its existing nearest alternative. Evolve's light-to-medium alternative, for example, moves fine from suitable to conditional and coarse from conditional to suitable. The input weights remain low-confidence; two are human-accepted estimates and four are prior-trial working estimates. No prior estimate was upgraded to human acceptance.

This sensitivity is not a reason to tune formula weights to obtain preferred fit. Retain the main estimate and its alternative visibly. Unknown build-up does not become low, and is not converted into a fit penalty. Curl and damage remain undefined. An explicitly supported pre-wash use is assessed separately, without claiming complete shampoo removal or clinical efficacy.

## Verification and artifact disposition

The local derivation checked scenario/role counts, conditional explanations, scalp unknowns, explicit pre-wash removal, unchanged source hashes and unchanged canonical unknown fit values. New outputs are marked `candidate_pending_final_signoff` and carry weight authority, exact direction IDs and alternative-weight sensitivity. Existing direct-property data, labels, fit records, trials, seals, verifier and completion receipt were not rewritten. Current README/decision guidance is updated to index OE41 and its separate candidate policy; OE39's receipt remains historical rather than certifying later guide revisions.

The final historical-preservation check caught the orchestrator's OE40/OE41 edits to the original property proposal, which belongs to the frozen 219-file history. Those edits were removed and the exact original content hash was verified before writing it back. The accepted decisions remain in their separate notes and current index; the new guidance lives in proposal v0.1. All 219 historical files are now unchanged, and the round-6 structural verifier passes. No historical hashes were updated to hide the temporary edit.

Recommendation after this example check: finalize the revised thickness matrix and scenario conditions, then define curl and damage fit separately. No oil ingredient, product-weight rule or production adapter is changed by this check.
