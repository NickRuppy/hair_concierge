# Resolve catalog pricing holds by handling bucket

## Superseding correction — 2026-10-04

Nick rejected the bucket 1 purchase-pause decision. The earlier interpretation
of approval below was mistaken and no longer governs execution. All 16 flags
changed by the 2026-10-03 pass have been restored to their previous true values;
the two previously non-recommended rows were not changed. A rollback dry run
and independent comparisons across all 371 products verified the correction.
Missing or unverified offers remain sourcing issues and do not change existing
recommendation status. The canonical intake runbook now records that rule.

Nick approved proceeding with the other bucket approaches: independently assess
current declaration/property facts (bucket 2), complete fresh blind formula
research (bucket 3), and recover exact-market/version evidence or prepare
separate current-version candidates (bucket 4). Final changes to identity,
formula properties, eligibility, or new-product activation require an exact
reviewable proposal; do not treat a source search failure as a pause decision.

See the new correction receipt under
`docs/price-audit-rollouts/2026-10-04-correction/`. The 2026-10-03 evidence is
historical and remains immutable; its fingerprints bind to commit bd14edc9.

## Outcome and scope

Resolve or safely pause the 27 remaining active catalog rows in
`docs/price-audit-rollouts/2026-10-03-preferred-shop-resolution/remaining-holds.json`.
Nick approved the proposed first-bucket rule and explicitly requested subagent
investigation of the other buckets. Keep recognition and owned-product use while
pausing purchase recommendations without a verified acceptable exact offer.

Use `docs/product-intake-research-ops.md` for identity, commercial, and final
handoff authority. The universal purchase order is dm > Rossmann > Müller >
brand-direct > Amazon DE, then reputable specialists. One chosen offer must have
one matching package size and whole-package price. A different formula is a
separate product decision, even when its name or barcode resembles an old item.

No schema, UI, research-worker, queue, server, timer, ingredient/property,
protocol, image, lifecycle, product deletion, or existing identifier changes.
New formula activation, replacement intake, and barcode merging stay review-only.
No push, PR, merge, or deployment is authorized by this bucket pass.

## Handling rules and decision coverage

- **Confirmed with Nick:** preferred shops for every category; size/price are
  secondary; retain recognition, pause purchase recommendations when no exact
  purchasable offer is verified; distinct replacements need individual review;
  launch subagents for the other buckets.
- **Inherited from contracts:** blocked searches are unverified, not absence;
  identity evidence is separate from purchase preference; current property
  assessments use the owning category contract; research readiness does not
  authorize formula activation or global promotion.
- **Implementation defaults:** reuse this owned pricing worktree; subagents own
  separate `/tmp/chaarlie-buckets/` evidence files and have no catalog write
  authority; root verifies sources, SQL, and complete readbacks.
- **Open consequential assumptions:** none for the approved purchase pause;
  product/formula identity and property changes in buckets 2–4 require an exact
  evidence-backed proposal and Nick's decision before that dependent write.
- **Coverage acknowledgement:** Nick: “ok lets do bucert 1/4 in rhe way you
  propose”; “Think of similar steps to take for the other buckets and also launch
  those with subagents”. Bucket 1 is executed; all other buckets are researched.
- **Internal revalidation:** existing `is_chaarlie_recommended=false` excludes
  purchase candidates, while active products remain identifiable and eligible
  for owned assessment. Existing planned recommendations may degrade to the
  existing unavailable step; owned routine items retain their current support.

1. **Purchase offer not verified (18 rows):** fresh preferred-shop search and
   exact identity/variant reconciliation. Recover same-product commerce where
   safely established; otherwise set only `is_chaarlie_recommended=false` for
   currently recommended rows. Keep current price/link metadata when unverified;
   do not stamp unavailable from a challenge, search miss, or store-only offer.
2. **Order/fragrance declaration differences (3):** collect exact current and
   historical INCI; distinguish confirmed continuity from unresolved changes;
   reassess current formula under its category contract. Return proposed facts
   and evidence without inheriting former labels or publishing changes.
3. **Current ingredients need reassessment (3):** freeze exact current-market
   INCI, run the applicable formula-first research lane, compare resulting facts
   and protocols, and propose a same-product update or distinct version. A
   comparison exposed to older labels is provisional, not a certified blind run.
4. **Missing/conflicting evidence (3):** recover primary identity/INCI and GTIN
   provenance; resolve regional/market/version conflicts. A current offer alone
   does not authorize attaching its barcode or formula to an older catalog item.

## Ordered execution and proof

1. Parallel evidence lanes cover all scoped IDs with actual collection times and
   source URLs. Root verifies fresh commercial candidates and retained holds.
2. Read the complete live product/identifier state. Prepare an exact manifest of
   approved purchase pauses and any safely recovered commerce separately.
3. Root checks SQL field allowlists, expected-before complete product/identifier
   fingerprints, stable row locks, trigger effects, rollback, and reversibility.
   Obtain one read-only Claude plan/SQL second opinion; unavailable review is
   recorded honestly and does not become approval.
4. Exercise a rollback dry run, independently verify all product/identifier
   rows, then apply the already approved pause scope. Independently verify exact
   updated IDs, protected fields, unchanged identifiers, and untargeted rows.
5. Preserve immutable research artifacts in a new rollout receipt, including the
   policy, source checks, exact manifest, SQL/dry-run/readbacks, restoration data,
   and source fingerprints. Commit only task-owned artifacts under the existing
   batch commit authorization. Temporary reviewer/test outputs stay in `/tmp`.

No new behavior code is planned. Verify existing scan/owned/recommendation
eligibility paths with their focused tests. New purchase candidates retain normal
readiness gates; a paused flag is not automatically restored from stock evidence.

Done when bucket 1 has verified commerce or an audited pause for every row,
all other bucket investigations have per-product evidence and an explicit next
decision, protected catalog state passes readback, and the local receipt is saved.
