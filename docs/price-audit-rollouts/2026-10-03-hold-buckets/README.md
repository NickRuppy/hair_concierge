# Catalog pricing hold buckets — 2026-10-03

Nick approved the first-bucket proposal: preserve product recognition and owned
use, follow the universal shop order, and pause purchase recommendations without
an acceptable verified exact offer. He requested analogous investigations of the
other buckets through subagents. The canonical rule is recorded in
[Product Intake Research Ops](../../product-intake-research-ops.md#source-and-purchase-url-priority).
The [execution plan](../../../plans/2026-10-03-price-audit-hold-buckets.md) records
scope, original authorization, decision coverage and verification.

## Applied purchase pauses

Bucket 1 contains 18 catalog rows / 16 physical products. **16 previously
recommended rows were paused; two alverde rows were already non-recommended.**
Only `is_chaarlie_recommended` and the normal `updated_at` trigger changed.
All 347 active products remain active. Barcode/identifier state, prices, URLs,
package data, purchase-link status, formulas, protocols, images and lifecycle
state are unchanged. Existing owned-product use remains supported; existing
planned purchase recommendations can degrade to the application's established
unavailable-step behavior. No replacement was silently substituted.

Fresh official dm checks and timestamped fallback searches found no fully
verified acceptable exact offer across this bucket. The Douglas Gliss candidate
remains conditional because of transport/availability limits. Search misses,
blocked sites and store-only offers are **unverified**, not proof of
unavailability or discontinuation. Some apparent alternatives are identity or
formula conflicts (including Hibiskus, Glow & Shine, and Macadamia).

- [Exact pause manifest](approved-pause-manifest.json) names the 16 updates and
  two existing pauses; [restoration data](restoration-data.json) preserves prior
  flags for a separately reviewed recommendation-readiness decision.
- [Source audit](bucket1-offers.json) separates earlier source captures from
  actual new collection times. [Root fresh dm response](root-fresh-dm.json)
  independently rechecked the dm-owned products, including the latest Glow &
  Shine candidate barcode, without claiming old/new formula continuity.
- [Actual dry-run SQL](approved-pause-dry-run.sql) exercised all 16 updates,
  flushed deferred constraints, then rolled back. [Independent verification](dry-run-verification.json)
  proved all 371 product and identifier states were restored.
- [Applied SQL](approved-pause-apply.sql) differs only in the dry-run boolean.
  [Independent post-apply verification](post-apply-verification.json), collected
  at 15:37:51 UTC, confirmed exactly 16 changed products, every protected field,
  every identifier, and all 355 untargeted product rows unchanged.
- General recommendation flags moved from 238 to 222. No new price was verified
  or written in this policy pass; the completed pricing coverage remains 320/347.

## Subagent research returned; decisions remain separate

| Bucket | Scope | Result |
| --- | --- | --- |
| 2: order/fragrance declarations | Balea Oil Repair conditioner, got2b Schutzengel, Balea 2-Phasen heat spray | Separate identity, declaration, current properties, protocols and commerce. Oil Repair's proposed current profile differs materially; got2b has a commerce candidate with supported current heat facts; Balea heat availability conflicts. |
| 3: current formula reassessment | Beautiful Curls, Alverde Glanz, Schaebens Argan mask | Current INCI/packets and provisional adapter outputs captured. Beautiful Curls and Schaebens current offers are buyable; Alverde is not. Schaebens 14 ml needs a distinct candidate, not an old-20 ml barcode merge. |
| 4: missing/conflicting evidence | Lovely Long, Herbal Aloe conditioner, Innersense Harmonic Oil | Lovely Long and Herbal have fresh dm offers but no historical identity/formula bridge. Innersense current manufacturer and retailer ingredients conflict; version/package choice remains held. |

See [bucket 2 evidence](bucket2-formulas.json), [bucket 2 brief](bucket2-formulas.md),
[bucket 3 evidence](bucket3-formulas.json), [bucket 3 brief](bucket3-formulas.md), and
[bucket 4 evidence](bucket4-evidence.json). All nine rows remain unchanged.

Proposed reusable next steps are evidence recovery, exact current-market INCI
freeze, category-contract assessment, comparison of stored facts/protocols, and
an explicit same-product/version/replacement decision before publishing any
change. Missing old evidence does not prove continuity. Different declarations
do not automatically prove reformulation. Bucket 3 assessments are explicitly
provisional because earlier labels were visible before a blind receipt; a
successful adapter projection alone is not intake or recommendation approval.
Projection warnings in bucket 2 and bucket 3 remain visible in their artifacts.

[Remaining decisions](remaining-decisions.json) accounts for all 27 rows in the
18/3/3/3 buckets. Bucket 1 is operationally paused pending offers; buckets 2–4
are ready for policy/product alignment, not formula activation or promotion.

## Verification and review limits

The 30 existing eligibility/application-adapter checks passed, including
non-recommended owned assessment and planned-recommendation degradation.
The full catalog rollback and apply readbacks passed. The main session checked
source scope, both flag consumers, scan identity access, live triggers, exact
SQL scope/locks/fingerprints, and protected-state preservation. No blocking
local findings; structural review omitted because this uses existing eligibility
behavior and changes no architecture or schema.

The required read-only local Claude plan review was attempted with high effort
and a 120-second timeout; it produced no verdict. [Review status](review-status.json)
records that limitation; the timeout is not approval and a counterpart verdict
remains unavailable before any later publication. No push, PR, merge, server,
worker, queue, timer, schema or new-product activation occurred.

Reviewed content fingerprint: `39dd86366d7bc32befb1c85b6c88e266170c75b48928084b7cfc7b9acd0f783b`. The
[sorted content manifest](reviewed-content.sha256) covers the plan, canonical
policy and retained evidence/SQL/readbacks. Receipt and checksum metadata exclude
themselves. [Artifact hashes](artifact-sha256.json) cover the final receipt bundle.
All bundle artifacts and the plan are committed; temporary runner/test/reviewer
outputs remain in `/tmp`. Historical rollout receipts are unchanged.
