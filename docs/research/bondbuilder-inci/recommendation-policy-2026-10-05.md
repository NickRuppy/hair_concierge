# Reviewed Bondbuilder recommendation policy — 2026-10-05

Nick explicitly approved all five reviewed new products as Chaarlie recommendation options, including low-trust OGX and Aveda. This supersedes their availability-only recommendation intent, not historical receipts or frozen research. The original claim-trust grades remain: P04/P05/P08 medium, P06/P07 low; P01–P03 remain high.

2026-10-07 correction: the [Première partner ruling](#première-partner-correction--2026-10-07) supersedes the matching-shampoo blocker recorded below. It does not claim that P08's revised executable packet or live promotion is complete.

## Separate decisions

- Claim trust describes the owner's confidence in the repair claim. It is not a measured effect-strength score or a guarantee.
- A validated registered owner-calibration low-trust product may be a curated research candidate and, once application/fit and normal publication checks pass, a recommended option.
- An unreviewed new submission remains low/owner_default and nonrecommended. A technology match cannot promote it.
- Low classification confidence, identity/formula/source uncertainty and missing safe application instructions are separate holds. None is waived by recommending a low-trust entry point.

The policy implementation removes only the adapter's claim-trust-low exclusion and permits low in the SQL trust enum check, while retaining owner_anchor/owner_calibration and all remaining gates. The additive migration is `20261005183359_bondbuilder_reviewed_low_trust_eligibility.sql`. No product flags change through that migration. Frozen v0.5 docs, pins, original profiles and replay results are unchanged.

## Remaining routine work

| Product                   | Existing producer-backed sequence                                                                                      | Actual remaining work                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P04 Elvital Plus          | Damp hair; five minutes; rinse; shampoo and condition                                                                  | New source-bound protocol/amendment; reviewed generous-amount translation. Missing format/max wear/dilution/cadence must not be invented or all treated as runtime-critical. Exact Plus diameter fit remains unknown.    |
| P05 selected Redken R09   | Damp hair; 5–10 minutes; rinse; shampoo and condition                                                                  | New source-bound protocol/amendment retaining the exact selected formula and market conflicts. Missing numeric dose/cadence is not evidence for a different protocol. Diameter fit remains unknown.                      |
| P06 OGX                   | Exact DE retailer corroborates bedtime overnight leave-in; full producer complement is UK-limited                      | Real unsupported placement/overnight protocol, not just a missing translation. Need source-bound applicable directions and a supported bedtime routine without inventing a wash. Fit remains unknown in stored research. |
| P07 Aveda                 | Dry roots to tips; 5–10 minutes; rinse; shampoo and condition                                                          | New source-bound protocol/amendment; preserve conditional weekly/every-wash cadence. Producer diameter positioning exists in follow-up but is not yet a stored fit amendment.                                            |
| P08 selected Première N01 | Wet lengths; massage; five-minute wait; layer Première shampoo without first rinsing; rinse together; conditioner/mask | Required Première shampoo partner remains required in source-amendment-02. Bind actual companion and layered workflow; add reviewed translation. System diameter positioning is not standalone product fit.              |

Owning evidence: [catalogue follow-up](catalogue-source-followup-2026-10-05.md), frozen `source-amendment-02/lane-b/P04–P08.json`, and existing `protocol-projection.ts`. These are not applied promotion payloads. Null ancillary facts remain null; a critical hold cannot be silently erased. A source-bound amendment can adjudicate unnecessary generic holds while preserving unknown research facts and provenance.

## Hair-diameter ruling — 2026-10-06

Nick explicitly settled this: all in-scope Bondbuilders are suitable for fine, normal and coarse hair. Hair diameter is not a distinguishing recommendation dimension for this category. This applies to future in-scope products too; it is not a five-product exception or a producer-evidence claim.

The recommendation layer uses `['fine', 'normal', 'coarse']` as category-policy eligibility for reviewed promotion. Research `fit` values, unknowns, holds and original hashes remain unchanged. The research adapter and staged-admission lanes still do not invent eligibility or promote a new submission. Owner-default remains nonrecommended until owner review. No new method freeze or research run is required for this separate recommendation policy.

Implementation: a separate lineage-guarded migration removes the diameter-specific research-fit/fit-hold gates from reviewed publication and requires the canonical full three-diameter catalog set. Application/market/source, owner approval, identity and protocol guards remain. Bondbuilder Stage-3 authority no longer needs the user's diameter or a producer-verified diameter fact and explains the pass as category suitability, not verified product research. Other categories and known-reaction safeguards are unchanged. No product row changes through this migration.

The existing Stage-3 journey is unchanged: a reviewed, active Bondbuilder with the required relationship and verified application can be selected or recommended regardless of diameter. Missing application remains unknown; known reactions still mismatch; unreviewed submissions do not enter the recommendation candidate list. No new surface, layout or ranking is introduced. The exact ruling authorizes this correction without another diameter interview.

Execution and validation: [promotion plan](../../../plans/bondbuilder-recommendation-promotion/plan.md). No live promotion has occurred from this policy supplement.

## Reviewed application overlays — 2026-10-06

The separate create-only [promotion package](../../../data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-06/) retains complete admission baselines and new P04/P05/P06/P07 profiles with exact V1/V2 application payloads. It does not overwrite historical profiles, blind runs, method pins or research fit unknowns. Non-critical unknown dose/format/dilution/max-wear/cadence values remain unknown; only their unnecessary generic execution holds are adjudicated. Critical facts still fail closed. Conditional cadence is retained in research, not flattened into a guessed schedule.

OGX uses the existing Bond-Repair-Tag with `bedtime_leave_in` / `overnight_leave_in_treatment`: a small amount in hands, damp or dry hair, ends upward, overnight, no rinse. There is no extra wash, finite wait or invented German-market frequency. The exact [DE retailer directions](https://www.boozt.com/de/de/ogx/bond-repair-sealing-serum-50-ml_32962840/231199512) are separately source-bound; UK-only cadence remains outside the selected DE direction set. Stored DE/EU identity binding does not assert EU-wide direction equivalence.

The finite promotion migration uses complete pre/post readbacks, exact source-bound payloads, policy lineage, normal publication guards and replay evidence. Elvital/Redken/Aveda preserve their pre-shampoo wait/rinse/shampoo/conditioner sequences. Première stays blocked until the actual required Bain shampoo is present and bound by exact catalog ID. The package and implementation are not evidence of live activation; that requires the separate apply/readback receipt.

## Première partner correction — 2026-10-07

Nick explicitly clarified that Première works without the matching shampoo. The freshly checked [German producer FAQ and directions](https://www.kerastase.de/produktlinien/produktlinien/premiere/concentre-decalcifiant-ultra-reparateur/KER_00277.html) describe the branded shampoo as a recommendation for maximum effectiveness. They specify a five-minute wait and shampoo layered over the treatment before rinsing. The earlier interpretation as an exclusive mandatory catalog companion was too strict.

Chosen recommendation semantics: matching Première shampoo `recommended`, `exclusivity_established: false`, no mandatory `requiredCompanionProductId`. Retain the producer's branded recommendation and tested-system limitations; do not claim identical efficacy with every other shampoo. Normal shampooing and the layered wait/rinse/conditioning sequence remain, so “without the matching shampoo” does not mean “without any shampoo”. Medium trust is unchanged.

The separate create-only [P08 package](../../../data/research/bondbuilder-inci/v1.0/recommendation-promotion-2026-10-07-premiere/) implements this correction with its original sealed baseline, narrowly scoped manufacturer FAQ observation, complete amended profile and exact V1/V2 protocols. Selected N01 wet-length state, formula, medium trust and unknown dose/frequency remain unchanged. Required companions for other products still block. The compiler places this layered treatment's aftercare after the shampoo's joint rinse. No new shampoo admission or mandatory purchase is needed.

Its finite publication migration is `20261007080123_bondbuilder_reviewed_promotion_p08.sql`; the shared offline generator's `--premiere` mode reproduces it, while the original four-product SQL stays byte-identical. Normal publication, complete bundle CAS and replay/audit guards apply independently to both batches. Implemented packets are not proof of live activation: deployment and guarded apply/readback remain separate gates in the promotion plan.
