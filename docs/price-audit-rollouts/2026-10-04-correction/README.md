# Pricing correction and continued bucket research — 2026-10-04

The 2026-10-03 pass mistakenly treated the first-bucket go-ahead as approval to
pause purchase recommendations. Nick rejected that decision on 2026-10-04.
The purchase-pause rule is superseded. Missing or unverified offers remain
sourcing issues and do not authorize changing existing recommendation status.
The canonical rule is in [Product Intake Research Ops](../../product-intake-research-ops.md#source-and-purchase-url-priority).

## Restored state

All **16** recommendation flags changed by this task were restored to their
previous true values. The two bucket1 products already non-recommended before
the pass were not changed. Actual rollback dry run and independent full-catalog
readbacks checked all **371** products and all recognition identifiers.
The restoration changed only those16 flags and the normal update timestamps.
There was no readiness re-audit or new promotion: this corrects the previous pass.

- [Exact restoration manifest](restore-manifest.json)
- [Dry-run SQL](restore-dry-run.sql), [apply SQL](restore-apply.sql)
- [Dry-run verification](dry-run-verification.json), [restoration verification](restore-verification.json)
- [Before](before-restore.json) and [after](after-restore.json) target snapshots plus whole-catalog fingerprints

The earlier 2026-10-03 receipt remains historical and immutable. Its claim of
approval for pausing was an incorrect interpretation. Its source hashes bind to
commit `bd14edc9`, not the superseding current runbook/plan.

## Existing-product commerce maintenance

Nick's existing authorization to resolve prices/links and his approval of the
other bucket approaches cover verified existing-product commerce maintenance.
Two dm offer records were refreshed:

| Existing product | Verified chosen offer | Actual changes |
| --- | --- | --- |
| got2b Schutzengel | 200ml, €4.95, dm DAN1267310, currentGTIN4015100894141 | Size200/ml and check timestamps; price/link already correct |
| Herbal Essences Aloe conditioner | 250ml, €3.95, dm DAN1409620, currentGTIN8700216210546 | Size250/ml and check timestamps; price/link already correct |

All identifiers, recommendation flags, images, category facts, protocols and
lifecycle fields were preserved. Price values did not change. Source evidence,
exact expected-before guards, deferred-constraint checks and unchanged supporting
category/protocol snapshots were included in the SQL. The apply command differs
from its tested rollback dry run only in the dry-run boolean.

- [Commerce manifest](commerce-manifest.json), [dry-run SQL](commerce-dry-run.sql), [apply SQL](commerce-apply.sql)
- [Dry-run proof](commerce-dry-run-verification.json), [post-apply proof](commerce-verification.json)
- [Before](before-commerce.json) and [after](after-commerce.json) target snapshots plus whole-catalog fingerprints

## Other bucket approaches completed as research

All three delegated reviews finished. The universal shop order remains
dm > Rossmann > Müller > brand-direct > Amazon DE, then reputable specialists.

**Bucket2:** fresh primary commerce, category and protocol evidence; separate
commerce-only maintenance from optional protocol/identifier proposals.
got2b's optional reapplication proposal is not applied. Degrees stay evidence-only:
the draft was corrected to retain maximumClaimedTemperatureC=null under AD-6.
Balea2-Phasen's exact dm cart is disabled; no verified orderable fallback.
Its pre-existing recommendation status remains unchanged.
[Full proposal](research/bucket2/bucket2-proposal.json) and
[brief](research/bucket2/bucket2-proposal.md).

**Bucket3 and bucket2 Conditioner:** a new assessor froze anonymous formula
properties before seeing names, claims or old catalog labels. Root freshly
rechecked all four exact-GTIN raw INCI strings, then provided post-blind identity
and claims. New overlays record allowed post-unblind adjustments and source
normalization; all19 frozen files remain hash-identical.
Root replayed all three canonical adapters and matched the agent's outputs.

| Product | Stored facts | Proposed current-formula facts |
| --- | --- | --- |
| BeautifulCurls shampoo | Coarse-only; normal/balanced/gentle | Default eligibility fine+normal; normal/balanced/gentle preserved; coarse remains conditional in full research |
| alverdeGlanz conditioner | Light/low repair; fine-only; balanced | Medium/medium; all thicknesses; balanced; oils/proteins/humectants |
| BaleaOilRepair conditioner | Rich/high repair; coarse-only; protein | Medium/medium; all thicknesses; balanced; oils/proteins/humectants |

These are review proposals, not applied category/eligibility changes.
Conditioner mapped uncertainties remain explicit despite projection success.
Current Schaebens2x7ml candidate has ordinary research for presence flags,
benefits and5-minute protocol; unsupported concentration/weight/balance/repair/fit
bands remain unresolved. No Mask engine was invented.
[Exact before/proposed values](classification-review.json),
[blind handoff](research/blind/HANDOFF.md), [machine-readable handoff](research/blind/HANDOFF.json).

**Bucket4:** exact Herbal stored-GTIN printed package plus current dm DE list
match21/21 ingredients in order, brand, variant and250ml. This resolves the
declaration-level association without claiming chronological succession or
identical concentrations. Current DE barcode addition remains a separate review
proposal; existing identifiers were preserved during commerce maintenance.
LovelyLong current dm identity/INCI/directions are frozen for separate
current-version research; old formula continuity remains unresolved.
Innersense manufacturer/retailer INCI and ingredient claims conflict even for
118ml/the same barcode; exact DE back-label or version confirmation is needed.
[Identity handback](research/bucket4/HANDBACK.md),
[Herbal comparison](research/bucket4/herbal-ordered-inci-comparison.json),
[printed label](research/bucket4/herbal-stored-back-large.jpg),
[current-version candidates](research/bucket4/bucket4-current-research-candidates.json).

Proposed new/current-version research packages are not catalog-intake ready or
global-recommendation ready. This does not label existing catalog rows unready or
authorize deactivation. All material property, protocol, identifier or version
changes remain explicit proposals for Nick's exact review.

## Verification and scope limits

Final catalog: **371 total,347 active,238 recommendation flags true**.
Restoration and commerce rollback/apply comparisons passed across the complete
catalog. No identifiers changed. Root's three adapter replays matched; all blind
hash checks passed. No behavior code or schema changed; local commit runs typecheck.
[Verification summary](verification.json).

No new products, category properties, protocols, identifiers, images,
recommendation pauses, workers, queues, server/timer settings, schema,
deployments, pushes, PRs or merges changed in the continued research.
No external message was sent. The earlier Claude timeout remains an unavailable
verdict; this exact correction is routine and does not claim counterpart approval.
A meaningful whole-branch review remains required before any later push.

