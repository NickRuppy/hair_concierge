# Scanner E18 oil re-entry code-review receipt

- Scope: exact oil disposition-reversal delta against `972e8a51`.
- Functional content fingerprint: `e4f767dc6d6ce433f0561da53872af4278e06600d44103db2af3c9b88c37729c`.
- Review lanes: main correctness/data-integrity review plus Claude Opus 4.8 / high, read-only terminal counterpart review.

## Verdict

GO as a guarded, non-applied preparation. No blocking defect remains.

The counterpart independently recomputed both manifest fingerprints, compared the TypeScript and SQL cohort contracts, exercised cross-batch injection and rollback, verified S5R-01 replay safety, inspected the security and kill-switch gates, and ran the focused tests, typecheck and lint.

Three low findings were accepted and fixed: the migration now re-runs safely, its constraint names no longer truncate, and the exclusion contract now pins the actually disposed Balea Pflegeöl row. The stale pinning comment was also corrected. A new PGlite regression test executes the extension migration twice.

The separate Balea Pflegeöl Natural Beauty row remains intentionally untouched because it is not one of the user's exact 18 curated targets. Its body-oil rationale should be reconsidered in a later explicit cohort rather than silently broadening this wave.

## Residual gate

Do not apply either reversal batch until the oil V2 authority migration is live and fresh production preflight reports no publication blocker for every selected product. The transient Claude report remains outside the repository.
