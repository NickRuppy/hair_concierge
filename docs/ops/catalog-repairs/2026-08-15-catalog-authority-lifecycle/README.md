# Catalogue authority lifecycle repair

Approved on 2026-08-15 for the exact 19 rows documented in `plans/receipts/2026-08-15-catalog-authority-lifecycle-repair-candidates.md`.

1. Run `preflight.sql` read-only. Required receipt: `expectedRows=19`, `exactRows=19`, `driftRows=0`, `mappingCount=6`, `targetDefects=0`, `conflictingRelationships=0`.
2. Run `repair.sql` only against Supabase project `pqdkhefxsxkyeqelqegq`.
3. Require `remainingRecommendationLifecycleConflicts=0`.
4. Rerun the exhaustive catalogue-authority audit and record the before/after issue counts.

The operation changes lifecycle/publication intent and adds six reviewed `replaced_by` edges. It does not change product facts, protocols, provenance, identifiers, owner links, submissions, drafts, or plan artifacts. The complete-category runtime already excludes every source row in this package because they are inactive or discontinued.
