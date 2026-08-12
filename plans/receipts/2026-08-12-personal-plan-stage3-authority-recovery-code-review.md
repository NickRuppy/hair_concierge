# Personal Plan Stage 3 authority-projection repair — code-review receipt

## Identity

- Scope: all tracked modifications and task-owned untracked plan files in the current worktree against `origin/main`.
- Branch: `codex/personal-plan-stage3-authority-recovery`
- Base: `origin/main` at `6e518751d60c963704e14a480c7ac61be4f1abcb`
- Canonical content fingerprint: `4d2517a5fc56756c88b6409277e0b7f5451096586391e1883b6dab03fe5a39d6`
- Review receipts are excluded from the fingerprint.

## Lanes

- Normal correctness review: shared authority validation, Supabase projection, callers, fail-closed behavior, data integrity, security/privacy, and regression coverage.
- Structural maintainability review: justified by the shared type boundary and changes across four source files. The review traced every field read by the narrowed contract and compared the read validator with the Stage 3 write path.
- Independent counterpart: Claude Opus 4.8, read-only, high effort. Transient report retained only at `/tmp/personal-plan-stage3-authority-recovery-final-code-review.md` until handoff.

## Findings and rulings

No blocking findings.

- The previously supported overlap defect is fixed. Both write and read paths now use base order plus only overlay categories not already present in the base. Existing base categories retain their position and ordinary snapshot/version validation.
- The seven-field `Stage3AuthorityDraftInput` contains exactly the fields read by authority and product-load validation; full-draft production callers satisfy it structurally.
- The Supabase projection now preserves the three missing payload facts, and a production-shaped row is exercised through the real projection and validator in one regression test.
- Stale or tampered overlay facts remain fail-closed through semantic re-derivation and journey fallback.
- Non-blocking robustness note: `productLoadResolution` is cast from persisted JSON without an explicit object guard. A malformed row can produce a caught generic error rather than a typed authority error, but access still denies. Strict persisted-shape parsing is intentionally deferred because it is outside this confirmed projection repair and would broaden the failure contract.
- Low-priority coverage notes for an explicitly absent overlay and malformed overlay JSON are deferred; existing order and semantic controls already deny both shapes, and the requested production-valid and semantically stale cases are directly covered.

## Verification considered

- Focused authority/journey tests: 85/85.
- Full Personal Plan suite: 1,191/1,191.
- Typecheck, lint, and production build: passed; four unrelated pre-existing lint warnings.
- Persisted Stage 1–5 browser journey: 2/2.
- Dedicated Stage 3 browser suite: 15/15.
- Transition benchmark and `git diff --check`: passed.

## Bottom line

Ready for a reviewable commit. No commit, push, PR, deployment, migration, feature-flag change, or production write was performed.
